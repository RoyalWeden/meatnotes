'use strict';
const { Notification } = require('electron');
const { state, loadSettings } = require('./state');
const { refreshTrayAppearance, notifyIfAllowed } = require('./tray-ui');
const { pushStatusToWindow } = require('./status');
const { hasPDFConflict } = require('./pdf-detector');

function handlePDFConflict(onSyncAnyway, onSkip, onWait) {
  const n = new Notification({
    title: 'Quartz Sync',
    body: 'A PDF is open \u2014 sync may overwrite your edits.',
    actions: [
      { type: 'button', text: 'Sync Anyway' },
      { type: 'button', text: 'Skip This Sync' },
      { type: 'button', text: 'Wait for PDF to Close' },
    ],
    closeButtonText: 'Skip',
  });
  n.on('action', (_e, i) => [onSyncAnyway, onSkip, onWait][i]?.());
  n.on('click', onSkip);
  n.show();
}

function startWaitingForPDFClose() {
  state.isWaiting = true;
  refreshTrayAppearance();
  state.callbacks.rebuildMenu?.();
  pushStatusToWindow();

  notifyIfAllowed('Quartz Sync', 'Watching for the PDF to close \u2014 sync will run automatically.');

  state.pdfPollTimer = setInterval(() => {
    if (!hasPDFConflict()) {
      clearInterval(state.pdfPollTimer);
      state.pdfPollTimer = null;
      state.isWaiting = false;
      refreshTrayAppearance();
      state.callbacks.rebuildMenu?.();
      // Lazy require to avoid circular dependency
      const { runSync } = require('./sync-runner');
      runSync();
      notifyIfAllowed('Quartz Sync', 'PDF closed \u2014 syncing now.');
    }
  }, 5000);
}

function showPDFAutoNotification() {
  const nl = loadSettings().notifyLevel || 'errors';
  if (nl === 'never') return;
  const n = new Notification({
    title: 'Sync is patiently waiting\u2026',
    body: 'A PDF is open in your content folder. Sync will run the moment you close it. No action needed \u2014 or choose below.',
    actions: [
      { type: 'button', text: 'Sync Anyway' },
      { type: 'button', text: 'Skip This One' },
    ],
    closeButtonText: 'Auto-waiting\u2026',
  });
  n.on('action', (_e, i) => {
    if (i === 0) {
      clearInterval(state.pdfPollTimer); state.pdfPollTimer = null;
      state.isWaiting = false;
      const { runSync } = require('./sync-runner');
      runSync();
    } else {
      clearInterval(state.pdfPollTimer); state.pdfPollTimer = null;
      state.isWaiting = false;
      refreshTrayAppearance();
      state.callbacks.rebuildMenu?.();
      pushStatusToWindow();
      const { scheduleNextSync } = require('./sync-runner');
      scheduleNextSync();
    }
  });
  n.show();
}

module.exports = { handlePDFConflict, startWaitingForPDFClose, showPDFAutoNotification };
