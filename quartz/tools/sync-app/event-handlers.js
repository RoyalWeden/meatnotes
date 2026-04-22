'use strict';
const { BrowserWindow, dialog } = require('electron');
const { state, loadSettings, saveSettings } = require('./state');
const { runSync, scheduleNextSync } = require('./sync-runner');
const { handlePDFConflict, startWaitingForPDFClose } = require('./pdf-handler');
const { refreshTrayAppearance, notifyIfAllowed } = require('./tray-ui');
const { formatInterval, getPlistInterval } = require('./time-helpers');
const { pushStatusToWindow } = require('./status');
const { isAgentLoaded, invalidateAgentCache, unloadAgent, loadAgent } = require('./plist-manager');
const { hasPDFConflict } = require('./pdf-detector');

// opts: string (legacy commit msg) | { commitMsg, includePdfs }
function handleSyncNow(opts) {
  const normalized = (typeof opts === 'string' || opts == null)
    ? { commitMsg: opts, includePdfs: undefined }
    : opts;
  if (hasPDFConflict()) {
    handlePDFConflict(() => runSync(normalized), () => {}, () => startWaitingForPDFClose());
  } else {
    runSync(normalized);
  }
}

function handlePauseResume() {
  if (isAgentLoaded()) {
    state.pausedRemainingMs = state.nextSyncAt ? Math.max(5000, state.nextSyncAt - Date.now()) : null;
    saveSettings({ ...loadSettings(), pausedRemainingMs: state.pausedRemainingMs });

    unloadAgent();
    invalidateAgentCache();
    clearTimeout(state.nextSyncTimer);
    state.nextSyncTimer = null;
    state.nextSyncAt = null;
    notifyIfAllowed('Quartz Sync', 'Auto-sync paused.');
  } else {
    try {
      loadAgent();
      invalidateAgentCache();
      notifyIfAllowed('Quartz Sync', 'Auto-sync resumed.');
      const s = loadSettings();
      const remaining = s.pausedRemainingMs ?? undefined;
      saveSettings({ ...s, pausedRemainingMs: null });
      state.pausedRemainingMs = null;
      scheduleNextSync(remaining);
    } catch (err) {
      dialog.showErrorBox('Could not resume agent', err.message);
    }
  }
  refreshTrayAppearance();
  state.callbacks.rebuildMenu?.();
  pushStatusToWindow();
}

function handleIntervalChange(seconds) {
  try {
    saveSettings({ ...loadSettings(), intervalSeconds: seconds });
    notifyIfAllowed('Quartz Sync', `Auto-sync interval set to ${formatInterval(seconds)}.`);
    scheduleNextSync(seconds * 1000);
  } catch (err) {
    dialog.showErrorBox('Could not change interval', err.message);
  }
  state.callbacks.rebuildMenu?.();
  pushStatusToWindow();
}

function showCustomIntervalDialog() {
  const current = getPlistInterval();
  const win = new BrowserWindow({
    width: 320, height: 160, resizable: false,
    minimizable: false, maximizable: false, alwaysOnTop: true,
    title: 'Custom Sync Interval',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system;margin:24px;background:#f5f5f7}
    label{font-size:13px;color:#333}
    input{margin-top:8px;width:100%;padding:6px 8px;font-size:14px;border:1px solid #ccc;border-radius:6px}
    .btns{margin-top:16px;display:flex;gap:8px;justify-content:flex-end}
    button{padding:6px 14px;border-radius:6px;border:none;font-size:13px;cursor:pointer}
    #ok{background:#007aff;color:#fff} #cancel{background:#ddd;color:#333}
  </style></head><body>
  <label>Sync interval (minutes):</label>
  <input id="v" type="number" min="1" max="1440" value="${Math.round(current / 60)}" autofocus>
  <div class="btns">
    <button id="cancel" onclick="window.close()">Cancel</button>
    <button id="ok" onclick="submit()">OK</button>
  </div>
  <script>
    const {ipcRenderer}=require('electron');
    function submit(){const v=parseInt(document.getElementById('v').value,10);if(v>0&&v<=1440){ipcRenderer.send('custom-interval',v*60);window.close();}}
    document.getElementById('v').addEventListener('keydown',e=>{if(e.key==='Enter')submit();if(e.key==='Escape')window.close();});
  </script></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.setMenu(null);
}

module.exports = { handleSyncNow, handlePauseResume, handleIntervalChange, showCustomIntervalDialog };
