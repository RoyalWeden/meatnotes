'use strict';
const path = require('path');
const { BrowserWindow } = require('electron');
const { state, loadSettings, saveSettings, REPO_DIR } = require('./state');
const { notifyIfAllowed, notifyError } = require('./tray-ui');
const { buildExportScript } = require('./bg-sync');
const { importNotes } = require('./bg-import');

/**
 * BibleGateway Sync Flow:
 *
 * 1. Opens a BrowserWindow to BG's annotations page (with persistent session)
 * 2. User logs in if needed (session partition preserves cookies across restarts)
 * 3. On page load, checks if user is logged in by looking for annotation DOM elements
 * 4. If logged in: injects a postMessage→console.log relay, then injects the export script
 * 5. Export script crawls all annotation pages, sends progress/complete via postMessage
 * 6. The relay forwards postMessage events as console.log('BG:' + JSON.stringify(data))
 * 7. Main process listens for 'console-message' events prefixed with 'BG:'
 * 8. On complete: runs bg-import.js to write .bg-connections.json + BibleGateway Notes.md
 * 9. Saves sync timestamp and note count to settings
 * 10. Closes the BG window after a brief delay
 */

function runBGSync() {
  if (state.bgSyncWindow) {
    state.bgSyncWindow.focus();
    return;
  }

  state.bgSyncStatus = 'login';
  state.callbacks.rebuildMenu?.();

  state.bgSyncWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'BibleGateway Sync',
    webPreferences: {
      // Persistent session so user stays logged in across app restarts
      partition: 'persist:biblegateway',
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  state.bgSyncWindow.loadURL('https://www.biblegateway.com/user/annotations/?iv=notes');

  // Listen for BG messages relayed via console.log
  state.bgSyncWindow.webContents.on('console-message', (_event, _level, message) => {
    if (!message.startsWith('BG:')) return;
    try {
      const data = JSON.parse(message.slice(3));
      handleBGMessage(data);
    } catch {}
  });

  // On each page load: inject the postMessage relay, then check for login
  state.bgSyncWindow.webContents.on('did-finish-load', async () => {
    if (!state.bgSyncWindow || state.bgSyncWindow.isDestroyed()) return;

    // Step 1: Inject the postMessage → console.log relay
    // This must run BEFORE the export script so messages are captured
    await state.bgSyncWindow.webContents.executeJavaScript(`
      window.addEventListener('message', (e) => {
        if (e.data && (e.data.type === 'bg-progress' || e.data.type === 'bg-complete' || e.data.type === 'bg-error')) {
          console.log('BG:' + JSON.stringify(e.data));
        }
      });
    `).catch(() => {});

    // Step 2: Check if we're on the annotations page
    const url = state.bgSyncWindow.webContents.getURL();
    if (!url.includes('/user/annotations')) return;

    // Step 3: Check if we're actually logged in (not redirected to login form)
    const isLoggedIn = await state.bgSyncWindow.webContents.executeJavaScript(`
      !!(document.querySelector('.annotation-item, .note-item, [data-annotation-id], .user-annotation, .user-annotations, .annotation-list') ||
         document.querySelector('.pagination, .pager'))
    `).catch(() => false);

    if (!isLoggedIn) {
      state.bgSyncStatus = 'login';
      state.callbacks.rebuildMenu?.();
      return;
    }

    // Step 4: Start export — inject the crawling script
    state.bgSyncStatus = 'exporting';
    state.callbacks.rebuildMenu?.();

    const script = buildExportScript();
    state.bgSyncWindow.webContents.executeJavaScript(script).catch(() => {});
  });

  state.bgSyncWindow.on('closed', () => {
    state.bgSyncWindow = null;
    if (state.bgSyncStatus === 'login' || state.bgSyncStatus === 'exporting') {
      state.bgSyncStatus = 'idle';
      state.callbacks.rebuildMenu?.();
    }
  });
}

function handleBGMessage(data) {
  if (data.type === 'bg-progress') {
    state.bgProgress = { step: data.step, completed: data.completed || 0, total: data.total || 0 };
    state.bgNoteCount = data.noteCount || state.bgNoteCount;
    // Push progress to log window if open
    if (state.logWindow && !state.logWindow.isDestroyed()) {
      state.logWindow.webContents.send('bg-progress', data);
    }
  } else if (data.type === 'bg-complete') {
    state.bgSyncStatus = 'importing';
    state.bgNoteCount = data.totalNotes || 0;
    state.callbacks.rebuildMenu?.();

    // Run import: writes .bg-connections.json + BibleGateway Notes.md
    const contentDir = path.join(REPO_DIR, 'content');
    try {
      const result = importNotes(data.notes, contentDir);

      // Save sync metadata
      const settings = loadSettings();
      settings.lastBGSync = new Date().toISOString();
      settings.bgNoteCount = data.totalNotes;
      saveSettings(settings);

      state.bgSyncStatus = 'done';
      state.callbacks.rebuildMenu?.();
      notifyIfAllowed('BibleGateway Sync', `Imported ${result.notesCount} notes, ${result.newCount} new connections.`);

      // Close BG window after brief delay so user sees "Complete!" overlay
      if (state.bgSyncWindow && !state.bgSyncWindow.isDestroyed()) {
        setTimeout(() => {
          if (state.bgSyncWindow && !state.bgSyncWindow.isDestroyed()) state.bgSyncWindow.close();
        }, 2000);
      }

      // Push completion to log window
      if (state.logWindow && !state.logWindow.isDestroyed()) {
        state.logWindow.webContents.send('bg-complete', result);
      }
    } catch (e) {
      state.bgSyncStatus = 'error';
      state.callbacks.rebuildMenu?.();
      notifyError('BibleGateway Sync', `Import failed: ${e.message}`);
    }
  } else if (data.type === 'bg-error') {
    state.bgSyncStatus = 'error';
    state.callbacks.rebuildMenu?.();
    notifyError('BibleGateway Sync', data.message || 'Export failed');
  }
}

module.exports = { runBGSync, handleBGMessage };
