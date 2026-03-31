'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('syncAPI', {
  getLogEntries:  () => ipcRenderer.invoke('get-log-entries'),
  getSyncStatus:  () => ipcRenderer.invoke('get-sync-status'),
  triggerSync:    (msg) => ipcRenderer.send('trigger-sync', msg || ''),
  triggerLfsPull: () => ipcRenderer.send('trigger-lfs-pull'),
  togglePause:    () => ipcRenderer.send('toggle-pause'),
  openGitHub:     (url) => ipcRenderer.send('open-github', url),
  onLogUpdate:    (cb) => ipcRenderer.on('log-updated', (_e, entries) => cb(entries)),
  onSyncStatus:   (cb) => ipcRenderer.on('sync-status', (_e, status) => cb(status)),
  onSyncOutput:   (cb) => ipcRenderer.on('sync-output', (_e, chunk) => cb(chunk)),
  // Settings
  getSettings:    () => ipcRenderer.invoke('get-settings'),
  saveSettings:   (s) => ipcRenderer.send('save-settings', s),
  setLoginItem:   (val) => ipcRenderer.send('set-login-item', val),
  setInterval:    (s) => ipcRenderer.send('set-interval', s),
  playSound:      () => ipcRenderer.send('play-sound'),
  // Output + deploy
  getLastOutput:   () => ipcRenderer.invoke('get-last-output'),
  getDeployLogs:   (runId) => ipcRenderer.invoke('get-deploy-logs', runId),
  // App info
  getAppVersion:   () => ipcRenderer.invoke('get-app-version'),
  getSiteVersion:  () => ipcRenderer.invoke('get-site-version'),
  openLogFile:     () => ipcRenderer.send('open-log-file'),
});
