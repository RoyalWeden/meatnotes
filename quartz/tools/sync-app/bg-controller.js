'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { BrowserWindow } = require('electron');
const { state, loadSettings, saveSettings, REPO_DIR } = require('./state');
const { notifyIfAllowed, notifyError } = require('./tray-ui');
const { buildPhase1Script, buildPhase2Script } = require('./bg-sync');
const { importNotes } = require('./bg-import');

/**
 * BibleGateway Sync Flow (Two-Phase):
 *
 * 1. Opens a BrowserWindow to BG's annotations page (with persistent session)
 * 2. If stored credentials exist, auto-fills login form
 * 3. On page load, checks if user is logged in using multiple detection strategies
 * 4. If logged in: injects Phase 1 script (annotations inventory)
 *
 * Phase 1:
 * 5. Crawls all annotation pages, collecting verseRef + date for each note
 * 6. Groups notes by chapter, sends bg-phase1-complete with chapter list
 *
 * Phase 2:
 * 7. For each chapter, navigates to /passage/?search=Chapter&version=KJV
 * 8. Injects Phase 2 script to extract notes from "Your Content" sidebar
 * 9. Collects actual note text (connections, observations) per verse
 * 10. Rate-limits requests with 1.5s delay between chapters
 *
 * Import:
 * 11. Runs bg-import.js to write .bg-connections.json (enriched JSON, no .md)
 * 12. Saves sync timestamp and note count to settings
 * 13. Triggers quartz sync to commit and push
 * 14. Closes the BG window
 */

const DEBUG_LOG_PATH = path.join(os.homedir(), 'Library', 'Logs', 'bg-debug-page.html');

// Track consecutive Phase 2 failures for abort threshold
let phase2ConsecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

// Domains to block during Phase 2 (ads, analytics, tracking, social widgets)
const BLOCKED_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'facebook.net', 'facebook.com/tr', 'fbcdn.net',
  'hotjar.com', 'newrelic.com', 'nr-data.net', 'sentry.io',
  'platform.twitter.com', 'platform.linkedin.com',
  'amazon-adsystem.com', 'adnxs.com', 'adsrvr.org',
  'scorecardresearch.com', 'quantserve.com', 'outbrain.com',
  'taboola.com', 'moatads.com', 'chartbeat.com',
  'pubmatic.com', 'rubiconproject.com', 'openx.net',
  'casalemedia.com', 'indexexchange.com', 'sharethrough.com',
  'criteo.com', 'bidswitch.net', 'demdex.net',
  'rlcdn.com', 'bluekai.com', 'krxd.net',
  'optimizely.com', 'segment.com', 'amplitude.com',
  'branch.io', 'appsflyer.com', 'mxpnl.com',
];

// CSS injected into Phase 2 pages to reduce rendering cost
const PHASE2_LIGHTWEIGHT_CSS = `
  /* Hide all visual content except sidebar */
  .passage-text, .passage-content, .publisher-info-bottom,
  .passage-other-trans, .footnotes, .crossrefs, .full-chap-link,
  .passage-resources, .passage-tools-container, .bg-ad,
  .ad-banner, [class*="ad-"], [id*="google_ads"], iframe,
  .footer, header, nav, .top-bar, .navbar,
  .sidebar-ad, .banner, video, img, svg:not(.arc-svg) {
    display: none !important;
  }
  /* Kill all animations and transitions */
  *, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
    animation-delay: 0s !important;
    transition-delay: 0s !important;
  }
  /* Simplify layout */
  body { overflow: hidden !important; }
`;

