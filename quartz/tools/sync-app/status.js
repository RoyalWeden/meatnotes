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
    deployJobs: state.deployJobs || [],
    hasGithubToken: !!(loadSettings().githubToken || process.env.GITHUB_TOKEN),
    lfsStatus: state.lfsStatus,
    isLfsPulling: state.isLfsPulling,
    lfsEnabled: settings.lfsEnabled !== false,
    lfsBandwidthLimit: settings.lfsBandwidthLimit || null,
    lfsSkipOnMetered: settings.lfsSkipOnMetered || false,
    isMetered: settings.isMetered || false,
    // v2 pipeline + quota fields
    pipelineStage: state.pipelineStage || null,
    stageTimestamps: state.stageTimestamps || {},
    lfsQuota: state.lfsQuota || null,
    pendingPdfChanges: state.pendingPdfChanges || null,
    includePdfsByDefault: !!settings.includePdfsByDefault,
    lfsDailyCapBytes: settings.lfsDailyCapBytes || 0,
    lfsMonthlyCapBytes: settings.lfsMonthlyCapBytes || 0,
    lfsQuotaThreshold: settings.lfsQuotaThreshold ?? 0.8,
    bgSyncStatus: state.bgSyncStatus || 'idle',
  };
}

function pushStatusToWindow() {
  const payload = buildStatusPayload();
  if (state.logWindow && !state.logWindow.isDestroyed()) {
    state.logWindow.webContents.send('sync-status', payload);
  }
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('sync-status', payload);
  }
}

module.exports = { buildStatusPayload, pushStatusToWindow };
