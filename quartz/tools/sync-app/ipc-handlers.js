'use strict';
const path = require('path');
const { ipcMain, app, shell } = require('electron');
const { execFile, execSync } = require('child_process');
const { state, loadSettings, saveSettings, REPO_DIR, GITHUB_API_OWNER, GITHUB_API_REPO } = require('./state');
const { buildStatusPayload } = require('./status');
const { runSync, loadLastOutputFromFile, reconstructLastOutput, scheduleNextSync } = require('./sync-runner');
const { handleSyncNow, handlePauseResume, handleIntervalChange } = require('./event-handlers');
const { getAllEntries, LOG_FILE } = require('./log-parser');
const { getGithubHeaders, fetchRunJobs, fetchLfsQuota, pollLfsQuota } = require('./github-api');
const { runLfsPull } = require('./lfs-handler');
const { runBGSync } = require('./bg-controller');
const { openLogWindow } = require('./log-window');
const { detectLfsChanges, currentUsage, findDuplicates, planNextSync, formatBytes } = require('./lfs-engine');
const { describeGitLocation, defaultExternalGitPath, needsICloudGitMigration } = require('./icloud-check');

const CLEANUP_SCRIPT = path.join(__dirname, 'scripts', 'cleanup-icloud-dupes.sh');
const MIGRATE_SCRIPT = path.join(__dirname, 'scripts', 'migrate-git-out-of-icloud.sh');
const WEBSITE_SCRIPT = path.join(__dirname, 'scripts', 'move-website-notes.sh');