function runBGSync(opts = {}) {
  if (state.bgSyncWindow) {
    state.bgSyncWindow.focus();
    return;
  }

  const debug = opts.debug || false;
  state.bgSyncStatus = 'login';
  state.bgPhase = 'idle';
  state.bgCollectedNotes = [];
  state.bgPhase2Queue = [];
  state.bgPhase2Current = '';
  state.bgPhase2Total = 0;
  phase2ConsecutiveFailures = 0;
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
      // Reduce GPU/CPU overhead
      webgl: false,
      enableWebSQL: false,
      spellcheck: false,
    },
  });

  // Block unnecessary resources during Phase 2 to reduce CPU usage
  const ses = state.bgSyncWindow.webContents.session;
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    // Only block during Phase 2 — login and Phase 1 need full page
    if (state.bgPhase !== 'phase2') {
      callback({ cancel: false });
      return;
    }

    const url = details.url;
    const rt = details.resourceType;

    // Always allow page navigation
    if (rt === 'mainFrame' || rt === 'subFrame') {
      callback({ cancel: false });
      return;
    }

    // Block images, media, fonts unconditionally in Phase 2
    if (rt === 'image' || rt === 'media' || rt === 'font') {
      callback({ cancel: true });
      return;
    }

    // Block known ad/tracking domains (scripts, stylesheets, XHR, everything)
    const blocked = BLOCKED_DOMAINS.some(d => url.includes(d));
    callback({ cancel: blocked });
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
          sendToLogWindow('bg-progress', {
            step: 'debug',
            message: `Debug HTML saved to ${DEBUG_LOG_PATH}`,
          });
        } catch (e) {
          console.error('[BG Debug] Failed to save:', e.message);
        }
        return;
      }
      handleBGMessage(data);
    } catch {}
  });

  // On each page load: inject the postMessage relay, then check context
  state.bgSyncWindow.webContents.on('did-finish-load', async () => {
    if (!state.bgSyncWindow || state.bgSyncWindow.isDestroyed()) return;

    // Always inject the postMessage → console.log relay
    await state.bgSyncWindow.webContents.executeJavaScript(`
      window.addEventListener('message', (e) => {
        if (e.data && (
          e.data.type === 'bg-progress' ||
          e.data.type === 'bg-complete' ||
          e.data.type === 'bg-error' ||
          e.data.type === 'bg-debug' ||
          e.data.type === 'bg-phase1-complete' ||
          e.data.type === 'bg-phase2-result'
        )) {
          console.log('BG:' + JSON.stringify(e.data));
        }
      });
    `).catch(() => {});

    const url = state.bgSyncWindow.webContents.getURL();

    // ── Phase 2: If we're on a passage page and in phase2, inject extraction script ──
    if (state.bgPhase === 'phase2' && url.includes('/passage/')) {
      console.log(`[BG Sync] Phase 2: Loaded passage page for "${state.bgPhase2Current}"`);
      // Inject lightweight CSS to hide heavy visual elements and kill animations
      state.bgSyncWindow.webContents.insertCSS(PHASE2_LIGHTWEIGHT_CSS).catch(() => {});
      const script = buildPhase2Script(state.bgPhase2Current);
      state.bgSyncWindow.webContents.executeJavaScript(script).catch(() => {});
      return;
    }

    // ── Login flow: only for annotations/user pages ──
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
                emailInput.value = ${JSON.stringify(loadSettings().bgUsername)};
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                passInput.value = ${JSON.stringify(loadSettings().bgPassword)};
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
                const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], .login-btn, .sign-in-btn, button.btn-primary');
                if (submitBtn) submitBtn.click();
              }
            })();
          `).catch(() => {});
          return;
        }
        state.bgSyncStatus = 'login';
        state.callbacks.rebuildMenu?.();
        return;
      }
    }

    // ── Annotations page: check login then start Phase 1 ──
    if (!url.includes('/user/annotations') && !url.includes('/user/')) return;

    // Debug mode: capture HTML
    if (debug) {
      await state.bgSyncWindow.webContents.executeJavaScript(`
        window.postMessage({ type: 'bg-debug', html: document.documentElement.outerHTML.slice(0, 500000) }, '*');
      `).catch(() => {});
    }

    // Check if logged in
    const loginState = await state.bgSyncWindow.webContents.executeJavaScript(`
      (function() {
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
        const hasPagination = !!(
          document.querySelector('.info-viewer-pager, .pagination, .pager, [data-page], .page-numbers') ||
          document.querySelector('a[href*="page="], a[href*="&i="]')
        );
        const hasLogout = !!(
          document.querySelector('a[href*="logout"], a[href*="sign-out"], .logout, .sign-out') ||
          document.querySelector('.user-menu, .user-dropdown, .account-menu')
        );
        const hasEmptyState = !!(
          document.querySelector('.no-annotations, .empty-state, .no-results') ||
          document.body.textContent.includes('No annotations') ||
          document.body.textContent.includes('no notes')
        );
        return { hasAnnotations, hasPagination, hasLogout, hasEmptyState,
          url: window.location.href, title: document.title };
      })();
    `).catch(() => ({ hasAnnotations: false, hasPagination: false, hasLogout: false, hasEmptyState: false }));

    console.log('[BG Sync] Login detection:', JSON.stringify(loginState));

    const isLoggedIn = loginState.hasAnnotations || loginState.hasPagination || loginState.hasLogout || loginState.hasEmptyState;

    if (!isLoggedIn) {
      state.bgSyncStatus = 'login';
      state.callbacks.rebuildMenu?.();
      return;
    }

    // Start Phase 1 — inject the annotations inventory script
    state.bgSyncStatus = 'exporting';
    state.bgPhase = 'phase1';
    state.callbacks.rebuildMenu?.();

    console.log('[BG Sync] Phase 1: Starting annotations inventory...');
    sendToLogWindow('bg-progress', {
      step: 'phase1-start',
      message: 'Phase 1: Scanning annotations listing...',
    });

    const script = buildPhase1Script();
    state.bgSyncWindow.webContents.executeJavaScript(script).catch(() => {});
  });

  state.bgSyncWindow.on('closed', () => {
    state.bgSyncWindow = null;
    if (state.bgSyncStatus === 'login' || state.bgSyncStatus === 'exporting') {
      state.bgSyncStatus = 'idle';
      state.bgPhase = 'idle';
      state.callbacks.rebuildMenu?.();
    }
  });
}

/**
 * Send data to the log window if it's open.
 */
function sendToLogWindow(channel, data) {
  if (state.logWindow && !state.logWindow.isDestroyed()) {
    state.logWindow.webContents.send(channel, data);
  }
}

/**
 * Process the next chapter in the Phase 2 queue.
 * Navigates the BrowserWindow to the passage page for the chapter.
 */
function processPhase2Queue() {
  if (!state.bgSyncWindow || state.bgSyncWindow.isDestroyed()) {
    console.log('[BG Sync] Phase 2: Window closed, aborting');
    finalizeBGSync();
    return;
  }

  if (state.bgPhase2Queue.length === 0) {
    console.log('[BG Sync] Phase 2: All chapters processed');
    finalizeBGSync();
    return;
  }

  const chapter = state.bgPhase2Queue.shift();
  state.bgPhase2Current = chapter;
  state.bgPhase2ChapterStart = Date.now();

  const completed = state.bgPhase2Total - state.bgPhase2Queue.length - 1;
  const pct = Math.round((completed / state.bgPhase2Total) * 100);

  console.log(`[BG Sync] Phase 2: Processing "${chapter}" (${completed + 1}/${state.bgPhase2Total})`);
  sendToLogWindow('bg-progress', {
    step: 'phase2-navigate',
    message: `Phase 2: Loading ${chapter} (${completed + 1}/${state.bgPhase2Total})`,
    chapter,
    completed: completed + 1,
    total: state.bgPhase2Total,
    notesCollected: state.bgCollectedNotes.length,
    pct,
  });

  // Navigate to the passage page — did-finish-load will inject Phase 2 script
  const searchTerm = encodeURIComponent(chapter);
  state.bgSyncWindow.loadURL(`https://www.biblegateway.com/passage/?search=${searchTerm}&version=KJV`);
}

