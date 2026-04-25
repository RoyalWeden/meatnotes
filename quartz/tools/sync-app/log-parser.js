'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { state } = require('./state');

const LOG_FILE = path.join(os.homedir(), 'Library/Logs/quartz-sync.log');
const REPO_DIR = '/Users/roywe/Code/Octarine/bible';
const LINE_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (.+)$/;
// Matches git push output: "   abc123..def456  main -> main"
const PUSH_SHA_RE = /^\s{1,4}[0-9a-f]+\.\.([0-9a-f]+)\s+\S+\s+->\s+\S+/;
// Matches LFS status markers emitted by sync.sh
const LFS_STATUS_RE = /^LFS_STATUS:(success|failed|skipped|unchanged)$/;
// Matches structured stage markers emitted by the v2 shell script:
//   STAGE:pull, STAGE:build, STAGE:commit, STAGE:lfs_push, STAGE:lfs_skipped,
//   STAGE:git_push, STAGE:done, STAGE:error
const STAGE_RE = /^STAGE:([a-z_]+)$/;

// Cache enriched git data by SHA — git history never changes, so this is permanent
const enrichCache = new Map();

// Parse cache — keyed by log file mtime to avoid re-parsing unchanged files
let parseCache = null; // { mtimeMs, sessions }

/**
 * Try to get commit message and files-changed stat for a given SHA.
 * Results are cached permanently by SHA — git history never changes.
 */
function enrichEntry(entry) {
  if (!entry.commitSha) return;
  if (enrichCache.has(entry.commitSha)) {
    Object.assign(entry, enrichCache.get(entry.commitSha));
    return;
  }
  try {
    const commitMessage = execSync(
      `git -C "${REPO_DIR}" log -1 --format=%s ${entry.commitSha} 2>/dev/null`,
      { timeout: 3000 }
    ).toString().trim();

    const stat = execSync(
      `git -C "${REPO_DIR}" diff-tree --no-commit-id -r --stat ${entry.commitSha} 2>/dev/null`,
      { timeout: 3000 }
    ).toString().trim();

    let filesChanged;
    if (stat) {
      // Last line: "3 files changed, 20 insertions(+), 5 deletions(-)"
      // Compact to: "3 files  +20  -5"
      const summary = stat.split('\n').pop() || '';
      const fMatch = summary.match(/(\d+) file/);
      const iMatch = summary.match(/(\d+) insertion/);
      const dMatch = summary.match(/(\d+) deletion/);
      const parts = [];
      if (fMatch) parts.push(`${fMatch[1]} file${fMatch[1] === '1' ? '' : 's'}`);
      if (iMatch) parts.push(`+${iMatch[1]}`);
      if (dMatch) parts.push(`-${dMatch[1]}`);
      filesChanged = parts.join('  ');
    }

    // Per-file diff list
    let fileList;
    try {
      const numstatRaw = execSync(
        `git -C "${REPO_DIR}" diff-tree --no-commit-id -r --numstat ${entry.commitSha} -- content/ 2>/dev/null`,
        { encoding: 'utf8', timeout: 3000 }
      ).trim();
      if (numstatRaw) {
        fileList = numstatRaw.split('\n').filter(Boolean).map(line => {
          const [add, del, filePath] = line.split('\t');
          return { add: parseInt(add) || 0, del: parseInt(del) || 0, path: filePath || '' };
        });
      }
    } catch {}

    const cached = { commitMessage, filesChanged, fileList };
    enrichCache.set(entry.commitSha, cached);
    Object.assign(entry, cached);
  } catch {
    // git not available or SHA not found -- skip enrichment
  }
}

/**
 * Parse the sync log into structured session entries.
 * Results are cached by log file mtime — the full parse (including all git enrichment)
 * only runs when the file actually changes.
 * @returns {Array<{timestamp: Date, status: 'success'|'error'|'skipped', detail: string,
 *                  errorLines: string[], commitSha: string|null,
 *                  commitMessage?: string, filesChanged?: string, fileList?: Array}>}
 *          Sorted newest-first.
 */
