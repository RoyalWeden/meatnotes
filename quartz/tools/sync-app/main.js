'use strict';
const { app, Tray, Menu, Notification, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');

const { makeCircleIcon } = require('./icon-generator');
const { readPlist, writeInterval, isAgentLoaded, invalidateAgentCache, unloadAgent, loadAgent } = require('./plist-manager');
const { getRecentEntries, getAllEntries, LOG_FILE } = require('./log-parser');
const { hasPDFConflict, openPDFsInContent } = require('./pdf-detector');

// ── Constants ──────────────────────────────────────────────────────────────
const REPO_DIR = '/Users/roywe/Library/Mobile Documents/com~apple~CloudDocs/Octarine/workspaces/bible';
const LAST_SYNC_FILE = path.join(REPO_DIR, 'content/.last-sync');
const SYNC_SCRIPT = path.join(os.homedir(), '.local/bin/quartz-sync.sh');
const GITHUB_REPO = 'https://github.com/RoyalWeden/meatnotes';
const SETTINGS_FILE = path.join(os.homedir(), 'Library/Application Support/bible-notes-sync/settings.json');

// ── GitHub API constants ───────────────────────────────────────────────────
const GITHUB_API_OWNER = 'RoyalWeden';
const GITHUB_API_REPO  = 'meatnotes';
const DEPLOY_WORKFLOW_FILE = 'deploy.yml';
const LAST_OUTPUT_FILE = path.join(os.homedir(), 'Library/Logs/quartz-sync-last-output.txt');

const STREAK_MILESTONES = [5, 10, 25, 50, 100];

// ── Settings persistence ───────────────────────────────────────────────────
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
  catch { return { notifyLevel: 'errors' }; }
}

function saveSettings(s) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
}

// ── Icon colours (macOS system palette) ───────────────────────────────────
const COLORS = {
  green:  [52,  199, 89],
  yellow: [255, 204, 0],
  red:    [255, 59,  48],
  orange: [255, 149, 0],
  grey:   [142, 142, 147],
  blue:   [10,  132, 255],
};

function makeIcon(color) {
  const [r, g, b] = COLORS[color] || COLORS.grey;
  const buf = makeCircleIcon(r, g, b, 32);
  return nativeImage.createFromBuffer(buf, { scaleFactor: 2 });
}

const ICON_CACHE = {};
function getCachedIcon(color) {
  if (!ICON_CACHE[color]) ICON_CACHE[color] = makeIcon(color);
  return ICON_CACHE[color];
}

// ── State ──────────────────────────────────────────────────────────────────
let tray = null;
let logWindow = null;
let syncProcess = null;
let pdfPollTimer = null;
let menuRefreshTimer = null;
let spinnerTimer = null;
let logWatcher = null;
let spinnerFrame = 0;
let quietHoursTimer = null;

let isSyncing = false;
let isWaiting = false;
let isQuietHours = false;
let lastSyncError = false;
let lastNotesChanged = 0;
let notesChangedTimer = null;
let syncOutputOffset = 0;
let lastStreakMilestone = null;  // milestone to announce, cleared after sending

let nextSyncTimer = null;
let nextSyncAt = null;      // ms timestamp — when next sync fires
let syncStartedAt = null;   // ms timestamp — when current sync began
let menuRebuildDebounceTimer = null;
let windowUpdateDebounceTimer = null;

// ── Deploy status state ────────────────────────────────────────────────────
let deployStatus = null;    // { status, conclusion, runId, runNumber, updatedAt, url, headSha }
let deployPollTimer = null;

// ── Last sync output ───────────────────────────────────────────────────────
let lastSyncOutput = '';    // persists the most recent sync's terminal output

const SPINNER_FRAMES = ['◐', '◓', '◑', '◒'];

// ── Helpers ────────────────────────────────────────────────────────────────
function getLastSyncTime() {
  try { return new Date(fs.readFileSync(LAST_SYNC_FILE, 'utf8').trim()); } catch { return null; }
}

