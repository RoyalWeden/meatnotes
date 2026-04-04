'use strict';
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const { Notification } = require('electron');
const { state, loadSettings, saveSettings, REPO_DIR, SYNC_SCRIPT, LAST_OUTPUT_FILE, STREAK_MILESTONES } = require('./state');
const { startSpinner, stopSpinner, flashTraySuccess, flashTrayError, refreshTrayAppearance, notifyIfAllowed, notifyError } = require('./tray-ui');
const { getPlistInterval, isInQuietWindow, msUntilQuietEnd } = require('./time-helpers');
const { pushStatusToWindow } = require('./status');
const { LOG_FILE, getAllEntries } = require('./log-parser');
const { hasPDFConflict } = require('./pdf-detector');
const { pollDeployStatus } = require('./github-api');
const { startLogWatcher } = require('./log-window');

// ── Smart commit message generation ───────────────────────────────────────
function buildSmartCommitMsg() {
  try {
    const out = execSync(
      `git -C "${REPO_DIR}" status --short -- content/ 2>/dev/null`,
      { encoding: 'utf8', timeout: 3000 }
    ).trim();
    if (!out) return null;
    const names = out.split('\n')
      .map(l => l.trim().replace(/^.{2}\s+/, ''))
      .map(f => path.basename(f, path.extname(f)))
      .filter(Boolean);
    if (names.length === 0) return null;
    const MAX = 3;
    if (names.length <= MAX) return `Updated: ${names.join(', ')}`;
    return `Updated: ${names.slice(0, MAX).join(', ')} (+${names.length - MAX} more)`;
  } catch { return null; }
}

// ── Last sync output persistence ──────────────────────────────────────────
function saveLastOutput() {
  try {
    const content = state.lastSyncOutput.trim() ? state.lastSyncOutput : reconstructLastOutput();
    fs.writeFileSync(LAST_OUTPUT_FILE, content, 'utf8');
  } catch {}
}

function loadLastOutputFromFile() {
  try {
    const data = fs.readFileSync(LAST_OUTPUT_FILE, 'utf8');
    if (data && data.trim()) return data;
  } catch {}
  return '';
}

function reconstructLastOutput() {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = raw.split('\n');
    let startIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] Sync started$/.test(lines[i])) {
        startIdx = i;
        break;
      }
    }
    if (startIdx === -1) return '';
    return lines.slice(startIdx).join('\n');
  } catch { return ''; }
}

// ── App-controlled sync scheduler ─────────────────────────────────────────
function scheduleNextSync(delayMs) {
  clearTimeout(state.nextSyncTimer);
  clearTimeout(state.quietHoursTimer);
  state.nextSyncTimer = null;
  state.quietHoursTimer = null;

  const settings = loadSettings();

  if (isInQuietWindow(settings)) {
    state.isQuietHours = true;
    state.nextSyncAt = null;
    refreshTrayAppearance();
    state.callbacks.rebuildMenu?.();
    pushStatusToWindow();
    const delay = msUntilQuietEnd(settings);
    state.quietHoursTimer = setTimeout(() => {
      state.isQuietHours = false;
      scheduleNextSync();
    }, delay);
    return;
  }

  state.isQuietHours = false;
  const ms = delayMs !== undefined ? delayMs : getPlistInterval() * 1000;
  state.nextSyncAt = Date.now() + ms;
  state.nextSyncTimer = setTimeout(() => autoSync(), ms);
  state.callbacks.rebuildMenu?.();
  pushStatusToWindow();
}

function autoSync() {
  if (state.isSyncing) return;
  if (hasPDFConflict()) {
    // Lazy require to avoid circular dependency
    const { startWaitingForPDFClose, showPDFAutoNotification } = require('./pdf-handler');
    startWaitingForPDFClose();
    showPDFAutoNotification();
  } else {
    runSync();
  }
}

