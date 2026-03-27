'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_FILE = path.join(os.homedir(), 'Library/Logs/quartz-sync.log');
const LINE_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (.+)$/;
// Matches git push output: "   abc123..def456  main -> main"
const PUSH_SHA_RE = /^\s{1,4}[0-9a-f]+\.\.([0-9a-f]+)\s+\S+\s+->\s+\S+/;

/**
 * Parse the sync log into structured session entries.
 * @returns {Array<{timestamp: Date, status: 'success'|'error'|'skipped', detail: string, errorLines: string[], commitSha: string|null}>}
 *          Sorted newest-first.
 */
function parseLog() {
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
      // Raw output from npx quartz sync / git — keep for SHA extraction
      if (current) currentRawLines.push(line);
      continue;
    }
    const [, dateStr, msg] = m;
    const timestamp = new Date(dateStr.replace(' ', 'T'));

    if (msg === 'Sync started') {
      if (current) {
        current.commitSha = extractSha(currentRawLines);
        sessions.push(current);
      }
      current = { timestamp, status: 'success', detail: 'Synced', errorLines: [] };
      currentRawLines = [];
      continue;
    }

    if (msg === 'Already running, skipping.') {
      if (current) { current.commitSha = extractSha(currentRawLines); sessions.push(current); }
      sessions.push({ timestamp, status: 'skipped', detail: 'Skipped — already running', errorLines: [], commitSha: null });
      current = null; currentRawLines = [];
      continue;
    }
    if (msg === 'No internet connection, skipping sync') {
      if (current) { current.commitSha = extractSha(currentRawLines); sessions.push(current); }
      sessions.push({ timestamp, status: 'skipped', detail: 'Skipped — no internet', errorLines: [], commitSha: null });
      current = null; currentRawLines = [];
      continue;
    }

    if (!current) continue;

    if (msg === 'Sync completed successfully') {
      current.status = 'success';
      current.detail = 'Synced';
    } else if (msg.startsWith('ERROR:')) {
      current.status = 'error';
      current.detail = msg.replace(/^ERROR:\s*/, '');
      current.errorLines.push(msg);
    } else if (msg.startsWith('WARN:')) {
      current.errorLines.push(msg);
    }
  }

  if (current) {
    current.commitSha = extractSha(currentRawLines);
    sessions.push(current);
  }

  return sessions.reverse();
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

module.exports = { getRecentEntries, getAllEntries, LOG_FILE };
