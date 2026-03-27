'use strict';
const { execSync } = require('child_process');

const CONTENT_PATH = '/Users/roywe/Library/Mobile Documents/com~apple~CloudDocs/Octarine/workspaces/bible/content';
const PDF_APPS = ['Preview', 'Adobe Acrobat'];

/**
 * Returns list of PDF file paths inside content/ that are currently open by any process.
 * Uses `lsof` which is always available on macOS.
 */
function openPDFsInContent() {
  try {
    // lsof +D lists all open files under a directory recursively
    const out = execSync(`lsof +D "${CONTENT_PATH}" 2>/dev/null`, { encoding: 'utf8', timeout: 5000 });
    return out
      .split('\n')
      .slice(1) // skip header
      .map(line => line.trim().split(/\s+/).pop()) // last field is the filename
      .filter(f => f && f.toLowerCase().endsWith('.pdf'))
      .filter((f, i, arr) => arr.indexOf(f) === i); // unique
  } catch {
    return [];
  }
}

/**
 * Returns true if Preview or Adobe Acrobat is currently running.
 */
function pdfAppRunning() {
  for (const app of PDF_APPS) {
    try {
      execSync(`pgrep -x "${app}" 2>/dev/null`, { timeout: 2000 });
      return true;
    } catch {
      // pgrep exits non-zero when no match
    }
  }
  return false;
}

/**
 * Returns true if there is any risk of PDF conflict:
 * a PDF in content/ is open OR a PDF viewer app is running.
 */
function hasPDFConflict() {
  return openPDFsInContent().length > 0 || pdfAppRunning();
}

module.exports = { hasPDFConflict, openPDFsInContent, pdfAppRunning };