function formatTime(date) {
  if (!date || isNaN(date)) return 'never';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatInterval(seconds) {
  if (seconds < 3600) return `${seconds / 60} min`;
  const h = seconds / 3600;
  return h === 1 ? '1 hour' : `${h} hours`;
}

function getPlistInterval() {
  try { return readPlist().startInterval; } catch { return 1800; }
}

function getCountdownText(paused) {
  if (isWaiting)      return '\u23f3 Waiting for PDF to close\u2026';
  if (isQuietHours)   return '\ud83c\udf19 Quiet hours active';
  if (paused)         return '\u23f8 Auto-sync paused';
  if (!nextSyncAt) {
    const lastSync = getLastSyncTime();
    if (!lastSync || isNaN(lastSync)) return 'Next sync: unknown';
    const diff = lastSync.getTime() + getPlistInterval() * 1000 - Date.now();
    if (diff <= 0) return 'Next sync: very soon';
    return `Next sync in: ${Math.ceil(diff / 60_000)} min`;
  }
  const diff = nextSyncAt - Date.now();
  if (diff <= 0) return 'Next sync: very soon';
  return `Next sync in: ${Math.ceil(diff / 60_000)} min`;
}

function buildStatusPayload() {
  const paused = !isAgentLoaded();
  const lastSync = getLastSyncTime();
  const settings = loadSettings();
  const openPDFs = isWaiting ? openPDFsInContent() : [];
  const milestone = lastStreakMilestone;
  lastStreakMilestone = null;  // consume once sent
  return {
    isSyncing,
    isWaiting,
    isPaused: paused,
    isQuietHours,
    lastSyncError,
    lastSyncTime: lastSync ? lastSync.toISOString() : null,
    intervalSeconds: getPlistInterval(),
    githubRepo: GITHUB_REPO,
    nextSyncAt: nextSyncAt,
    syncStartedAt: syncStartedAt,
    syncStreak: settings.syncStreak || 0,
    streakMilestone: milestone || null,
    openPDFs,
    deployStatus,
  };
}

function pushStatusToWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('sync-status', buildStatusPayload());
  }
}

// ── GitHub deploy status polling ───────────────────────────────────────────
async function pollDeployStatus() {
  clearTimeout(deployPollTimer);
  try {
    const url = `https://api.github.com/repos/${GITHUB_API_OWNER}/${GITHUB_API_REPO}/actions/workflows/${DEPLOY_WORKFLOW_FILE}/runs?per_page=1`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'quartz-sync-app' },
    });
    // Respect rate limit
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '60', 10);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const run = json.workflow_runs?.[0];
    if (run) {
      const prev = deployStatus;
      deployStatus = {
        status:     run.status,
        conclusion: run.conclusion,
        runId:      run.id,
        runNumber:  run.run_number,
        updatedAt:  run.updated_at,
        url:        run.html_url,
        headSha:    run.head_sha,
      };
      // Only push to window if something changed
      if (!prev ||
          prev.status !== deployStatus.status ||
          prev.conclusion !== deployStatus.conclusion ||
          prev.runId !== deployStatus.runId) {
        pushStatusToWindow();
      }
    }
    // Faster polling when in_progress, but back off if rate-limited
    const interval = remaining < 5 ? 60_000
      : deployStatus?.status === 'in_progress' ? 10_000
      : 60_000;
    deployPollTimer = setTimeout(pollDeployStatus, interval);
  } catch {
    // Network errors are silent — deploy status is non-critical
    deployPollTimer = setTimeout(pollDeployStatus, 60_000);
  }
}

// Notify only when appropriate for current notifyLevel
function notifyIfAllowed(title, body, opts = {}) {
  const nl = loadSettings().notifyLevel || 'errors';
  if (nl !== 'all') return null;
  const n = new Notification({ title, body, ...opts });
  n.show();
  return n;
}

function notifyError(title, body, opts = {}) {
  const nl = loadSettings().notifyLevel || 'errors';
  if (nl === 'never') return null;
  const n = new Notification({ title, body, ...opts });
  n.show();
  return n;
}

// ── Icon / title management ────────────────────────────────────────────────
function setTrayState(color, label) {
  if (!tray) return;
  tray.setImage(getCachedIcon(color));
  tray.setTitle(label ? ` ${label}` : '');
}

function refreshTrayAppearance() {
  if (isSyncing) return;
  const paused = !isAgentLoaded();
  const timeLabel = formatTime(getLastSyncTime());
  const notesLabel = lastNotesChanged > 0 ? `\u2191${lastNotesChanged}` : timeLabel;
  if (isWaiting)          setTrayState('orange', timeLabel);
  else if (isQuietHours)  setTrayState('blue',   '\ud83c\udf19');
  else if (paused)        setTrayState('grey',   '\u23f8');
  else if (lastSyncError) setTrayState('red',    timeLabel);
  else                    setTrayState('green',  notesLabel);
}