/**
 * Finalize the BG sync: run import, save settings, trigger quartz sync.
 */
function finalizeBGSync() {
  state.bgSyncStatus = 'importing';
  state.bgPhase = 'importing';
  state.callbacks.rebuildMenu?.();

  const contentDir = path.join(REPO_DIR, 'content');
  const totalNotes = state.bgCollectedNotes.length;

  console.log(`[BG Sync] Importing ${totalNotes} notes...`);
  sendToLogWindow('bg-progress', {
    step: 'importing',
    message: `Importing ${totalNotes} notes into .bg-connections.json...`,
  });

  try {
    const result = importNotes(state.bgCollectedNotes, contentDir);

    // Save sync metadata
    const settings = loadSettings();
    settings.lastBGSync = new Date().toISOString();
    settings.bgNoteCount = totalNotes;
    saveSettings(settings);

    state.bgSyncStatus = 'done';
    state.bgPhase = 'idle';
    state.callbacks.rebuildMenu?.();

    // Detailed completion log
    console.log(`[BG Sync] Import complete:`)
    console.log(`  ${result.notesCount} notes, ${result.connectionsCount} verse connections`);
    console.log(`  ${result.details.notesWithConnections} notes with connections`);
    console.log(`  ${result.details.notesWithObservationsOnly} notes with observations only`);
    console.log(`  ${result.details.notesWithNothing} notes with no parseable content`);

    if (result.details.sampleConnections.length > 0) {
      console.log('  Sample connections:');
      for (const s of result.details.sampleConnections) {
        console.log(`    ${s.verse} → ${s.connections.join(', ')}${s.observation ? ` (${s.observation})` : ''}`);
      }
    }

    notifyIfAllowed('BibleGateway Sync',
      `Imported ${result.notesCount} notes, ${result.connectionsCount} connections.`);

    sendToLogWindow('bg-complete', {
      ...result,
      message: `Import complete: ${result.notesCount} notes, ${result.connectionsCount} connections`,
    });

    // Trigger a sync to commit and push the BG data
    const { runSync } = require('./sync-runner');
    runSync('BibleGateway sync: imported ' + result.notesCount + ' notes');

    // Close BG window after brief delay
    if (state.bgSyncWindow && !state.bgSyncWindow.isDestroyed()) {
      setTimeout(() => {
        if (state.bgSyncWindow && !state.bgSyncWindow.isDestroyed()) state.bgSyncWindow.close();
      }, 2000);
    }
  } catch (e) {
    state.bgSyncStatus = 'error';
    state.bgPhase = 'idle';
    state.callbacks.rebuildMenu?.();
    notifyError('BibleGateway Sync', `Import failed: ${e.message}`);
    console.error('[BG Sync] Import error:', e);
    // Show window again on error so user can see what happened
    if (state.bgSyncWindow && !state.bgSyncWindow.isDestroyed()) {
      state.bgSyncWindow.show();
    }
  }
}

