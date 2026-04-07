'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Constants ──────────────────────────────────────────────────────────────
const REPO_DIR = '/Users/roywe/Library/Mobile Documents/com~apple~CloudDocs/Octarine/workspaces/bible';
const LAST_SYNC_FILE = path.join(REPO_DIR, 'content/.last-sync');
const SYNC_SCRIPT = path.join(os.homedir(), '.local/bin/quartz-sync.sh');
const GITHUB_REPO = 'https://github.com/RoyalWeden/meatnotes';
const SETTINGS_FILE = path.join(os.homedir(), 'Library/Application Support/bible-notes-sync/settings.json');

// ── GitHub API constants ───────────────────────────────────────────────────
const GITHUB_API_OWNER = 'RoyalWeden';
const GITHUB_API_REPO  = 'meatnotes';
const DEPLOY_WORKFLOW_FILE = 'deploy.yml';
const LAST_OUTPUT_FILE = path.join(os.homedir(), 'Library/Logs/quartz-sync-last-output.txt');

const STREAK_MILESTONES = [5, 10, 25, 50, 100];

const SPINNER_FRAMES = ['\u25d0', '\u25d3', '\u25d1', '\u25d2'];

// ── Settings persistence ───────────────────────────────────────────────────
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
  catch { return { notifyLevel: 'errors' }; }
}

function saveSettings(s) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
}

// ── Icon colours (macOS system palette) ───────────────────────────────────
const COLORS = {
  green:  [52,  199, 89],
  yellow: [255, 204, 0],
  red:    [255, 59,  48],
  orange: [255, 149, 0],
  grey:   [142, 142, 147],
  blue:   [10,  132, 255],
};

// ── Mutable state ─────────────────────────────────────────────────────────
const state = {
  tray: null,
  logWindow: null,
  syncProcess: null,
  pdfPollTimer: null,
  menuRefreshTimer: null,
  spinnerTimer: null,
  logWatcher: null,
  spinnerFrame: 0,
  quietHoursTimer: null,

  isSyncing: false,
  isWaiting: false,
  isQuietHours: false,
  lastSyncError: false,
  lfsStatus: null,       // 'success' | 'failed' | 'skipped' | 'unchanged' | null
  isLfsPulling: false,
  lfsPullProcess: null,
  lastNotesChanged: 0,
  notesChangedTimer: null,
  syncOutputOffset: 0,
  lastStreakMilestone: null,

  nextSyncTimer: null,
  nextSyncAt: null,
  syncStartedAt: null,
  pausedRemainingMs: null,
  menuRebuildDebounceTimer: null,
  windowUpdateDebounceTimer: null,

  // Deploy status state
  deployStatus: null,
  deployRuns: [],
  deployPollTimer: null,

  // Last sync output
  lastSyncOutput: '',

  // BibleGateway sync state
  bgSyncWindow: null,
  bgSyncStatus: 'idle',
  bgNoteCount: 0,
  bgProgress: { step: '', completed: 0, total: 0 },
  bgPhase: 'idle',            // 'idle' | 'phase1' | 'phase2' | 'importing'
  bgPhase2Queue: [],          // Chapters remaining to process
  bgPhase2Current: '',        // Currently processing chapter
  bgPhase2Total: 0,           // Total chapters to process
  bgCollectedNotes: [],       // Accumulated Phase 2 results
  bgPhase2StartTime: null,    // When Phase 2 began (Date.now())
  bgPhase2ChapterStart: null, // When current chapter started (Date.now())

  // Site version cache
  cachedSiteVersion: null,

  // Callbacks registry for cross-module function calls (avoids circular requires)
  callbacks: {},
};

module.exports = {
  state,
  loadSettings,
  saveSettings,
  REPO_DIR,
  LAST_SYNC_FILE,
  SYNC_SCRIPT,
  GITHUB_REPO,
  SETTINGS_FILE,
  GITHUB_API_OWNER,
  GITHUB_API_REPO,
  DEPLOY_WORKFLOW_FILE,
  LAST_OUTPUT_FILE,
  STREAK_MILESTONES,
  SPINNER_FRAMES,
  COLORS,
};
