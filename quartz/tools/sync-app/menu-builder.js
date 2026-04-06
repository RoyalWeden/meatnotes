'use strict';
const { app, Menu } = require('electron');
const { state, loadSettings, saveSettings } = require('./state');
const { getLastSyncTime, formatTime, formatInterval, getPlistInterval, getCountdownText } = require('./time-helpers');
const { isAgentLoaded } = require('./plist-manager');
const { getRecentEntries } = require('./log-parser');
const { openLogWindow } = require('./log-window');

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
      click: () => {
        const { handleIntervalChange } = require('./event-handlers');
        handleIntervalChange(p.seconds);
      },
    })),
    { type: 'separator' },
    { label: 'Custom\u2026', click: () => {
      const { showCustomIntervalDialog } = require('./event-handlers');
      showCustomIntervalDialog();
    }},
  ];
}

function buildMenu() {
  const paused = !isAgentLoaded();
  const lastSync = getLastSyncTime();
  const recent = getRecentEntries(5);
  const currentInterval = getPlistInterval();

  let statusText;
  if (state.isSyncing)          statusText = '\ud83d\udd04  Syncing\u2026';
  else if (state.isWaiting)     statusText = '\ud83d\udfe0  Waiting for PDF to close';
  else if (state.isQuietHours)  statusText = '\ud83c\udf19  Quiet hours active';
  else if (paused)              statusText = `\u23f8  Paused \u2014 last ${formatTime(lastSync)}`;
  else if (state.lastSyncError) statusText = `\u274c  Error \u2014 last ${formatTime(lastSync)}`;
  else                          statusText = `\u2705  Synced \u2014 ${formatTime(lastSync)}`;

  const recentItems = recent.filter(e => e.subtype !== 'already-running').map(e => {
    const dur = e.durationSeconds != null ? `  \u2022 ${e.durationSeconds}s` : '';
    const icon = e.subtype === 'no-internet' ? '\ud83d\udcf5' : e.status === 'success' ? '\u2705' : e.status === 'error' ? '\u274c' : e.status === 'partial' ? '\ud83d\udfe0' : '\u26aa';
    return { label: `  ${icon}  ${formatTime(new Date(e.timestamp))}  \u2014  ${e.detail}${dur}`, enabled: false };
  });
  if (recentItems.length === 0) recentItems.push({ label: '  No entries yet', enabled: false });

  return Menu.buildFromTemplate([
    { label: statusText,                      enabled: false },
    { label: `  ${getCountdownText(paused)}`, enabled: false },
    { type: 'separator' },
    { label: 'Sync Now',        enabled: !state.isSyncing && !state.isWaiting, click: () => {
      const { handleSyncNow } = require('./event-handlers');
      handleSyncNow();
    }},
    { label: paused ? 'Resume Auto-Sync' : 'Pause Auto-Sync', enabled: !state.isSyncing, click: () => {
      const { handlePauseResume } = require('./event-handlers');
      handlePauseResume();
    }},
    { type: 'separator' },
    { label: `Interval: ${formatInterval(currentInterval)}`, submenu: buildIntervalSubmenu(currentInterval) },
    { type: 'separator' },
    { label: state.lfsStatus === 'failed' ? '\u26a0\ufe0f  PDFs: fetch failed'
           : state.lfsStatus === 'skipped' ? '\u23ed  PDFs: skipped'
           : state.lfsStatus === 'unchanged' ? '\u2705  PDFs: up to date'
           : state.lfsStatus === 'success' ? '\u2705  PDFs: synced'
           : state.isLfsPulling ? '\ud83d\udd04  PDFs: fetching\u2026'
           : '\ud83d\udcc4  PDFs', enabled: false },
    { label: 'Fetch PDFs Now', enabled: !state.isLfsPulling && !state.isSyncing, click: () => {
      const { runLfsPull } = require('./lfs-handler');
      runLfsPull();
    }},
    {
      label: 'LFS Settings',
      submenu: [
        { label: 'Auto-fetch PDFs', type: 'checkbox', checked: loadSettings().lfsEnabled !== false,
          click: (item) => { const s = loadSettings(); s.lfsEnabled = item.checked; saveSettings(s); rebuildMenu(); }},
        { label: 'Skip on metered connection', type: 'checkbox', checked: !!loadSettings().lfsSkipOnMetered,
          click: (item) => { const s = loadSettings(); s.lfsSkipOnMetered = item.checked; saveSettings(s); rebuildMenu(); }},
        { label: 'Mark as metered network', type: 'checkbox', checked: !!loadSettings().isMetered,
          click: (item) => { const s = loadSettings(); s.isMetered = item.checked; saveSettings(s); rebuildMenu(); }},
        { type: 'separator' },
        { label: 'Bandwidth: Unlimited', type: 'radio', checked: !loadSettings().lfsBandwidthLimit,
          click: () => { const s = loadSettings(); delete s.lfsBandwidthLimit; saveSettings(s); rebuildMenu(); }},
        { label: 'Bandwidth: 1 MB/s', type: 'radio', checked: loadSettings().lfsBandwidthLimit === 1024,
          click: () => { const s = loadSettings(); s.lfsBandwidthLimit = 1024; saveSettings(s); rebuildMenu(); }},
        { label: 'Bandwidth: 512 KB/s', type: 'radio', checked: loadSettings().lfsBandwidthLimit === 512,
          click: () => { const s = loadSettings(); s.lfsBandwidthLimit = 512; saveSettings(s); rebuildMenu(); }},
        { label: 'Bandwidth: 256 KB/s', type: 'radio', checked: loadSettings().lfsBandwidthLimit === 256,
          click: () => { const s = loadSettings(); s.lfsBandwidthLimit = 256; saveSettings(s); rebuildMenu(); }},
      ],
    },
    { type: 'separator' },
    { label: state.bgSyncStatus === 'exporting' ? '\ud83d\udd04  BibleGateway: exporting\u2026'
           : state.bgSyncStatus === 'importing' ? '\ud83d\udd04  BibleGateway: importing\u2026'
           : state.bgSyncStatus === 'login' ? '\ud83d\udd11  BibleGateway: waiting for login\u2026'
           : '\ud83d\udcd6  BibleGateway', enabled: false },
    { label: 'Sync BibleGateway', enabled: state.bgSyncStatus === 'idle' || state.bgSyncStatus === 'done' || state.bgSyncStatus === 'error',
      click: () => {
        const { runBGSync } = require('./bg-controller');
        runBGSync();
      }},
    { label: 'Debug BG Sync', enabled: state.bgSyncStatus === 'idle' || state.bgSyncStatus === 'done' || state.bgSyncStatus === 'error',
      click: () => {
        const { runBGSync } = require('./bg-controller');
        runBGSync({ debug: true });
      }},
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
  if (!state.tray) return;
  state.tray.setContextMenu(buildMenu());
}

module.exports = { buildMenu, rebuildMenu, buildIntervalSubmenu };
