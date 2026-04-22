'use strict';
const path = require('path');
const { BrowserWindow, nativeTheme } = require('electron');
const { state, loadSettings, saveSettings } = require('./state');

function openMainWindow() {
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.show();
    state.mainWindow.focus();
    return state.mainWindow;
  }

  const saved = loadSettings().mainWindowBounds;

  state.mainWindow = new BrowserWindow({
    x: saved?.x,
    y: saved?.y,
    width: saved?.width || 920,
    height: saved?.height || 620,
    minWidth: 780,
    minHeight: 520,
    title: 'Bible Sync',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ececef',
    webPreferences: {
      preload: path.join(__dirname, 'preload-main.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  state.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  state.mainWindow.setMenu(null);

  state.mainWindow.on('close', () => {
    try {
      const bounds = state.mainWindow.getBounds();
      saveSettings({ ...loadSettings(), mainWindowBounds: bounds });
    } catch {}
  });
  state.mainWindow.on('closed', () => { state.mainWindow = null; });

  return state.mainWindow;
}

module.exports = { openMainWindow };