function startSpinner() {
  isSyncing = true;
  spinnerTimer = setInterval(() => {
    if (!tray) return;
    spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
    tray.setImage(getCachedIcon('yellow'));
    tray.setTitle(` ${SPINNER_FRAMES[spinnerFrame]}`);
  }, 200);
}

function stopSpinner() {
  isSyncing = false;
  clearInterval(spinnerTimer);
  spinnerTimer = null;
  refreshTrayAppearance();
}

// ── Quiet hours helpers ────────────────────────────────────────────────────
function parseTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isInQuietWindow(settings) {
  const qh = settings.quietHours;
  if (!qh || !qh.enabled) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = parseTime(qh.start || '22:00');
  const end   = parseTime(qh.end   || '07:00');
  if (start <= end) return cur >= start && cur < end;
  // overnight range (e.g. 22:00 – 07:00)
  return cur >= start || cur < end;
}

function msUntilQuietEnd(settings) {
  const qh = settings.quietHours;
  const endStr = qh?.end || '07:00';
  const [eh, em] = endStr.split(':').map(Number);
  const now = new Date();
  const end = new Date(now);
  end.setHours(eh, em, 0, 0);
  if (end <= now) end.setDate(end.getDate() + 1);
  return end.getTime() - now.getTime();
}

// ── App-controlled sync scheduler ─────────────────────────────────────────
function scheduleNextSync(delayMs) {
  clearTimeout(nextSyncTimer);
  clearTimeout(quietHoursTimer);
  nextSyncTimer = null;
  quietHoursTimer = null;

  const settings = loadSettings();

  // Check quiet hours first
  if (isInQuietWindow(settings)) {
    isQuietHours = true;
    nextSyncAt = null;
    refreshTrayAppearance();
    rebuildMenu();
    pushStatusToWindow();
    const delay = msUntilQuietEnd(settings);
    quietHoursTimer = setTimeout(() => {
      isQuietHours = false;
      scheduleNextSync();
    }, delay);
    return;
  }

  isQuietHours = false;
  const ms = delayMs !== undefined ? delayMs : getPlistInterval() * 1000;
  nextSyncAt = Date.now() + ms;
  nextSyncTimer = setTimeout(() => autoSync(), ms);
  rebuildMenu();
  pushStatusToWindow();
}

function autoSync() {
  if (isSyncing) return;
  if (hasPDFConflict()) {
    startWaitingForPDFClose();
    showPDFAutoNotification();
  } else {
    runSync();
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
      .map(l => l.trim().replace(/^.{2}\s+/, ''))  // strip status chars
      .map(f => path.basename(f, path.extname(f)))  // basename without ext
      .filter(Boolean);
    if (names.length === 0) return null;
    const MAX = 3;
    if (names.length <= MAX) return `Updated: ${names.join(', ')}`;
    return `Updated: ${names.slice(0, MAX).join(', ')} (+${names.length - MAX} more)`;
  } catch { return null; }
}

