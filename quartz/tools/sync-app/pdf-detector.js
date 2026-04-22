'use strict';
const { execSync } = require('child_process');
const path = require('path');
const { REPO_DIR } = require('./state');

const CONTENT_PATH = path.join(REPO_DIR, 'content');

// Processes that hold file handles but aren't "user opened" — indexing, thumbnailing, etc.
const SYSTEM_PROC_PATTERN = /^(mds|mdworker|Spotlight|com\.apple\.|quicklookd|fseventsd|notifyd|lsd|cfprefsd|distnoted|sandboxd)/;

/**
 * Returns list of PDF file paths inside content/ that are currently open by a
 * real user-facing process (not macOS indexing/thumbnail daemons).
 */
function openPDFsInContent() {
  try {
    // lsof +D lists all open files under a directory recursively
    // We parse: COMMAND, PID, and filename (last field) from each line
    const out = execSync(`lsof +D "${CONTENT_PATH}" 2>/dev/null`, { encoding: 'utf8', timeout: 8000 });
    const paths = [];
    const lines = out.split('\n').slice(1); // skip header
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;
      const command  = parts[0];
      const fileType = parts[4]; // fd type: REG, DIR, txt, cwd…
      const fileName = parts[parts.length - 1];
      // Only count regular file handles opened by non-system processes
      if (SYSTEM_PROC_PATTERN.test(command)) continue;
      if (!fileName || !fileName.toLowerCase().endsWith('.pdf')) continue;
      if (!paths.includes(fileName)) paths.push(fileName);
    }
    return paths;
  } catch {
    return [];
  }
}

/**
 * Returns true if there is any risk of PDF conflict:
 * a PDF in content/ is open by a real user-facing process.
 * (Deliberately does NOT check pdfAppRunning() to avoid false positives
 * from Preview being open for unrelated files.)
 */
function hasPDFConflict() {
  return openPDFsInContent().length > 0;
}

module.exports = { hasPDFConflict, openPDFsInContent };
