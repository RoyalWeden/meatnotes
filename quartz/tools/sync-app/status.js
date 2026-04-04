'use strict';
const { state, loadSettings, GITHUB_REPO } = require('./state');
const { getLastSyncTime, getPlistInterval } = require('./time-helpers');
const { isAgentLoaded } = require('./plist-manager');
const { openPDFsInContent } = require('./pdf-detector');

function buildStatusPayload() {
  const paused = !isAgentLoaded();
  const lastSync = getLastSyncTime();
  const settings = loadSettings();
  const openPDFs = state.isWaiting ? openPDFsInContent() : [];
  const milestone = state.lastStreakMilestone;
  state.lastStreakMilestone = null;  // consume once sent
  return {
    isSyncing: state.isSyncing,
    isWaiting: state.isWaiting,
    isPaused: paused,
    isQuietHours: state.isQuietHours,
    lastSyncError: state.lastSyncError,
    lastSyncTime: lastSync ? lastSync.toISOString() : null,
    intervalSeconds: getPlistInterval(),
    githubRepo: GITHUB_REPO,
    nextSyncAt: state.nextSyncAt,
    syncStartedAt: state.syncStartedAt,
    syncStreak: settings.syncStreak || 0,
    syncStreakBest: settings.syncStreakBest || 0,
    streakMilestone: milestone || null,
    openPDFs,
    deployStatus: state.deployStatus,
    deployRuns: state.deployRuns,
    hasGithubToken: !!(loadSettings().githubToken || process.env.GITHUB_TOKEN),
    lfsStatus: state.lfsStatus,
    isLfsPulling: state.isLfsPulling,
    lfsEnabled: settings.lfsEnabled !== false,
    lfsBandwidthLimit: settings.lfsBandwidthLimit || null,
    lfsSkipOnMetered: settings.lfsSkipOnMetered || false,
    isMetered: settings.isMetered || false,
  };
}

function pushStatusToWindow() {
  if (state.logWindow && !state.logWindow.isDestroyed()) {
    state.logWindow.webContents.send('sync-status', buildStatusPayload());
  }
}

module.exports = { buildStatusPayload, pushStatusToWindow };
