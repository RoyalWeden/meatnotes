'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { state, REPO_DIR } = require('./state');
const { refreshTrayAppearance, notifyIfAllowed, notifyError } = require('./tray-ui');
const { pushStatusToWindow } = require('./status');

const LFS_HASH_FILE = path.join(os.homedir(), '.cache/quartz-sync/lfs-hash.txt');

function runLfsPull() {
  if (state.isLfsPulling || state.isSyncing) return;
  state.isLfsPulling = true;
  pushStatusToWindow();
  state.callbacks.rebuildMenu?.();

  const env = { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + process.env.PATH };
  state.lfsPullProcess = spawn('git', ['lfs', 'pull'], { cwd: REPO_DIR, env });

  state.lfsPullProcess.on('close', (code) => {
    state.lfsPullProcess = null;
    state.isLfsPulling = false;
    state.lfsStatus = code === 0 ? 'success' : 'failed';
    if (code === 0) {
      try {
        const hash = execSync(
          `git -C "${REPO_DIR}" lfs ls-files -l 2>/dev/null | cut -d' ' -f1 | sort | shasum -a 256 | cut -d' ' -f1`,
          { encoding: 'utf8', timeout: 10000 }
        ).trim();
        const dir = path.dirname(LFS_HASH_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(LFS_HASH_FILE, hash, 'utf8');
      } catch {}
    }
    pushStatusToWindow();
    state.callbacks.rebuildMenu?.();
    refreshTrayAppearance();
    if (code === 0) notifyIfAllowed('LFS Fetch', 'PDFs downloaded successfully.');
    else notifyError('LFS Fetch Failed', 'Could not download PDF files. Check your connection.');
  });

  state.lfsPullProcess.on('error', () => {
    state.lfsPullProcess = null;
    state.isLfsPulling = false;
    state.lfsStatus = 'failed';
    pushStatusToWindow();
    state.callbacks.rebuildMenu?.();
    refreshTrayAppearance();
    notifyError('LFS Fetch Error', 'Failed to start git lfs pull.');
  });
}

module.exports = { runLfsPull };
