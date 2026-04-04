'use strict';
const path = require('path');
const { BrowserWindow } = require('electron');
const { state, loadSettings, saveSettings } = require('./state');

function openLogWindow() {
  if (state.logWindow && !state.logWindow.isDestroyed()) {
    state.logWindow.focus();
    return;
  }

  const savedBounds = loadSettings().windowBounds;

  state.logWindow = new BrowserWindow({
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

  state.logWindow.loadFile(path.join(__dirname, 'log-window.html'));
  state.logWindow.setMenu(null);

  state.logWindow.on('close', () => {
    const bounds = state.logWindow.getBounds();
    saveSettings({ ...loadSettings(), windowBounds: bounds });
  });
  state.logWindow.on('closed', () => { state.logWindow = null; });
}

const fs = require('fs');
const { LOG_FILE } = require('./log-parser');

function startLogWatcher() {
  if (state.logWatcher) return;
  try {
    state.logWatcher = fs.watch(LOG_FILE, { persistent: false }, () => {
      // Stream new log content to window while sync is running
      if (state.isSyncing) {
        try {
          const size = fs.statSync(LOG_FILE).size;
          if (size < state.syncOutputOffset) state.syncOutputOffset = 0;
          if (size > state.syncOutputOffset) {
            const buf = Buffer.alloc(size - state.syncOutputOffset);
            const fd = fs.openSync(LOG_FILE, 'r');
            fs.readSync(fd, buf, 0, buf.length, state.syncOutputOffset);
            fs.closeSync(fd);
            state.syncOutputOffset = size;
            const chunk = buf.toString('utf8');
            if (state.lastSyncOutput.length < 500_000) state.lastSyncOutput += chunk;
            if (state.logWindow && !state.logWindow.isDestroyed()) {
              state.logWindow.webContents.send('sync-output', chunk);
            }
          }
        } catch {}
      }

      const { getAllEntries } = require('./log-parser');
      const { buildStatusPayload } = require('./status');

      clearTimeout(state.windowUpdateDebounceTimer);
      state.windowUpdateDebounceTimer = setTimeout(() => {
        if (state.logWindow && !state.logWindow.isDestroyed()) {
          state.logWindow.webContents.send('log-updated', getAllEntries());
          state.logWindow.webContents.send('sync-status', buildStatusPayload());
        }
        state.callbacks.rebuildMenu?.();
        state.callbacks.refreshTrayAppearance?.();
      }, 400);
    });
    state.logWatcher.on('error', () => {
      state.logWatcher = null;
      setTimeout(startLogWatcher, 500);
    });
  } catch {}
}

function stopLogWatcher() {
  if (state.logWatcher) { state.logWatcher.close(); state.logWatcher = null; }
}

module.exports = { openLogWindow, startLogWatcher, stopLogWatcher };
