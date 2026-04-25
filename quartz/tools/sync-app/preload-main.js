'use strict';
const { contextBridge, ipcRenderer, shell } = require('electron');

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);
const send   = (ch, ...args) => ipcRenderer.send(ch, ...args);
const on     = (ch, fn) => {
  const wrapped = (_e, data) => fn(data);
  ipcRenderer.on(ch, wrapped);
  return () => ipcRenderer.removeListener(ch, wrapped);
};

contextBridge.exposeInMainWorld('api', {
  // Queries
  getStatus:       () => invoke('get-sync-status'),
  getLogEntries:   () => invoke('get-log-entries'),
  getLastOutput:   () => invoke('get-last-output'),
  getSettings:     () => invoke('get-settings'),
  getAppVersion:   () => invoke('get-app-version'),
  getSiteVersion:  () => invoke('get-site-version'),
  getBgStatus:     () => invoke('get-bg-status'),
  getLfsChanges:   () => invoke('get-lfs-changes'),
  getLfsUsage:     () => invoke('get-lfs-usage'),
  getLfsPlanPreview: (includePdfs) => invoke('lfs-plan-preview', { includePdfs }),
  findDupes:       (absPath) => invoke('lfs-find-dupes', absPath),
  fetchLfsQuota:   () => invoke('fetch-lfs-quota'),
  getRunJobs:      (runId) => invoke('get-run-jobs', runId),
  getDeployLogs:   (runId) => invoke('get-deploy-logs', runId),
  getGitLocation:  () => invoke('get-git-location'),
  cleanupDupes:    (opts) => invoke('cleanup-dupes', opts || {}),
  migrateGit:      (opts) => invoke('migrate-git', opts || {}),
  saveLfsManual:   (data) => invoke('save-lfs-manual', data || {}),
  organizeWebsite: (opts) => invoke('organize-website', opts || {}),
  getLocations:    () => invoke('get-locations'),
  openPath:        (which) => send('open-path', which),
  repairGitPointer:() => invoke('repair-git-pointer'),

  // Actions
  syncNow:         (msg) => send('trigger-sync', msg),
  syncNoPdfs:      (msg) => send('trigger-sync-no-pdfs', msg),
  syncWithPdfs:    (msg) => send('trigger-sync-with-pdfs', msg),
  togglePause:     () => send('toggle-pause'),
  setInterval:     (sec) => send('set-interval', sec),
  setLoginItem:    (val) => send('set-login-item', val),
  saveSettings:    (s) => send('save-settings', s),
  triggerLfsPull:  () => send('trigger-lfs-pull'),
  triggerBgSync:   () => send('trigger-bg-sync'),
  openLogFile:     () => send('open-log-file'),
  openExternal:    (url) => send('open-github', url),

  // Streams (return unsubscribe fn)
  onStatus:           (fn) => on('sync-status', fn),
  onLogUpdated:       (fn) => on('log-updated', fn),
  onSyncOutput:       (fn) => on('sync-output', fn),
  onLfsChangesUpdated:(fn) => on('lfs-changes-updated', fn),
  onBgProgress:       (fn) => on('bg-progress', fn),
  onBgComplete:       (fn) => on('bg-complete', fn),
});