function handleBGMessage(data) {
  if (data.type === 'bg-progress') {
    state.bgProgress = { step: data.step, completed: data.completed || 0, total: data.total || 0 };
    state.bgNoteCount = data.noteCount || state.bgNoteCount;
    sendToLogWindow('bg-progress', data);

  } else if (data.type === 'bg-phase1-complete') {
    // Phase 1 done — start Phase 2
    const chapters = data.chapters || [];
    const totalNotes = data.totalNotes || 0;

    console.log(`[BG Sync] Phase 1 complete: ${totalNotes} notes across ${chapters.length} chapters`);
    sendToLogWindow('bg-progress', {
      step: 'phase1-complete',
      message: `Phase 1 complete: ${totalNotes} notes across ${chapters.length} chapters`,
      chapters: chapters.length,
      totalNotes,
    });

    // Set up Phase 2 queue
    state.bgPhase = 'phase2';
    state.bgPhase2Queue = [...chapters];
    state.bgPhase2Total = chapters.length;
    state.bgCollectedNotes = [];
    state.bgPhase2StartTime = Date.now();
    phase2ConsecutiveFailures = 0;

    // Hide the window during Phase 2 — user doesn't need to see passage pages
    // Keep backgroundThrottling off so our extraction timers aren't clamped
    if (state.bgSyncWindow && !state.bgSyncWindow.isDestroyed()) {
      state.bgSyncWindow.hide();
      state.bgSyncWindow.webContents.setBackgroundThrottling(false);
    }

    sendToLogWindow('bg-progress', {
      step: 'phase2-start',
      message: `Phase 2: Extracting notes from ${chapters.length} chapters`,
      total: chapters.length,
      totalExpectedNotes: totalNotes,
      phase2StartTime: state.bgPhase2StartTime,
    });

    // Start processing chapters with a small delay
    setTimeout(() => processPhase2Queue(), 1000);

  } else if (data.type === 'bg-phase2-result') {
    // Got notes for one chapter
    const chapter = data.chapter || state.bgPhase2Current;
    const notes = data.notes || [];
    const completed = state.bgPhase2Total - state.bgPhase2Queue.length;

    // Accumulate notes
    state.bgCollectedNotes.push(...notes);
    phase2ConsecutiveFailures = 0; // Reset on success

    const chapterDuration = Date.now() - (state.bgPhase2ChapterStart || Date.now());

    console.log(`[BG Sync] Phase 2: "${chapter}" → ${notes.length} notes (total: ${state.bgCollectedNotes.length}) [${chapterDuration}ms]`);

    // Show what connections are being found
    const preview = notes.slice(0, 3).map(n =>
      `${n.verseRef}: ${(n.text || '').slice(0, 50)}${(n.text || '').length > 50 ? '...' : ''}`
    ).join(' | ');

    sendToLogWindow('bg-progress', {
      step: 'phase2-result',
      message: `${chapter}: ${notes.length} notes found`,
      chapter,
      chapterNotes: notes.length,
      completed,
      total: state.bgPhase2Total,
      notesCollected: state.bgCollectedNotes.length,
      preview,
      pct: Math.round((completed / state.bgPhase2Total) * 100),
      chapterDuration,
      phase2StartTime: state.bgPhase2StartTime,
    });

    if (data.timeout) {
      console.log(`[BG Sync] Phase 2: "${chapter}" timed out (may have no notes)`);
    }

    // Rate limit: wait 1.5s before next chapter
    setTimeout(() => processPhase2Queue(), 1500);

  } else if (data.type === 'bg-error') {
    // Handle errors during Phase 2 — skip chapter and continue
    if (state.bgPhase === 'phase2') {
      phase2ConsecutiveFailures++;
      console.error(`[BG Sync] Phase 2 error (${phase2ConsecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, data.message);

      sendToLogWindow('bg-progress', {
        step: 'phase2-error',
        message: `Error on "${state.bgPhase2Current}": ${data.message}`,
        chapter: state.bgPhase2Current,
        consecutiveFailures: phase2ConsecutiveFailures,
        completed: state.bgPhase2Total - state.bgPhase2Queue.length,
        total: state.bgPhase2Total,
      });

      if (phase2ConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error('[BG Sync] Too many consecutive failures, aborting Phase 2');
        notifyError('BibleGateway Sync',
          `Aborted after ${MAX_CONSECUTIVE_FAILURES} consecutive errors. Importing ${state.bgCollectedNotes.length} notes collected so far.`);
        finalizeBGSync();
      } else {
        // Skip this chapter, continue with next
        setTimeout(() => processPhase2Queue(), 2000);
      }
    } else {
      state.bgSyncStatus = 'error';
      state.bgPhase = 'idle';
      state.callbacks.rebuildMenu?.();
      notifyError('BibleGateway Sync', data.message || 'Export failed');
    }

  } else if (data.type === 'bg-complete') {
    // Legacy single-phase complete — shouldn't fire in new flow but handle gracefully
    state.bgSyncStatus = 'importing';
    state.bgNoteCount = data.totalNotes || 0;
    state.bgCollectedNotes = data.notes || [];
    state.callbacks.rebuildMenu?.();
    finalizeBGSync();
  }
}

module.exports = { runBGSync, handleBGMessage };
