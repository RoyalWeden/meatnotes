'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

// True if the working tree is under iCloud Drive (~/Library/Mobile Documents/...)
function repoIsInICloud(repoPath) {
  return repoPath.includes('/Mobile Documents/');
}

// True if .git has already been migrated — it's a file containing "gitdir: ...".
function gitIsMigrated(repoPath) {
  const dotGit = path.join(repoPath, '.git');
  try {
    const stat = fs.lstatSync(dotGit);
    if (!stat.isFile()) return false;
    const contents = fs.readFileSync(dotGit, 'utf8').trim();
    return contents.startsWith('gitdir:');
  } catch { return false; }
}

// Where the external .git currently lives (only valid when gitIsMigrated).
function externalGitDir(repoPath) {
  const dotGit = path.join(repoPath, '.git');
  try {
    const contents = fs.readFileSync(dotGit, 'utf8').trim();
    const m = contents.match(/^gitdir:\s*(.+)$/);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

// True when .git is still a directory inside iCloud → migration needed.
function needsICloudGitMigration(repoPath) {
  if (!repoIsInICloud(repoPath)) return false;
  if (gitIsMigrated(repoPath)) return false;
  try {
    const stat = fs.lstatSync(path.join(repoPath, '.git'));
    return stat.isDirectory();
  } catch { return false; }
}

function defaultExternalGitPath() {
  return path.join(os.homedir(), '.local/share/meatnotes-git');
}

function describeGitLocation(repoPath) {
  if (gitIsMigrated(repoPath)) {
    return { migrated: true, location: externalGitDir(repoPath), inICloud: false };
  }
  return {
    migrated: false,
    location: path.join(repoPath, '.git'),
    inICloud: repoIsInICloud(repoPath),
  };
}

module.exports = {
  repoIsInICloud,
  gitIsMigrated,
  externalGitDir,
  needsICloudGitMigration,
  defaultExternalGitPath,
  describeGitLocation,
};