// ── Last sync output persistence ──────────────────────────────────────────
function saveLastOutput() {
  try { fs.writeFileSync(LAST_OUTPUT_FILE, lastSyncOutput, 'utf8'); } catch {}
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

// ── fs.watch for instant log refresh + live output streaming ───────────────
function startLogWatcher() {
  if (logWatcher) return;
  try {
    logWatcher = fs.watch(LOG_FILE, { persistent: false }, () => {
      // Stream new log content to window while sync is running
      if (isSyncing && logWindow && !logWindow.isDestroyed()) {
        try {
          const size = fs.statSync(LOG_FILE).size;
          if (size > syncOutputOffset) {
            const buf = Buffer.alloc(size - syncOutputOffset);
            const fd = fs.openSync(LOG_FILE, 'r');
            fs.readSync(fd, buf, 0, buf.length, syncOutputOffset);
            fs.closeSync(fd);
            syncOutputOffset = size;
            const chunk = buf.toString('utf8');
            // Accumulate for window re-opens (cap at 500KB)
            if (lastSyncOutput.length < 500_000) lastSyncOutput += chunk;
            logWindow.webContents.send('sync-output', chunk);
          }
        } catch {}
      }

      clearTimeout(windowUpdateDebounceTimer);
      windowUpdateDebounceTimer = setTimeout(() => {
        if (logWindow && !logWindow.isDestroyed()) {
          logWindow.webContents.send('log-updated', getAllEntries());
          logWindow.webContents.send('sync-status', buildStatusPayload());
        }
        rebuildMenu();
        refreshTrayAppearance();
      }, 400);
    });
  } catch {
    // Log file may not exist yet — no watcher needed
  }
}

function stopLogWatcher() {
  if (logWatcher) { logWatcher.close(); logWatcher = null; }
}

// ── Menu building ──────────────────────────────────────────────────────────
function buildIntervalSubmenu(currentInterval) {
  const presets = [
    { label: '15 min',  seconds: 900 },
    { label: '30 min',  seconds: 1800 },
    { label: '1 hour',  seconds: 3600 },
    { label: '2 hours', seconds: 7200 },
    { label: '4 hours', seconds: 14400 },
  ];
  return [
    ...presets.map(p => ({
      label: p.label,
      type: 'radio',
      checked: currentInterval === p.seconds,
      click: () => handleIntervalChange(p.seconds),
    })),
    { type: 'separator' },
    { label: 'Custom\u2026', click: showCustomIntervalDialog },
  ];
}

function buildMenu() {
  const paused = !isAgentLoaded();
  const lastSync = getLastSyncTime();
  const recent = getRecentEntries(5);
  const currentInterval = getPlistInterval();

  let statusText;
  if (isSyncing)          statusText = '\ud83d\udd04  Syncing\u2026';
  else if (isWaiting)     statusText = '\ud83d\udfe0  Waiting for PDF to close';
  else if (isQuietHours)  statusText = '\ud83c\udf19  Quiet hours active';
  else if (paused)        statusText = `\u23f8  Paused \u2014 last ${formatTime(lastSync)}`;
  else if (lastSyncError) statusText = `\u274c  Error \u2014 last ${formatTime(lastSync)}`;
  else                    statusText = `\u2705  Synced \u2014 ${formatTime(lastSync)}`;

  const recentItems = recent.length > 0
    ? recent.map(e => ({
        label: `  ${e.status === 'success' ? '\u2705' : e.status === 'error' ? '\u274c' : '\u26aa'}  ${formatTime(new Date(e.timestamp))}  \u2014  ${e.detail}`,
        enabled: false,
      }))
    : [{ label: '  No entries yet', enabled: false }];

  return Menu.buildFromTemplate([
    { label: statusText,                      enabled: false },
    { label: `  ${getCountdownText(paused)}`, enabled: false },
    { type: 'separator' },
    { label: 'Sync Now',        enabled: !isSyncing && !isWaiting, click: handleSyncNow },
    { label: paused ? 'Resume Auto-Sync' : 'Pause Auto-Sync', enabled: !isSyncing, click: handlePauseResume },
    { type: 'separator' },
    { label: `Interval: ${formatInterval(currentInterval)}`, submenu: buildIntervalSubmenu(currentInterval) },
    { type: 'separator' },
    { label: 'Recent Syncs:', enabled: false },
    ...recentItems,
    { label: 'View All Logs\u2026', click: openLogWindow },
    { type: 'separator' },
    {
      label: 'Open at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function rebuildMenu() {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
}

// ── Sync execution ─────────────────────────────────────────────────────────
function runSync(commitMsg) {
  if (isSyncing) return;

  // Track log file position for live output streaming
  try { syncOutputOffset = fs.statSync(LOG_FILE).size; } catch { syncOutputOffset = 0; }

  syncStartedAt = Date.now();
  lastSyncOutput = ''; // reset for fresh capture
  startSpinner();
  lastSyncError = false;
  rebuildMenu();
  pushStatusToWindow();

  const env = { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + process.env.PATH };

  // Use provided commit message, smart-generated one, or let script decide
  const msg = commitMsg || buildSmartCommitMsg();
  if (msg) env.SYNC_MSG = msg;

  syncProcess = spawn('/bin/bash', [SYNC_SCRIPT], { env });

  syncProcess.on('close', (code) => {
    syncProcess = null;
    syncStartedAt = null;
    stopSpinner();
    lastSyncError = code !== 0;

    const settings = loadSettings();
    const nl = settings.notifyLevel;

    if (code !== 0) {
      settings.syncStreak = 0;
      saveSettings(settings);
      notifyError('Sync Failed', `Sync exited with code ${code}. Check View All Logs.`);
    } else {
      // Increment streak and check for milestone
      const prevStreak = settings.syncStreak || 0;
      settings.syncStreak = prevStreak + 1;
      saveSettings(settings);

      // Check milestone BEFORE saving to avoid re-announcing
      const hitMilestone = STREAK_MILESTONES.find(
        m => settings.syncStreak === m
      ) || null;
      if (hitMilestone) {
        lastStreakMilestone = hitMilestone;
        if (nl !== 'never') {
          new Notification({
            title: `\ud83d\udd25 ${hitMilestone} Sync Streak!`,
            body: `You've synced ${hitMilestone} times in a row. Keep it up!`,
          }).show();
        }
      } else if (nl === 'all') {
        new Notification({ title: 'Bible Notes Sync', body: 'Sync completed successfully.' }).show();
      }

      // Count changed notes for tray badge
      try {
        const entries = getAllEntries();
        const sha = entries[0]?.commitSha;
        if (sha) {
          const out = execSync(
            `git -C "${REPO_DIR}" diff-tree --no-commit-id -r --name-only ${sha} -- content/ 2>/dev/null`,
            { timeout: 3000 }
          ).toString().trim();
          lastNotesChanged = out ? out.split('\n').filter(Boolean).length : 0;
          if (lastNotesChanged > 0) {
            clearTimeout(notesChangedTimer);
            notesChangedTimer = setTimeout(() => {
              lastNotesChanged = 0;
              refreshTrayAppearance();
            }, 5 * 60_000);
          }
        }
      } catch {}
    }

    // Persist the terminal output so it survives app restarts
    saveLastOutput();

    // Deploy likely just started — poll immediately
    pollDeployStatus();

    // Schedule next sync from NOW (after sync completes)
    scheduleNextSync();

    rebuildMenu();
    refreshTrayAppearance();
    pushStatusToWindow();
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.webContents.send('log-updated', getAllEntries());
    }
  });

  syncProcess.on('error', (err) => {
    syncProcess = null;
    syncStartedAt = null;
    stopSpinner();
    lastSyncError = true;
    notifyError('Quartz Sync Error', err.message);
    scheduleNextSync();
    rebuildMenu();
    refreshTrayAppearance();
    pushStatusToWindow();
  });
}

// ── PDF conflict flow ──────────────────────────────────────────────────────
function handlePDFConflict(onSyncAnyway, onSkip, onWait) {
  const n = new Notification({
    title: 'Quartz Sync',
    body: 'A PDF is open \u2014 sync may overwrite your edits.',
    actions: [
      { type: 'button', text: 'Sync Anyway' },
      { type: 'button', text: 'Skip This Sync' },
      { type: 'button', text: 'Wait for PDF to Close' },
    ],
    closeButtonText: 'Skip',
  });
  n.on('action', (_e, i) => [onSyncAnyway, onSkip, onWait][i]?.());
  n.on('click', onSkip);
  n.show();
}

function startWaitingForPDFClose() {
  isWaiting = true;
  refreshTrayAppearance();
  rebuildMenu();
  pushStatusToWindow();

  // Only notify on 'all' — waiting is informational, not an error
  notifyIfAllowed('Quartz Sync', 'Watching for the PDF to close \u2014 sync will run automatically.');

  pdfPollTimer = setInterval(() => {
    if (!hasPDFConflict()) {
      clearInterval(pdfPollTimer);
      pdfPollTimer = null;
      isWaiting = false;
      refreshTrayAppearance();
      rebuildMenu();
      runSync();
      notifyIfAllowed('Quartz Sync', 'PDF closed \u2014 syncing now.');
    }
  }, 5000);
}

function showPDFAutoNotification() {
  const nl = loadSettings().notifyLevel || 'errors';
  if (nl === 'never') return;
  const n = new Notification({
    title: 'Sync is patiently waiting\u2026',
    body: 'A PDF is open in your content folder. Sync will run the moment you close it. No action needed \u2014 or choose below.',
    actions: [
      { type: 'button', text: 'Sync Anyway' },
      { type: 'button', text: 'Skip This One' },
    ],
    closeButtonText: 'Auto-waiting\u2026',
  });
  n.on('action', (_e, i) => {
    if (i === 0) {
      // Sync Anyway
      clearInterval(pdfPollTimer); pdfPollTimer = null;
      isWaiting = false;
      runSync();
    } else {
      // Skip This One
      clearInterval(pdfPollTimer); pdfPollTimer = null;
      isWaiting = false;
      refreshTrayAppearance();
      rebuildMenu();
      pushStatusToWindow();
      scheduleNextSync();
    }
  });
  n.show();
}

// ── Event handlers ─────────────────────────────────────────────────────────
function handleSyncNow(commitMsg) {
  if (hasPDFConflict()) {
    handlePDFConflict(() => runSync(commitMsg), () => {}, () => startWaitingForPDFClose());
  } else {
    runSync(commitMsg);
  }
}

function handlePauseResume() {
  if (isAgentLoaded()) {
    unloadAgent();
    invalidateAgentCache(); // flush stale TTL cache immediately
    // Stop the in-app countdown timer too
    clearTimeout(nextSyncTimer);
    nextSyncTimer = null;
    nextSyncAt = null;
    notifyIfAllowed('Quartz Sync', 'Auto-sync paused.');
  } else {
    try {
      loadAgent();
      invalidateAgentCache(); // flush stale TTL cache immediately
      notifyIfAllowed('Quartz Sync', 'Auto-sync resumed.');
      // Resume the in-app scheduler
      scheduleNextSync();
    } catch (err) {
      dialog.showErrorBox('Could not resume agent', err.message);
    }
  }
  refreshTrayAppearance();
  rebuildMenu();
  pushStatusToWindow();
}

function handleIntervalChange(seconds) {
  try {
    const wasLoaded = isAgentLoaded();
    if (wasLoaded) unloadAgent();
    writeInterval(seconds);
    if (wasLoaded) loadAgent();
    notifyIfAllowed('Quartz Sync', `Auto-sync interval set to ${formatInterval(seconds)}.`);
  } catch (err) {
    dialog.showErrorBox('Could not change interval', err.message);
  }
  rebuildMenu();
  pushStatusToWindow();
}

// ── Custom interval dialog ─────────────────────────────────────────────────
function showCustomIntervalDialog() {
  const current = getPlistInterval();
  const win = new BrowserWindow({
    width: 320, height: 160, resizable: false,
    minimizable: false, maximizable: false, alwaysOnTop: true,
    title: 'Custom Sync Interval',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system;margin:24px;background:#f5f5f7}
    label{font-size:13px;color:#333}
    input{margin-top:8px;width:100%;padding:6px 8px;font-size:14px;border:1px solid #ccc;border-radius:6px}
    .btns{margin-top:16px;display:flex;gap:8px;justify-content:flex-end}
    button{padding:6px 14px;border-radius:6px;border:none;font-size:13px;cursor:pointer}
    #ok{background:#007aff;color:#fff} #cancel{background:#ddd;color:#333}
  </style></head><body>
  <label>Sync interval (minutes):</label>
  <input id="v" type="number" min="1" max="1440" value="${Math.round(current / 60)}" autofocus>
  <div class="btns">
    <button id="cancel" onclick="window.close()">Cancel</button>
    <button id="ok" onclick="submit()">OK</button>
  </div>
  <script>
    const {ipcRenderer}=require('electron');
    function submit(){const v=parseInt(document.getElementById('v').value,10);if(v>0&&v<=1440){ipcRenderer.send('custom-interval',v*60);window.close();}}
    document.getElementById('v').addEventListener('keydown',e=>{if(e.key==='Enter')submit();if(e.key==='Escape')window.close();});
  </script></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.setMenu(null);
}

// ── Log window ─────────────────────────────────────────────────────────────
function openLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  const savedBounds = loadSettings().windowBounds;

  logWindow = new BrowserWindow({
    x: savedBounds?.x,
    y: savedBounds?.y,
    width: savedBounds?.width || 720,
    height: savedBounds?.height || 580,
    minWidth: 520,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    transparent: true,
    title: 'Quartz Sync',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  logWindow.loadFile(path.join(__dirname, 'log-window.html'));
  logWindow.setMenu(null);

  logWindow.on('close', () => {
    const bounds = logWindow.getBounds();
    saveSettings({ ...loadSettings(), windowBounds: bounds });
  });
  logWindow.on('closed', () => { logWindow = null; });
}

// ── IPC ────────────────────────────────────────────────────────────────────
ipcMain.handle('get-log-entries',  () => getAllEntries());
ipcMain.handle('get-sync-status',  () => buildStatusPayload());
ipcMain.handle('get-last-output',  () => {
  if (lastSyncOutput && lastSyncOutput.trim()) return lastSyncOutput;
  const fromFile = loadLastOutputFromFile();
  if (fromFile) { lastSyncOutput = fromFile; return fromFile; }
  return reconstructLastOutput();
});

ipcMain.handle('get-deploy-logs',  async (_e, runId) => {
  try {
    const jobsRes = await fetch(
      `https://api.github.com/repos/${GITHUB_API_OWNER}/${GITHUB_API_REPO}/actions/runs/${runId}/jobs`,
      { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'quartz-sync-app' } }
    );
    if (!jobsRes.ok) throw new Error(`Jobs HTTP ${jobsRes.status}`);
    const jobsJson = await jobsRes.json();
    const job = jobsJson.jobs?.[0];
    if (!job) return { job: null, logs: '' };

    // GitHub returns 302 to a signed S3 URL — fetch follows redirects automatically
    const logsRes = await fetch(
      `https://api.github.com/repos/${GITHUB_API_OWNER}/${GITHUB_API_REPO}/actions/jobs/${job.id}/logs`,
      { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'quartz-sync-app' } }
    );
    const logs = logsRes.ok ? await logsRes.text() : '';
    return { job, logs };
  } catch (err) {
    return { job: null, logs: '', error: err.message };
  }
});
ipcMain.on('trigger-sync',         (_e, msg) => handleSyncNow(msg || undefined));
ipcMain.on('toggle-pause',         () => handlePauseResume());
ipcMain.on('custom-interval',      (_e, s) => handleIntervalChange(s));
ipcMain.on('open-github',          (_e, url) => shell.openExternal(url));
ipcMain.on('play-sound',           () => {
  try { spawn('afplay', ['/System/Library/Sounds/Glass.aiff']); } catch {}
});

ipcMain.handle('get-settings', () => ({
  ...loadSettings(),
  loginItem: app.getLoginItemSettings().openAtLogin,
}));
ipcMain.on('save-settings',  (_e, s) => {
  saveSettings({ ...loadSettings(), ...s });
  // If quiet hours settings changed, reschedule
  if (s.quietHours !== undefined) {
    scheduleNextSync();
  }
});
ipcMain.on('set-login-item', (_e, val) => app.setLoginItemSettings({ openAtLogin: val }));
ipcMain.on('set-interval',   (_e, s) => handleIntervalChange(s));

// ── App init ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (app.dock) app.dock.hide();

  // Default to open at login on first launch
  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  tray = new Tray(makeIcon('green'));
  tray.setToolTip('Bible Notes Sync');
  tray.on('click', () => tray.popUpContextMenu());

  refreshTrayAppearance();
  rebuildMenu();
  startLogWatcher();
  // Pre-load last sync output from file so it's ready when window opens
  lastSyncOutput = loadLastOutputFromFile();
  pollDeployStatus(); // initial deploy status fetch

  // Schedule first sync from last known time
  const lastSync = getLastSyncTime();
  if (lastSync && !isNaN(lastSync)) {
    const elapsed = Date.now() - lastSync.getTime();
    const interval = getPlistInterval() * 1000;
    const remaining = Math.max(5000, interval - elapsed);
    scheduleNextSync(remaining);
  } else {
    scheduleNextSync();
  }

  // Rebuild menu every 10s for countdown
  menuRefreshTimer = setInterval(() => {
    if (!isSyncing) {
      rebuildMenu();
      refreshTrayAppearance();
    }
  }, 10_000);
});

app.on('window-all-closed', (e) => e.preventDefault());

app.on('before-quit', () => {
  clearTimeout(nextSyncTimer);
  clearTimeout(quietHoursTimer);
  clearTimeout(deployPollTimer);
  clearInterval(menuRefreshTimer);
  clearInterval(pdfPollTimer);
  clearInterval(spinnerTimer);
  clearTimeout(notesChangedTimer);
  clearTimeout(menuRebuildDebounceTimer);
  clearTimeout(windowUpdateDebounceTimer);
  stopLogWatcher();
  if (syncProcess) syncProcess.kill();
});
