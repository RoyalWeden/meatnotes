'use strict';
const { ipcMain, app, shell } = require('electron');
const { execSync } = require('child_process');
const { state, loadSettings, saveSettings, REPO_DIR, GITHUB_API_OWNER, GITHUB_API_REPO } = require('./state');
const { buildStatusPayload } = require('./status');
const { runSync, loadLastOutputFromFile, reconstructLastOutput, scheduleNextSync } = require('./sync-runner');
const { handleSyncNow, handlePauseResume, handleIntervalChange } = require('./event-handlers');
const { getAllEntries, LOG_FILE } = require('./log-parser');
const { getGithubHeaders } = require('./github-api');
const { runLfsPull } = require('./lfs-handler');
const { runBGSync } = require('./bg-controller');
const { openLogWindow } = require('./log-window');

function registerIPC() {
  ipcMain.handle('get-log-entries',  () => getAllEntries());
  ipcMain.handle('get-sync-status',  () => buildStatusPayload());
  ipcMain.handle('get-last-output',  () => {
    if (state.lastSyncOutput && state.lastSyncOutput.trim()) return state.lastSyncOutput;
    const fromFile = loadLastOutputFromFile();
    if (fromFile) { state.lastSyncOutput = fromFile; return fromFile; }
    return reconstructLastOutput();
  });

  ipcMain.handle('get-deploy-logs',  async (_e, runId) => {
    try {
      const jobsRes = await fetch(
        `https://api.github.com/repos/${GITHUB_API_OWNER}/${GITHUB_API_REPO}/actions/runs/${runId}/jobs`,
        { headers: getGithubHeaders() }
      );
      if (!jobsRes.ok) throw new Error(`Jobs HTTP ${jobsRes.status}`);
      const jobsJson = await jobsRes.json();
      const job = jobsJson.jobs?.[0];
      if (!job) return { job: null, logs: '' };

      const logsRes = await fetch(
        `https://api.github.com/repos/${GITHUB_API_OWNER}/${GITHUB_API_REPO}/actions/jobs/${job.id}/logs`,
        { headers: getGithubHeaders() }
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
  ipcMain.on('play-sound',           () => { /* sounds disabled */ });

  ipcMain.handle('get-settings', () => ({
    ...loadSettings(),
    loginItem: app.getLoginItemSettings().openAtLogin,
  }));
  ipcMain.on('save-settings',  (_e, s) => {
    saveSettings({ ...loadSettings(), ...s });
    if (s.quietHours !== undefined) {
      scheduleNextSync();
    }
  });
  ipcMain.on('set-login-item',  (_e, val) => app.setLoginItemSettings({ openAtLogin: val }));
  ipcMain.on('set-interval',    (_e, s) => handleIntervalChange(s));
  ipcMain.on('open-log-file',   () => { try { shell.showItemInFolder(LOG_FILE); } catch {} });
  ipcMain.on('trigger-lfs-pull', () => runLfsPull());
  ipcMain.on('trigger-bg-sync', () => runBGSync());
  ipcMain.handle('get-bg-status', () => ({ status: state.bgSyncStatus, noteCount: state.bgNoteCount, progress: state.bgProgress }));
  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('get-site-version', () => getSiteVersion());
}

// ── Site version (1.FEAT.FIX computed from git history) ────────────────────
function getSiteVersion() {
  if (state.cachedSiteVersion) return state.cachedSiteVersion;
  try {
    const exclude = "grep -Ev 'Quartz sync:|Auto-commit before sync'";
    const featCount = parseInt(execSync(
      `git -C "${REPO_DIR}" log --oneline | ${exclude} | grep -c 'feat:' || echo 0`,
      { timeout: 5000 }
    ).toString().trim()) || 0;
    const fixCount = parseInt(execSync(
      `git -C "${REPO_DIR}" log --oneline | ${exclude} | grep -c 'fix:' || echo 0`,
      { timeout: 5000 }
    ).toString().trim()) || 0;
    state.cachedSiteVersion = `1.${featCount}.${fixCount}`;
  } catch {
    state.cachedSiteVersion = '1.0.0';
  }
  return state.cachedSiteVersion;
}

module.exports = { registerIPC };