// ── Sync execution ─────────────────────────────────────────────────────────
function runSync(commitMsg) {
  if (state.isSyncing) return;

  startLogWatcher();

  try { state.syncOutputOffset = fs.statSync(LOG_FILE).size; } catch { state.syncOutputOffset = 0; }

  state.syncStartedAt = Date.now();
  state.lastSyncOutput = '';
  startSpinner();
  state.lastSyncError = false;
  state.callbacks.rebuildMenu?.();
  pushStatusToWindow();

  const env = { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + process.env.PATH };

  const settings = loadSettings();
  if (settings.lfsEnabled === false || (settings.lfsSkipOnMetered && settings.isMetered)) {
    env.SKIP_LFS = '1';
  }
  if (settings.lfsBandwidthLimit) {
    env.LFS_BANDWIDTH_LIMIT = String(settings.lfsBandwidthLimit);
  }

  const msg = commitMsg || buildSmartCommitMsg();
  if (msg) env.SYNC_MSG = msg;

  state.syncProcess = spawn('/bin/bash', [SYNC_SCRIPT], { env });

  state.syncProcess.on('close', (code) => {
    state.syncProcess = null;
    state.syncStartedAt = null;
    stopSpinner();
    state.lastSyncError = code !== 0;

    const lfsMatch = state.lastSyncOutput.match(/LFS_STATUS:(\w+)/);
    state.lfsStatus = lfsMatch ? lfsMatch[1] : null;

    const settings = loadSettings();
    const nl = settings.notifyLevel;

    if (code !== 0) {
      settings.syncStreak = 0;
      saveSettings(settings);
      notifyError('Sync Failed', `Sync exited with code ${code}. Check View All Logs.`);
      flashTrayError();
    } else {
      flashTraySuccess();

      const prevStreak = settings.syncStreak || 0;
      settings.syncStreak = prevStreak + 1;
      if (settings.syncStreak > (settings.syncStreakBest || 0)) {
        settings.syncStreakBest = settings.syncStreak;
      }
      saveSettings(settings);

      const hitMilestone = STREAK_MILESTONES.find(
        m => settings.syncStreak === m
      ) || null;
      if (hitMilestone) {
        state.lastStreakMilestone = hitMilestone;
        if (nl !== 'never') {
          new Notification({
            title: `\ud83d\udd25 ${hitMilestone} Sync Streak!`,
            body: `You've synced ${hitMilestone} times in a row. Keep it up!`,
          }).show();
        }
      } else if (state.lfsStatus === 'failed') {
        notifyError('Bible Notes Sync', 'Content synced, but PDF fetch failed. Use "Fetch PDFs Now" to retry.');
      } else if (nl === 'all') {
        new Notification({ title: 'Bible Notes Sync', body: 'Sync completed successfully.' }).show();
      }

      try {
        const entries = getAllEntries();
        const sha = entries[0]?.commitSha;
        if (sha) {
          const out = execSync(
            `git -C "${REPO_DIR}" diff-tree --no-commit-id -r --name-only ${sha} -- content/ 2>/dev/null`,
            { timeout: 3000 }
          ).toString().trim();
          state.lastNotesChanged = out ? out.split('\n').filter(Boolean).length : 0;
          if (state.lastNotesChanged > 0) {
            clearTimeout(state.notesChangedTimer);
            state.notesChangedTimer = setTimeout(() => {
              state.lastNotesChanged = 0;
              refreshTrayAppearance();
            }, 5 * 60_000);
          }
        }
      } catch {}
    }

    saveLastOutput();
    state.cachedSiteVersion = null;

    pollDeployStatus();
    scheduleNextSync();

    state.callbacks.rebuildMenu?.();
    refreshTrayAppearance();
    pushStatusToWindow();
    if (state.logWindow && !state.logWindow.isDestroyed()) {
      state.logWindow.webContents.send('log-updated', getAllEntries());
    }
  });

  state.syncProcess.on('error', (err) => {
    state.syncProcess = null;
    state.syncStartedAt = null;
    stopSpinner();
    state.lastSyncError = true;
    notifyError('Quartz Sync Error', err.message);
    scheduleNextSync();
    state.callbacks.rebuildMenu?.();
    refreshTrayAppearance();
    pushStatusToWindow();
  });
}

module.exports = {
  runSync,
  autoSync,
  buildSmartCommitMsg,
  saveLastOutput,
  loadLastOutputFromFile,
  reconstructLastOutput,
  scheduleNextSync,
};