function parseLog() {
  // Check mtime before reading — skip entirely if file hasn't changed
  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(LOG_FILE).mtimeMs; } catch { return parseCache?.sessions ?? []; }
  if (parseCache && parseCache.mtimeMs === mtimeMs) return parseCache.sessions;

  let raw;
  try {
    raw = fs.readFileSync(LOG_FILE, 'utf8');
  } catch {
    return [];
  }

  const lines = raw.split('\n').filter(Boolean);
  const sessions = [];
  let current = null;
  let currentRawLines = [];

  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) {
      // Untimestamped lines (rsync output, npm output, etc.) accumulate
      // into the current stage's bucket so the accordion can show them.
      if (current) {
        currentRawLines.push(line);
        if (current.currentStage) {
          (current.stageLines[current.currentStage] = current.stageLines[current.currentStage] || []).push(line);
        }
      }
      continue;
    }
    const [, dateStr, msg] = m;
    const timestamp = new Date(dateStr.replace(' ', 'T'));

    if (msg === 'Sync started') {
      if (current) {
        current.commitSha = extractSha(currentRawLines);
        enrichEntry(current);
        sessions.push(current);
      }
      current = { timestamp, startTimestamp: timestamp, status: 'running', detail: 'In progress', errorLines: [], stageTimestamps: {}, stageLines: {} };
      currentRawLines = [];
      continue;
    }

    if (msg === 'Already running, skipping.') {
      // Do NOT push/reset `current` — it is still in progress and will complete later.
      sessions.push({ timestamp, status: 'skipped', subtype: 'already-running', detail: 'Skipped — already running', errorLines: [], commitSha: null });
      continue;
    }
    if (msg === 'No internet connection, skipping sync') {
      if (current) { current.commitSha = extractSha(currentRawLines); enrichEntry(current); sessions.push(current); }
      sessions.push({ timestamp, status: 'skipped', subtype: 'no-internet', detail: 'Skipped — no internet', errorLines: [], commitSha: null });
      current = null; currentRawLines = [];
      continue;
    }

    if (!current) continue;

    // Bucket every timestamped log line into the active stage's section so
    // the accordion expansion in the renderer can show what each stage did.
    if (current.currentStage) {
      (current.stageLines[current.currentStage] = current.stageLines[current.currentStage] || []).push(`[${dateStr}] ${msg}`);
    } else {
      // Pre-stage lines (e.g., "Sync started", "Plan: ...") go into a
      // synthetic 'init' bucket so they aren't lost.
      (current.stageLines['init'] = current.stageLines['init'] || []).push(`[${dateStr}] ${msg}`);
    }

    // Track LFS status within the session
    const lfsMatch = msg.match(LFS_STATUS_RE);
    if (lfsMatch) {
      current.lfsStatus = lfsMatch[1];
      continue;
    }

    // Track pipeline stage transitions within the session
    const stageMatch = msg.match(STAGE_RE);
    if (stageMatch) {
      const stage = stageMatch[1];
      current.stageTimestamps = current.stageTimestamps || {};
      // Close out previous running stage, open new one.
      const prev = current.currentStage;
      if (prev && current.stageTimestamps[prev] && !current.stageTimestamps[prev].end) {
        current.stageTimestamps[prev].end = timestamp;
      }
      current.stageTimestamps[stage] = { start: timestamp };
      current.currentStage = stage;
      current.pipelineStage = stage;
      continue;
    }

    if (msg === 'Sync completed successfully') {
      current.durationSeconds = Math.round((timestamp - current.startTimestamp) / 1000);
      if (current.lfsStatus === 'failed') {
        current.status = 'partial';
        current.detail = 'Synced (PDFs failed)';
      } else {
        current.status = 'success';
        current.detail = 'Synced';
      }
    } else if (msg.startsWith('ERROR:')) {
      current.status = 'error';
      current.detail = msg.replace(/^ERROR:\s*/, '');
      current.errorLines.push(msg);
      current.durationSeconds = Math.round((timestamp - current.startTimestamp) / 1000);
    } else if (msg.startsWith('WARN:')) {
      current.errorLines.push(msg);
    }
  }

  if (current) {
    current.commitSha = extractSha(currentRawLines);
    enrichEntry(current);
    sessions.push(current);
  }

  // Mark stale "running" sessions. Round-5 R4: per-user, an entry should
  // stop saying "running" once a later sync has started OR enough time has
  // passed that the script must be dead. Two distinct cases:
  //   1. A NEWER session exists after this one — the older one was clearly
  //      not closed cleanly. Mark it as 'interrupted' (orange pill, calmer
  //      than 'error' since it didn't necessarily crash — could be a normal
  //      kill from app quit).
  //   2. Even the newest session is "running" but older than ~5 min and
  //      no sync process is currently alive — same outcome.
  // Note: the live in-flight sync (process still alive) is left alone — the
  // renderer relies on isSyncing to display its progressive state.
  const FIVE_MIN = 5 * 60 * 1000;
  const now = Date.now();
  const liveProcess = state.syncProcess != null;
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (s.status !== 'running') continue;
    const isNewest = (i === sessions.length - 1);
    const olderSiblingExists = !isNewest;
    const ageMs = s.startTimestamp ? (now - s.startTimestamp.getTime()) : Infinity;
    if (olderSiblingExists) {
      s.status = 'interrupted';
      s.detail = 'Interrupted (a newer sync started)';
    } else if (!liveProcess && ageMs > FIVE_MIN) {
      s.status = 'interrupted';
      s.detail = 'Interrupted (process exited without completion marker)';
    }
  }

  const result = sessions.reverse();
  parseCache = { mtimeMs, sessions: result };
  return result;
}

function extractSha(rawLines) {
  for (const line of rawLines) {
    const m = line.match(PUSH_SHA_RE);
    if (m) return m[1];
  }
  return null;
}

function getRecentEntries(n = 5) {
  return parseLog().slice(0, n);
}

function getAllEntries() {
  return parseLog();
}

function invalidateLogCache() { parseCache = null; }

module.exports = { getRecentEntries, getAllEntries, invalidateLogCache, LOG_FILE };
