'use strict';
const { app, Tray } = require('electron');

// Prevent multiple instances — if another instance is already running, quit this one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
const { state, loadSettings, saveSettings } = require('./state');
const { makeIcon, refreshTrayAppearance } = require('./tray-ui');
const { getLastSyncTime, getPlistInterval } = require('./time-helpers');
const { rebuildMenu } = require('./menu-builder');
const { scheduleNextSync, loadLastOutputFromFile } = require('./sync-runner');
const { startLogWatcher, stopLogWatcher } = require('./log-window');
const { pollDeployStatus } = require('./github-api');
const { registerIPC } = require('./ipc-handlers');
const { readPlist, removeStartInterval, isAgentLoaded, unloadAgent, loadAgent } = require('./plist-manager');

// ── Register callbacks for cross-module communication ─────────────────────
state.callbacks.rebuildMenu = rebuildMenu;
state.callbacks.refreshTrayAppearance = refreshTrayAppearance;

// ── Register all IPC handlers ─────────────────────────────────────────────
registerIPC();

// ── App init ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (app.dock) app.dock.hide();

  // Default to open at login on first launch
  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  // Migrate interval from plist to settings.json (one-time, if not already done)
  const initSettings = loadSettings();
  if (!initSettings.intervalSeconds) {
    try {
      const plistData = readPlist();
      const migratedInterval = plistData.startInterval || 1800;
      saveSettings({ ...initSettings, intervalSeconds: migratedInterval });
    } catch { saveSettings({ ...initSettings, intervalSeconds: 1800 }); }
  }

  // Remove StartInterval from plist so launchd no longer schedules the script.
  // Electron app is now the sole scheduler — prevents double-sync "already running" skips.
  const agentWasLoaded = isAgentLoaded();
  removeStartInterval();
  if (agentWasLoaded) {
    try { unloadAgent(); loadAgent(); } catch {}
  }

  state.tray = new Tray(makeIcon('green'));
  state.tray.setToolTip('Bible Notes Sync');
  state.tray.on('click', () => state.tray.popUpContextMenu());

  refreshTrayAppearance();
  rebuildMenu();
  startLogWatcher();
  // Pre-load last sync output from file so it's ready when window opens
  state.lastSyncOutput = loadLastOutputFromFile();
  pollDeployStatus(); // initial deploy status fetch

  // Restore paused remaining time in case app restarted while paused
  const startupSettings = loadSettings();
  if (startupSettings.pausedRemainingMs) {
    state.pausedRemainingMs = startupSettings.pausedRemainingMs;
  }

  // Schedule first sync from last known time (skip if agent is paused/unloaded)
  if (isAgentLoaded()) {
    const lastSync = getLastSyncTime();
    if (lastSync && !isNaN(lastSync)) {
      const elapsed = Date.now() - lastSync.getTime();
      const interval = getPlistInterval() * 1000;
      const remaining = Math.max(5000, interval - elapsed);
      scheduleNextSync(remaining);
    } else {
      scheduleNextSync();
    }
  }

  // Rebuild menu every 10s for countdown
  state.menuRefreshTimer = setInterval(() => {
    if (!state.isSyncing) {
      rebuildMenu();
      refreshTrayAppearance();
    }
  }, 10_000);

});

app.on('window-all-closed', (e) => e.preventDefault());

app.on('before-quit', () => {
  clearTimeout(state.nextSyncTimer);
  clearTimeout(state.quietHoursTimer);
  clearTimeout(state.deployPollTimer);
  clearInterval(state.menuRefreshTimer);
  clearInterval(state.pdfPollTimer);
  clearInterval(state.spinnerTimer);
  clearTimeout(state.notesChangedTimer);
  clearTimeout(state.menuRebuildDebounceTimer);
  clearTimeout(state.windowUpdateDebounceTimer);
  stopLogWatcher();
  if (state.syncProcess) state.syncProcess.kill();
});
