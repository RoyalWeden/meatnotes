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
const { planNextSync, clearPlan, updateHashCache, detectLfsChanges, recordBytesPushed, optimizePendingPdfs } = require('./lfs-engine');
const { isAgentLoaded } = require('./plist-manager');

const CLEANUP_SCRIPT = path.join(__dirname, 'scripts', 'cleanup-icloud-dupes.sh');

// Run the iCloud dupe cleanup script synchronously before each sync when
// the user has the "Auto-clean before every sync" setting on. Short and
// quick — just git ls-files scanning and a single commit if anything found.
function runAutoCleanIfEnabled() {
  try {
    const settings = loadSettings();
    if (settings.autoCleanDupesBeforeSync === false) return;
    if (!fs.existsSync(CLEANUP_SCRIPT)) return;
    const out = execSync(
      `/bin/bash "${CLEANUP_SCRIPT}" --remove --commit`,
      { env: { ...process.env, REPO: REPO_DIR }, encoding: 'utf8', timeout: 30_000 }
    );
    const removedCount = (out.match(/^REMOVED:/gm) || []).length;
    if (removedCount > 0) {
      fs.appendFileSync(LOG_FILE, `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] Auto-clean removed ${removedCount} iCloud duplicate file(s)\n`);
    }
  } catch {
    // Non-fatal; never block the sync on cleanup failures.
  }
}

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

  // Honour pause: when the launchd agent is unloaded we also must not
  // re-arm the in-process setTimeout, otherwise autoSync still fires.
  if (!isAgentLoaded()) {
    state.nextSyncAt = null;
    state.callbacks.rebuildMenu?.();
    pushStatusToWindow();
    return;
  }

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
  // Defence in depth: if the agent is unloaded (paused), don't sync even if
  // somehow a lingering timer fired.
  if (!isAgentLoaded()) {
    state.nextSyncAt = null;
    pushStatusToWindow();
    return;
  }
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
// Options: { commitMsg, includePdfs } — includePdfs === true/false is an explicit
// user choice (primary button vs. "Sync with PDFs"); undefined falls back to settings.
function runSync(optsOrMsg) {
  if (state.isSyncing) return;

  // Backwards compat: legacy callers pass a commit message string directly.
  const opts = (typeof optsOrMsg === 'string' || optsOrMsg == null)
    ? { commitMsg: optsOrMsg, includePdfs: undefined }
    : optsOrMsg;

  startLogWatcher();

  // Proactively strip any iCloud-created duplicate files *before* the sync
  // so a push can never carry " 2" artifacts. Default: on.
  runAutoCleanIfEnabled();

  try { state.syncOutputOffset = fs.statSync(LOG_FILE).size; } catch { state.syncOutputOffset = 0; }

  state.syncStartedAt = Date.now();
  state.lastSyncOutput = '';
  state.pipelineStage = null;
  state.stageTimestamps = {};
  startSpinner();
  state.lastSyncError = false;
  state.callbacks.rebuildMenu?.();
  pushStatusToWindow();

  const env = { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + process.env.PATH };

  const settings = loadSettings();
  const msg = opts.commitMsg || buildSmartCommitMsg();

  // Route through lfs-engine: produces /tmp/quartz-sync-plan.json and decides skipLfs.
  let plan;
  try {
    plan = planNextSync({ explicitIncludePdfs: opts.includePdfs, commitMessage: msg || '' });
  } catch { plan = null; }

  // Optional pre-commit PDF optimization (lossless).
  if (plan && plan.includePdfs && settings.lfsOptimizePdfs) {
    try {
      const diff = detectLfsChanges();
      optimizePendingPdfs(diff.changed);
    } catch {}
  }

  // Honor legacy overrides (metered / lfs toggle) in addition to the plan.
  if (plan?.skipLfs || settings.lfsEnabled === false || (settings.lfsSkipOnMetered && settings.isMetered)) {
    env.SKIP_LFS = '1';
  }
  if (plan?.includePdfs) env.INCLUDE_PDFS = '1';
  if (plan?.throttleKBps || settings.lfsBandwidthLimit) {
    env.LFS_BANDWIDTH_LIMIT = String(plan?.throttleKBps || settings.lfsBandwidthLimit);
  }
  if (plan?.maxBytes)    env.LFS_MAX_BYTES = String(plan.maxBytes);

  if (msg) env.SYNC_MSG = msg;

  state.syncProcess = spawn('/bin/bash', [SYNC_SCRIPT], { env });

  // ── Live progress tailer ──────────────────────────────────────────────
  // The bash script writes STAGE:<name> lines to LOG_FILE as it progresses.
  // Without this tailer, the renderer goes from "all empty" to "all done"
  // in one paint at sync completion. With the tailer, each stage flips to
  // running → done in real time (Round-5 R3, debounced at 250ms).
  startLiveProgressTailer();

  state.syncProcess.on('close', (code) => {
    state.syncProcess = null;
    state.syncStartedAt = null;
    stopSpinner();
    stopLiveProgressTailer();
    // One last drain in case the script wrote a final batch of STAGE: lines
    // between the last 250 ms tick and process close.
    tickLiveProgress({ force: true });
    state.lastSyncError = code !== 0;

    const lfsMatch = state.lastSyncOutput.match(/LFS_STATUS:(\w+)/);
    state.lfsStatus = lfsMatch ? lfsMatch[1] : null;

    // After a successful LFS push, record bytes + update hash cache.
    if (code === 0 && state.lfsStatus === 'success') {
      try {
        const entries = getAllEntries();
        const session = entries[0];
        const pushed = (session?.stageTimestamps?.lfs_push) ? (require('./lfs-engine').detectLfsChanges().changed) : [];
        // The detect call right here reflects post-push state — files just pushed
        // are now "unchanged" relative to their cache entries we're about to write.
        // Rather than that, rebuild from the plan we wrote earlier.
        const planFile = require('./lfs-engine').PLAN_FILE;
        const planRaw = require('fs').readFileSync(planFile, 'utf8');
        const planObj = JSON.parse(planRaw);
        const pending = planObj.pending || {};
        const pushedPaths = pending.files || [];
        if (pushedPaths.length) {
          // We need each file's current sha to populate cache.
          const crypto = require('crypto');
          const fs2 = require('fs');
          const pushedEntries = pushedPaths.map(p => {
            try {
              const buf = fs2.readFileSync(require('path').join(REPO_DIR, p));
              return { path: p, sha: crypto.createHash('sha256').update(buf).digest('hex') };
            } catch { return null; }
          }).filter(Boolean);
          updateHashCache(pushedEntries);
          recordBytesPushed(pending.bytes || 0);
        }
      } catch {}
    }
    try { clearPlan(); } catch {}

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

// ── Live progress tailer ────────────────────────────────────────────────
// Reads new lines appended to LOG_FILE every 250 ms while a sync is alive
// and translates STAGE: / LFS_STATUS: events into incremental updates of
// state.pipelineStage and state.stageTimestamps. Round-5 R3.

const STAGE_LINE_RE  = /^\[([\d-]+ [\d:]+)\] STAGE:(\w+)/;
const LFS_LINE_RE    = /^\[([\d-]+ [\d:]+)\] LFS_STATUS:(\w+)/;
const TERMINAL_STAGES = new Set(['done', 'error']);

let _tailTimer = null;
let _tailReadOffset = 0;

function startLiveProgressTailer() {
  stopLiveProgressTailer(); // safety: never run two
  _tailReadOffset = state.syncOutputOffset || 0;
  _tailTimer = setInterval(tickLiveProgress, 250);
}

function stopLiveProgressTailer() {
  if (_tailTimer) clearInterval(_tailTimer);
  _tailTimer = null;
}

function tickLiveProgress(opts = {}) {
  // Stop tailing once the sync process is gone (unless we're doing a final drain).
  if (!opts.force && !state.syncProcess) { stopLiveProgressTailer(); return; }
  let chunk = '';
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size <= _tailReadOffset) return;
    const fd = fs.openSync(LOG_FILE, 'r');
    const buf = Buffer.alloc(stat.size - _tailReadOffset);
    fs.readSync(fd, buf, 0, buf.length, _tailReadOffset);
    fs.closeSync(fd);
    chunk = buf.toString('utf8');
    _tailReadOffset = stat.size;
  } catch { return; }

  if (!chunk) return;

  let changed = false;
  for (const line of chunk.split('\n')) {
    const stageMatch = line.match(STAGE_LINE_RE);
    if (stageMatch) {
      const ts = new Date(stageMatch[1].replace(' ', 'T') + 'Z').toISOString();
      const stage = stageMatch[2];
      // End the previous active stage (if any non-terminal one is open).
      if (state.pipelineStage &&
          !TERMINAL_STAGES.has(state.pipelineStage) &&
          state.stageTimestamps[state.pipelineStage] &&
          !state.stageTimestamps[state.pipelineStage].end) {
        state.stageTimestamps[state.pipelineStage].end = ts;
      }
      state.pipelineStage = stage;
      if (!state.stageTimestamps[stage]) state.stageTimestamps[stage] = { start: ts };
      // Terminal stages get an end stamp at the same instant (the bash
      // script doesn't emit a separate "end" line).
      if (TERMINAL_STAGES.has(stage)) state.stageTimestamps[stage].end = ts;
      changed = true;
      continue;
    }
    const lfsMatch = line.match(LFS_LINE_RE);
    if (lfsMatch) {
      // LFS_STATUS:<name> just records into state.lfsStatus; don't add a stage.
      state.lfsStatus = lfsMatch[2];
      changed = true;
    }
  }
  if (changed) {
    state.callbacks.rebuildMenu?.();
    pushStatusToWindow();
  }
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
