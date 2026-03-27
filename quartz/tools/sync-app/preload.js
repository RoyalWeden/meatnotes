'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('syncAPI', {
  getLogEntries:  () => ipcRenderer.invoke('get-log-entries'),
  getSyncStatus:  () => ipcRenderer.invoke('get-sync-status'),
  triggerSync:    () => ipcRenderer.send('trigger-sync'),
  togglePause:    () => ipcRenderer.send('toggle-pause'),
  openGitHub:     (url) => ipcRenderer.send('open-github', url),
  onLogUpdate:    (cb) => ipcRenderer.on('log-updated', (_e, entries) => cb(entries)),
  onSyncStatus:   (cb) => ipcRenderer.on('sync-status', (_e, status) => cb(status)),
});
