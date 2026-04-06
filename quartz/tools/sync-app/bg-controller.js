'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { BrowserWindow } = require('electron');
const { state, loadSettings, saveSettings, REPO_DIR } = require('./state');
const { notifyIfAllowed, notifyError } = require('./tray-ui');
const { buildExportScript } = require('./bg-sync');
const { importNotes } = require('./bg-import');

/**
 * BibleGateway Sync Flow:
 *
 * 1. Opens a BrowserWindow to BG's annotations page (with persistent session)
 * 2. If stored credentials exist, auto-fills login form
 * 3. On page load, checks if user is logged in using multiple detection strategies
 * 4. If logged in: injects a postMessage→console.log relay, then injects the export script
 * 5. Export script crawls all annotation pages, sends progress/complete via postMessage
 * 6. The relay forwards postMessage events as console.log('BG:' + JSON.stringify(data))
 * 7. Main process listens for 'console-message' events prefixed with 'BG:'
 * 8. On complete: runs bg-import.js to write .bg-connections.json + BibleGateway Notes.md
 * 9. Saves sync timestamp and note count to settings
 * 10. Closes the BG window after a brief delay
 */

const DEBUG_LOG_PATH = path.join(os.homedir(), 'Library', 'Logs', 'bg-debug-page.html');

function runBGSync(opts = {}) {
  if (state.bgSyncWindow) {
    state.bgSyncWindow.focus();
    return;
  }

  const debug = opts.debug || false;
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

  let autoLoginAttempted = false;

  // Listen for BG messages relayed via console.log
  state.bgSyncWindow.webContents.on('console-message', (_event, _level, message) => {
    if (!message.startsWith('BG:')) return;
    try {
      const data = JSON.parse(message.slice(3));
      if (data.type === 'bg-debug') {
        // Save debug HTML to file
        try {
          fs.writeFileSync(DEBUG_LOG_PATH, data.html || '(empty)');
          console.log(`[BG Debug] Page HTML saved to ${DEBUG_LOG_PATH}`);
          if (state.logWindow && !state.logWindow.isDestroyed()) {
            state.logWindow.webContents.send('bg-progress', {
              step: 'debug',
              message: `Debug HTML saved to ${DEBUG_LOG_PATH}`,
            });
          }
        } catch (e) {
          console.error('[BG Debug] Failed to save:', e.message);
        }
        return;
      }
      handleBGMessage(data);
    } catch {}
  });

  // On each page load: inject the postMessage relay, then check for login
  state.bgSyncWindow.webContents.on('did-finish-load', async () => {
    if (!state.bgSyncWindow || state.bgSyncWindow.isDestroyed()) return;

    // Step 1: Inject the postMessage → console.log relay
    await state.bgSyncWindow.webContents.executeJavaScript(`
      window.addEventListener('message', (e) => {
        if (e.data && (e.data.type === 'bg-progress' || e.data.type === 'bg-complete' || e.data.type === 'bg-error' || e.data.type === 'bg-debug')) {
          console.log('BG:' + JSON.stringify(e.data));
        }
      });
    `).catch(() => {});

    const url = state.bgSyncWindow.webContents.getURL();

    // Step 2: If we're on a login page, try auto-login with stored credentials
    if (!autoLoginAttempted) {
      const isLoginPage = await state.bgSyncWindow.webContents.executeJavaScript(`
        !!(document.querySelector('input[type="email"], input[name="email"], input[name="username"], #email, #username') &&
           document.querySelector('input[type="password"]'))
      `).catch(() => false);

      if (isLoginPage) {
        const settings = loadSettings();
        if (settings.bgUsername && settings.bgPassword) {
          autoLoginAttempted = true;
          console.log('[BG Sync] Auto-login: filling credentials...');
          await state.bgSyncWindow.webContents.executeJavaScript(`
            (function() {
              const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="username"], #email, #username');
              const passInput = document.querySelector('input[type="password"]');
              if (emailInput && passInput) {
                emailInput.value = ${JSON.stringify(settings.bgUsername)};
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                passInput.value = ${JSON.stringify(settings.bgPassword)};
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
                // Find and click submit button
                const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], .login-btn, .sign-in-btn, button.btn-primary');
                if (submitBtn) submitBtn.click();
              }
            })();
          `).catch(() => {});
          // Wait for page to reload after login — the did-finish-load event will fire again
          return;
        }
        // No stored credentials — user must log in manually
        state.bgSyncStatus = 'login';
        state.callbacks.rebuildMenu?.();
        return;
      }
    }

    // Step 3: Check if we're on the annotations page
    if (!url.includes('/user/annotations') && !url.includes('/user/')) return;

    // Step 4: If debug mode, capture the page HTML first
    if (debug) {
      await state.bgSyncWindow.webContents.executeJavaScript(`
        window.postMessage({ type: 'bg-debug', html: document.documentElement.outerHTML.slice(0, 500000) }, '*');
      `).catch(() => {});
    }

    // Step 5: Check if we're actually logged in using multiple detection strategies
    const loginState = await state.bgSyncWindow.webContents.executeJavaScript(`
      (function() {
        // Strategy 1: Look for annotation-specific elements (various BG versions)
        const annotationSelectors = [
          'article.bible-item', '.bible-item', '.annotations-list',
          '.annotation-item', '.note-item', '[data-annotation-id]',
          '.user-annotation', '.user-annotations', '.annotation-list',
          '.notes-list', '.highlights-list', '.bookmark-list',
          '.annotation-row', '.note-row', '.user-note',
          'table.annotations', '.annotation-table',
          '.activity-item', '.activity-list',
        ];
        const hasAnnotations = annotationSelectors.some(s => document.querySelector(s));

        // Strategy 2: Look for pagination (means we have content)
        const hasPagination = !!(
          document.querySelector('.info-viewer-pager, .pagination, .pager, [data-page], .page-numbers') ||
          document.querySelector('a[href*="page="], a[href*="&i="]')
        );

        // Strategy 3: Look for logout link (means we're logged in)
        const hasLogout = !!(
          document.querySelector('a[href*="logout"], a[href*="sign-out"], .logout, .sign-out') ||
          document.querySelector('.user-menu, .user-dropdown, .account-menu')
        );

        // Strategy 4: Check for empty state message (logged in but no notes)
        const hasEmptyState = !!(
          document.querySelector('.no-annotations, .empty-state, .no-results') ||
          document.body.textContent.includes('No annotations') ||
          document.body.textContent.includes('no notes')
        );

        // Count potential note elements for debugging
        const allLinks = document.querySelectorAll('a[href*="passage"]');
        const allTables = document.querySelectorAll('table');
        const allLists = document.querySelectorAll('ul, ol');

        return {
          hasAnnotations,
          hasPagination,
          hasLogout,
          hasEmptyState,
          passageLinks: allLinks.length,
          tables: allTables.length,
          lists: allLists.length,
          url: window.location.href,
          title: document.title,
        };
      })();
    `).catch(() => ({ hasAnnotations: false, hasPagination: false, hasLogout: false, hasEmptyState: false }));

    console.log('[BG Sync] Login detection:', JSON.stringify(loginState));

    const isLoggedIn = loginState.hasAnnotations || loginState.hasPagination || loginState.hasLogout || loginState.hasEmptyState;

    if (!isLoggedIn) {
      state.bgSyncStatus = 'login';
      state.callbacks.rebuildMenu?.();
      return;
    }

    // Step 6: Start export — inject the crawling script
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

      // Trigger a sync to commit and push the BG data
      const { runSync } = require('./sync-runner');
      runSync('BibleGateway sync: imported ' + result.notesCount + ' notes');

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