function runScript(scriptPath, args, extraEnv = {}) {
  return new Promise((resolve) => {
    execFile('/bin/bash', [scriptPath, ...args], {
      env: { ...process.env, ...extraEnv },
      maxBuffer: 4 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

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

  ipcMain.on('trigger-sync',         (_e, arg) => handleSyncNow(arg || undefined));
  // Explicit PDF-aware sync triggers from the main window.
  ipcMain.on('trigger-sync-no-pdfs', (_e, msg) => handleSyncNow({ commitMsg: msg || undefined, includePdfs: false }));
  ipcMain.on('trigger-sync-with-pdfs', (_e, msg) => handleSyncNow({ commitMsg: msg || undefined, includePdfs: true }));

  // LFS / PDF info for the PDFs pane.
  //
  // The full scan SHA-256s every LFS file, which is slow on iCloud-backed
  // storage. We return immediately with either (a) a cached result if fresh,
  // or (b) a fast-path result (size+mtime only). In parallel we kick off a
  // full scan in the background and push the accurate result to the window
  // when it finishes.
  const LFS_CACHE_TTL_MS = 30_000;
  function emptyLfs() { return { changed: [], unchanged: [], bytes: 0, bytesChanged: 0 }; }
  function kickBackgroundFullScan() {
    if (state.lfsChangesScanInFlight) return;
    state.lfsChangesScanInFlight = true;
    setImmediate(() => {
      try {
        const full = detectLfsChanges();
        state.lfsChangesCache = { data: full, ts: Date.now() };
        for (const win of [state.mainWindow, state.logWindow]) {
          if (win && !win.isDestroyed()) win.webContents.send('lfs-changes-updated', full);
        }
      } catch {} finally {
        state.lfsChangesScanInFlight = false;
      }
    });
  }
  ipcMain.handle('get-lfs-changes', () => {
    try {
      const cached = state.lfsChangesCache;
      if (cached && Date.now() - cached.ts < LFS_CACHE_TTL_MS) {
        return cached.data;
      }
      // Fast path for instant UI — doesn't SHA the files.
      const fast = detectLfsChanges({ fast: true });
      // Start the accurate background scan; results delivered via event.
      kickBackgroundFullScan();
      return fast;
    } catch {
      return emptyLfs();
    }
  });
  ipcMain.handle('get-lfs-usage', () => {
    try {
      const settings = loadSettings();
      const manual = settings.lfsQuotaManual || null;
      // Manual entry wins if it's recent (< 7 days), otherwise fall back to API quota.
      const MANUAL_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
      const manualFresh = manual && manual.updatedAt && (Date.now() - new Date(manual.updatedAt).getTime() < MANUAL_FRESH_MS);
      const quota = manualFresh
        ? { ...manual, source: 'manual' }
        : (state.lfsQuota ? { ...state.lfsQuota, source: 'api' } : null);
      return { usage: currentUsage(), quota, manual, settings };
    } catch {
      return { usage: { dayBytes: 0, monthBytes: 0 }, quota: null, manual: null, settings: loadSettings() };
    }
  });
  ipcMain.handle('save-lfs-manual', (_e, data = {}) => {
    try {
      const settings = loadSettings();
      const lfsQuotaManual = {
        storageUsedGB:     Number(data.storageUsedGB) || 0,
        storageIncludedGB: Number(data.storageIncludedGB) || 0,
        bandwidthUsedGB:   Number(data.bandwidthUsedGB) || 0,
        bandwidthIncludedGB: Number(data.bandwidthIncludedGB) || 0,
        daysLeft:          Number(data.daysLeft) || 0,
        updatedAt:         new Date().toISOString(),
      };
      saveSettings({ ...settings, lfsQuotaManual });
      return { ok: true, lfsQuotaManual };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('organize-website', async (_e, { commit } = {}) => {
    const args = [commit ? '--move' : '--list'];
    if (commit) args.push('--commit');
    const { code, stdout, stderr } = await runScript(WEBSITE_SCRIPT, args, { REPO: REPO_DIR });
    const found = [], moved = [], rewrote = [];
    let done = 0;
    const errors = [];
    for (const line of stdout.split('\n')) {
      if (line.startsWith('FOUND:'))        found.push(line.slice(6));
      else if (line.startsWith('MOVED:'))   moved.push(line.slice(6));
      else if (line.startsWith('REWROTE:')) rewrote.push(line.slice(8));
      else if (line.startsWith('DONE:'))    done = Number(line.slice(5)) || 0;
      else if (line.startsWith('ERR:'))     errors.push(line.slice(4));
    }
    return { code, found, moved, rewrote, done, errors, stderr };
  });
  ipcMain.handle('lfs-plan-preview', (_e, { includePdfs } = {}) => {
    try {
      const p = planNextSync({ explicitIncludePdfs: includePdfs, commitMessage: '' });
      return p;
    } catch { return null; }
  });
  ipcMain.handle('lfs-find-dupes', (_e, absPath) => {
    try { return findDuplicates(absPath); } catch { return []; }
  });
  ipcMain.handle('fetch-lfs-quota', async () => {
    const q = await fetchLfsQuota();
    if (q) state.lfsQuota = q;
    return q;
  });
  ipcMain.handle('get-run-jobs', async (_e, runId) => fetchRunJobs(runId));
  ipcMain.on('open-main-window', () => {
    try { require('./main-window').openMainWindow(); } catch {}
  });
  ipcMain.on('toggle-pause',         () => handlePauseResume());
  ipcMain.on('custom-interval',      (_e, s) => handleIntervalChange(s));
  ipcMain.on('open-github',          (_e, url) => shell.openExternal(url));
  ipcMain.on('play-sound',           () => { /* sounds disabled */ });

  ipcMain.handle('get-settings', () => ({
    ...loadSettings(),
    loginItem: app.getLoginItemSettings().openAtLogin,
  }));
  ipcMain.on('save-settings',  (_e, s) => {
    const before = loadSettings();
    saveSettings({ ...before, ...s });
    if (s.quietHours !== undefined) {
      scheduleNextSync();
    }
    // Live-apply interval changes so the generic settings binder can update it
    // without a dedicated Save button.
    if (s.intervalSeconds !== undefined && s.intervalSeconds !== before.intervalSeconds) {
      try { handleIntervalChange(s.intervalSeconds); } catch {}
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

  // ── Locations / Recovery (How it works pane) ──────────────────────────
  ipcMain.handle('get-locations', () => {
    const contentLink = path.join(REPO_DIR, 'content');
    let notesPath = contentLink;
    try {
      const fs = require('fs');
      if (fs.lstatSync(contentLink).isSymbolicLink()) {
        notesPath = fs.readlinkSync(contentLink);
      }
    } catch {}
    return {
      app: '/Applications/Bible Notes Sync.app',
      repo: REPO_DIR,
      notes: notesPath,
      log: LOG_FILE,
    };
  });

  ipcMain.on('open-path', (_e, which) => {
    try {
      const locsPromise = (async () => ({
        app: '/Applications/Bible Notes Sync.app',
        repo: REPO_DIR,
        notes: (() => {
          const contentLink = path.join(REPO_DIR, 'content');
          try {
            const fs = require('fs');
            if (fs.lstatSync(contentLink).isSymbolicLink()) {
              return fs.readlinkSync(contentLink);
            }
            return contentLink;
          } catch { return contentLink; }
        })(),
        log: LOG_FILE,
      }))();
      locsPromise.then(locs => {
        const target = locs[which];
        if (!target) return;
        if (which === 'log') shell.showItemInFolder(target);
        else shell.openPath(target);
      });
    } catch {}
  });

  ipcMain.handle('repair-git-pointer', async () => {
    const fs = require('fs');
    const gitPath = path.join(REPO_DIR, '.git');
    const contentPath = path.join(REPO_DIR, 'content');
    const externalStore = '/Users/roywe/.local/share/meatnotes-git';
    const expectedNotesPath = '/Users/roywe/Library/Mobile Documents/iCloud~com~octarine~notes/Documents/content';
    const fixes = [];
    try {
      // ── 1. Check the .git pointer / directory ───────────────────────────
      const gitStat = fs.existsSync(gitPath) ? fs.lstatSync(gitPath) : null;
      if (gitStat && gitStat.isDirectory()) {
        fixes.push('.git: real directory (healthy)');
      } else if (gitStat && gitStat.isFile()) {
        const content = fs.readFileSync(gitPath, 'utf8').trim();
        const m = content.match(/^gitdir:\s*(.+)$/);
        if (m && fs.existsSync(m[1])) {
          fixes.push(`.git: pointer → ${m[1]} (valid)`);
        } else if (fs.existsSync(externalStore)) {
          fs.writeFileSync(gitPath, `gitdir: ${externalStore}\n`);
          fixes.push(`.git: rewrote stale pointer → ${externalStore}`);
        } else {
          return { ok: false, error: '.git pointer is invalid and no external store found.' };
        }
      } else {
        // .git missing entirely
        if (fs.existsSync(externalStore)) {
          fs.writeFileSync(gitPath, `gitdir: ${externalStore}\n`);
          fixes.push(`.git: created missing pointer → ${externalStore}`);
        } else {
          return { ok: false, error: 'No .git and no external store. Manual recovery needed.' };
        }
      }

      // ── 2. Check the content/ symlink (Round-5 R7) ──────────────────────
      const contentStat = fs.existsSync(contentPath) ? fs.lstatSync(contentPath) : null;
      if (contentStat && contentStat.isSymbolicLink()) {
        const target = fs.readlinkSync(contentPath);
        if (target === expectedNotesPath) {
          fixes.push('content/: symlink → iCloud notes (correct)');
        } else {
          fixes.push(`content/: WARN — symlink points to ${target} (expected ${expectedNotesPath}). Leaving alone.`);
        }
      } else if (contentStat && contentStat.isDirectory()) {
        fixes.push('content/: WARN — is a real directory, not a symlink. Sync will treat it as the source of truth (likely wrong). Use the relocate flow if needed.');
      } else {
        // content/ missing or broken — recreate symlink
        if (fs.existsSync(expectedNotesPath)) {
          if (contentStat) fs.unlinkSync(contentPath);
          fs.symlinkSync(expectedNotesPath, contentPath);
          fixes.push(`content/: recreated symlink → ${expectedNotesPath}`);
        } else {
          fixes.push(`content/: WARN — missing AND iCloud notes folder not found at ${expectedNotesPath}. Cannot auto-repair.`);
        }
      }

      return { ok: true, action: 'repair', message: fixes.join(' · '), fixes };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── iCloud maintenance ────────────────────────────────────────────────
  ipcMain.handle('get-git-location', () => ({
    ...describeGitLocation(REPO_DIR),
    needsMigration: needsICloudGitMigration(REPO_DIR),
    defaultTarget:  defaultExternalGitPath(),
  }));

  ipcMain.handle('cleanup-dupes', async (_e, { commit } = {}) => {
    const args = [commit ? '--remove' : '--list'];
    if (commit) args.push('--commit');
    const { code, stdout, stderr } = await runScript(CLEANUP_SCRIPT, args, { REPO: REPO_DIR });
    const found = [], removed = [];
    let committed = 0, done = 0;
    const errors = [];
    for (const line of stdout.split('\n')) {
      if (line.startsWith('FOUND:'))     found.push(line.slice(6));
      else if (line.startsWith('REMOVED:')) removed.push(line.slice(8));
      else if (line.startsWith('COMMITTED:')) committed = Number(line.slice(10)) || 0;
      else if (line.startsWith('DONE:'))  done = Number(line.slice(5)) || 0;
      else if (line.startsWith('ERR:'))   errors.push(line.slice(4));
    }
    return { code, found, removed, committed, done, errors, stderr };
  });

  ipcMain.handle('migrate-git', async (_e, { rollback } = {}) => {
    const args = rollback ? ['--rollback'] : [];
    const target = defaultExternalGitPath();
    const { code, stdout, stderr } = await runScript(MIGRATE_SCRIPT, args, {
      REPO:   REPO_DIR,
      TARGET: target,
    });
    const status = [];
    const errors = [];
    const dirty = [];
    let ok = false;
    for (const line of stdout.split('\n')) {
      if (line.startsWith('STATUS:'))      status.push(line.slice(7));
      else if (line.startsWith('ERR:'))    errors.push(line.slice(4));
      else if (line.startsWith('DIRTY:'))  dirty.push(line.slice(6));
      else if (line === 'OK')              ok = true;
    }
    return { code, ok, status, errors, dirty, target, stderr };
  });
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
