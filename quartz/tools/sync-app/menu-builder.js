'use strict';
// Slim tray menu — the full control surface lives in the main window now.
// Tray shows only: status line, Sync Now, Open Bible Sync…, Quit.
const { app, Menu } = require('electron');
const { state } = require('./state');
const { getLastSyncTime, formatTime, getCountdownText } = require('./time-helpers');
const { isAgentLoaded } = require('./plist-manager');
const { openMainWindow } = require('./main-window');

function buildMenu() {
  const paused = !isAgentLoaded();
  const lastSync = getLastSyncTime();

  let statusText;
  if (state.isSyncing)          statusText = '\ud83d\udd04  Syncing\u2026';
  else if (state.isWaiting)     statusText = '\ud83d\udfe0  Waiting for PDF to close';
  else if (state.isQuietHours)  statusText = '\ud83c\udf19  Quiet hours active';
  else if (paused)              statusText = `\u23f8  Paused \u2014 last ${formatTime(lastSync)}`;
  else if (state.lastSyncError) statusText = `\u274c  Error \u2014 last ${formatTime(lastSync)}`;
  else                          statusText = `\u2705  Synced \u2014 ${formatTime(lastSync)}`;

  return Menu.buildFromTemplate([
    { label: statusText,                      enabled: false },
    { label: `  ${getCountdownText(paused)}`, enabled: false },
    { type: 'separator' },
    { label: 'Sync Now',        enabled: !state.isSyncing && !state.isWaiting, click: () => {
      const { handleSyncNow } = require('./event-handlers');
      handleSyncNow();
    }},
    { label: 'Open Bible Sync\u2026', accelerator: 'Cmd+O', click: () => openMainWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function rebuildMenu() {
  if (!state.tray) return;
  state.tray.setContextMenu(buildMenu());
}

module.exports = { buildMenu, rebuildMenu };
