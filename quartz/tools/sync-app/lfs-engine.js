'use strict';
//
// lfs-engine — smart LFS / PDF handling for Bible Notes Sync.
//
// Responsibilities:
//   • detect which LFS-tracked files changed (git diff + content hash cache)
//   • decide whether the next sync should push LFS (skip-when-unchanged)
//   • enforce daily / monthly byte caps
//   • enforce batch thresholds (defer push until ≥N files or ≥M bytes pending)
//   • offer dedup detection for newly-added PDFs
//   • offer lossless PDF optimization via qpdf (if installed) pre-commit
//   • write /tmp/quartz-sync-plan.json which the shell script consumes
//
// Nothing in this module mutates git state except updateHashCache() and
// optimizePendingPdfs() (which only rewrites PDF bytes in place).

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');
const { state, loadSettings, saveSettings, REPO_DIR } = require('./state');

// ── Paths ──────────────────────────────────────────────────────────────────
const CACHE_DIR        = path.join(os.homedir(), '.cache/quartz-sync');
const HASH_FILE        = path.join(CACHE_DIR, 'lfs-hashes.json');
const PLAN_FILE        = '/tmp/quartz-sync-plan.json';
const CAP_LEDGER_FILE  = path.join(CACHE_DIR, 'lfs-byte-ledger.json');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ── Hash cache ─────────────────────────────────────────────────────────────
//
// Stored as { [relativePath]: { sha256, size, mtime, lastPushedAt } }.
//
function readHashCache() {
  try { return JSON.parse(fs.readFileSync(HASH_FILE, 'utf8')); }
  catch { return {}; }
}

function writeHashCache(map) {
  ensureCacheDir();
  fs.writeFileSync(HASH_FILE, JSON.stringify(map, null, 2), 'utf8');
}

function sha256File(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ── LFS pattern matching ───────────────────────────────────────────────────
//
// We read .gitattributes once per call and match by file extension. Current
// repo tracks *.pdf and *.PDF. If attributes change we pick that up naturally.
//
function loadLfsPatterns() {
  const gaPath = path.join(REPO_DIR, '.gitattributes');
  try {
    const raw = fs.readFileSync(gaPath, 'utf8');
    return raw.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && l.includes('filter=lfs'))
      .map(l => l.split(/\s+/)[0]); // pattern is first token
  } catch { return []; }
}

function isLfsPath(relPath, patterns) {
  if (!patterns.length) return false;
  const base = path.basename(relPath);
  for (const pat of patterns) {
    // Only support simple `*.ext` patterns — that's all this repo uses.
    const m = pat.match(/^\*\.([A-Za-z0-9]+)$/);
    if (m) {
      const ext = m[1];
      if (base.toLowerCase().endsWith('.' + ext.toLowerCase())) return true;
    } else if (pat === base || pat === relPath) {
      return true;
    }
  }
  return false;
}

// ── Change detection ───────────────────────────────────────────────────────
//
// Returns { changed: [...], unchanged: [...], bytes, bytesChanged }.
// `changed` includes files whose hash differs from cache OR are new.
// `unchanged` are LFS-tracked files present in the working tree matching cache.
//
function detectLfsChanges() {
  const patterns = loadLfsPatterns();
  if (!patterns.length) return { changed: [], unchanged: [], bytes: 0, bytesChanged: 0 };

  const cache = readHashCache();
  const changed = [];
  const unchanged = [];
  let bytes = 0;
  let bytesChanged = 0;

  // Enumerate all tracked+untracked files of LFS patterns via git ls-files
  // (includes the worktree state, not just HEAD).
  let listing = '';
  try {
    listing = execFileSync(
      'git',
      ['-C', REPO_DIR, 'ls-files', '-co', '--exclude-standard', '-z'],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
  } catch { return { changed: [], unchanged: [], bytes: 0, bytesChanged: 0 }; }

  const files = listing.split('\0').filter(Boolean);
  for (const rel of files) {
    if (!isLfsPath(rel, patterns)) continue;
    const abs = path.join(REPO_DIR, rel);
    let stat;
    try { stat = fs.statSync(abs); } catch { continue; }
    // Skip if the file is actually an unresolved LFS pointer (<200 bytes, begins
    // with "version https://git-lfs"). We can't hash its content meaningfully.
    if (stat.size < 200) {
      try {
        const head = fs.readFileSync(abs, 'utf8').slice(0, 80);
        if (head.startsWith('version https://git-lfs')) continue;
      } catch {}
    }
    const entry = cache[rel];
    const mtime = stat.mtimeMs;
    let sha;
    // Fast path: same size + mtime → trust cache.
    if (entry && entry.size === stat.size && entry.mtime === mtime) {
      sha = entry.sha256;
    } else {
      sha = sha256File(abs);
    }
    bytes += stat.size;
    if (!entry || entry.sha256 !== sha) {
      changed.push({ path: rel, size: stat.size, sha });
      bytesChanged += stat.size;
    } else {
      unchanged.push({ path: rel, size: stat.size, sha });
    }
  }

  return { changed, unchanged, bytes, bytesChanged };
}

// ── Cap ledger (bytes pushed per day/month) ────────────────────────────────
//
// { day: 'YYYY-MM-DD', dayBytes, month: 'YYYY-MM', monthBytes }
//
function readLedger() {
  try { return JSON.parse(fs.readFileSync(CAP_LEDGER_FILE, 'utf8')); }
  catch { return { day: '', dayBytes: 0, month: '', monthBytes: 0 }; }
}

function writeLedger(l) {
  ensureCacheDir();
  fs.writeFileSync(CAP_LEDGER_FILE, JSON.stringify(l, null, 2), 'utf8');
}

function todayKeys(now = new Date()) {
  const iso = now.toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

function currentUsage() {
  const ledger = readLedger();
  const { day, month } = todayKeys();
  return {
    dayBytes:   ledger.day   === day   ? (ledger.dayBytes   || 0) : 0,
    monthBytes: ledger.month === month ? (ledger.monthBytes || 0) : 0,
  };
}

function recordBytesPushed(bytes) {
  const { day, month } = todayKeys();
  const ledger = readLedger();
  const dayBytes   = ledger.day   === day   ? (ledger.dayBytes   || 0) + bytes : bytes;
  const monthBytes = ledger.month === month ? (ledger.monthBytes || 0) + bytes : bytes;
  writeLedger({ day, month, dayBytes, monthBytes });
  return { dayBytes, monthBytes };
}

function checkCaps(projectedBytes, settings) {
  const { dayBytes, monthBytes } = currentUsage();
  const dailyCap   = Number(settings.lfsDailyCapBytes   || 0);
  const monthlyCap = Number(settings.lfsMonthlyCapBytes || 0);
  if (dailyCap   && dayBytes   + projectedBytes > dailyCap) {
    return { allowed: false, reason: `daily cap reached (${formatBytes(dayBytes)} / ${formatBytes(dailyCap)})` };
  }
  if (monthlyCap && monthBytes + projectedBytes > monthlyCap) {
    return { allowed: false, reason: `monthly cap reached (${formatBytes(monthBytes)} / ${formatBytes(monthlyCap)})` };
  }
  return { allowed: true };
}

// ── Plan generation ────────────────────────────────────────────────────────
//
// Build the JSON the shell script will read from /tmp/quartz-sync-plan.json.
// `explicitIncludePdfs` === true  → user pressed "Sync with PDFs"
// `explicitIncludePdfs` === false → user pressed plain "Sync Now" (no PDFs)
// `explicitIncludePdfs` === undefined → fall back to settings + smart skip
//
function planNextSync({ explicitIncludePdfs, commitMessage } = {}) {
  const settings = loadSettings();
  const diff = detectLfsChanges();

  // Figure out whether we'd *like* to push PDFs this run.
  let includePdfs;
  if (explicitIncludePdfs === true)  includePdfs = true;
  else if (explicitIncludePdfs === false) includePdfs = false;
  else includePdfs = settings.includePdfsByDefault !== false; // default on

  // Smart skip: even if user wants PDFs, if nothing changed there's no point.
  const nothingChanged = diff.changed.length === 0;
  if (includePdfs && nothingChanged) {
    includePdfs = false;
  }

  // Batch thresholds — when configured, defer LFS unless thresholds met.
  const batchMinFiles = Number(settings.lfsBatchMinFiles || 0);
  const batchMinBytes = Number(settings.lfsBatchMinBytes || 0);
  const batchingOn    = batchMinFiles > 0 || batchMinBytes > 0;
  let batchDeferred   = false;
  if (includePdfs && batchingOn && explicitIncludePdfs !== true) {
    const enoughFiles = batchMinFiles > 0 ? diff.changed.length >= batchMinFiles : false;
    const enoughBytes = batchMinBytes > 0 ? diff.bytesChanged   >= batchMinBytes : false;
    if (!enoughFiles && !enoughBytes) {
      includePdfs = false;
      batchDeferred = true;
    }
  }

  // Caps
  let capBlocked = null;
  if (includePdfs) {
    const capCheck = checkCaps(diff.bytesChanged, settings);
    if (!capCheck.allowed) {
      includePdfs = false;
      capBlocked = capCheck.reason;
    }
  }

  // Quota threshold (from cached quota snapshot in state).
  let quotaBlocked = null;
  if (includePdfs && state.lfsQuota) {
    const threshold = Number(settings.lfsQuotaThreshold || 0.8);
    const q = state.lfsQuota; // { bandwidthUsed, bandwidthQuota, storageUsed, storageQuota }
    const bwFrac = q.bandwidthQuota ? q.bandwidthUsed / q.bandwidthQuota : 0;
    if (bwFrac >= threshold && explicitIncludePdfs !== true) {
      includePdfs = false;
      quotaBlocked = `bandwidth ${(bwFrac * 100).toFixed(0)}% of quota (threshold ${(threshold * 100).toFixed(0)}%)`;
    }
  }

  const plan = {
    skipLfs: !includePdfs,
    includePdfs,
    throttleKBps: Number(settings.lfsBandwidthLimit || 0),
    maxBytes:     Number(settings.lfsMaxBytesPerRun || 0),
    commitMessage: commitMessage || '',
    // Informational — not consumed by the shell script but read back for UI.
    pending: {
      files: diff.changed.map(f => f.path),
      bytes: diff.bytesChanged,
      totalFiles: diff.changed.length,
      totalBytes: diff.bytes,
      batchDeferred,
      capBlocked,
      quotaBlocked,
      nothingChanged,
    },
  };

  ensureCacheDir();
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf8');
  return plan;
}

function clearPlan() {
  try { fs.unlinkSync(PLAN_FILE); } catch {}
}

// ── Post-push: update hash cache for files actually pushed ─────────────────
//
// Called from sync-runner after a successful LFS push.
//
function updateHashCache(pushedFiles) {
  const cache = readHashCache();
  const now   = Date.now();
  for (const f of pushedFiles) {
    const abs = path.join(REPO_DIR, f.path);
    let stat; try { stat = fs.statSync(abs); } catch { continue; }
    cache[f.path] = {
      sha256: f.sha,
      size:   stat.size,
      mtime:  stat.mtimeMs,
      lastPushedAt: now,
    };
  }
  writeHashCache(cache);
}

// ── Dedup detection ────────────────────────────────────────────────────────
//
// Given a pending PDF (absolute path), find any other repo files with the same
// content hash. Useful to warn the user before adding a near-duplicate to LFS.
//
function findDuplicates(absPath) {
  try {
    const target = sha256File(absPath);
    const cache = readHashCache();
    const matches = [];
    for (const [rel, entry] of Object.entries(cache)) {
      if (entry.sha256 === target) {
        const otherAbs = path.join(REPO_DIR, rel);
        if (path.resolve(otherAbs) !== path.resolve(absPath)) matches.push(rel);
      }
    }
    return matches;
  } catch { return []; }
}

// ── PDF optimization (lossless via qpdf) ───────────────────────────────────
//
// Only runs when settings.lfsOptimizePdfs === true and qpdf is installed.
// Optimizes every *changed* PDF in place. Lossless — linearize + object-stream.
//
function optimizePendingPdfs(changedFiles) {
  const settings = loadSettings();
  if (!settings.lfsOptimizePdfs) return { optimized: [], skipped: 'disabled' };
  let hasQpdf = false;
  try { execSync('command -v qpdf', { stdio: 'ignore' }); hasQpdf = true; } catch {}
  if (!hasQpdf) return { optimized: [], skipped: 'qpdf not installed' };

  const optimized = [];
  for (const f of changedFiles) {
    if (!/\.pdf$/i.test(f.path)) continue;
    const abs = path.join(REPO_DIR, f.path);
    const tmp = abs + '.opt.tmp';
    try {
      execFileSync('qpdf', ['--linearize', '--object-streams=generate', abs, tmp], { stdio: 'ignore' });
      const before = fs.statSync(abs).size;
      const after  = fs.statSync(tmp).size;
      if (after > 0 && after < before) {
        fs.renameSync(tmp, abs);
        optimized.push({ path: f.path, before, after });
      } else {
        fs.unlinkSync(tmp);
      }
    } catch {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }

  if (optimized.length) {
    try { fs.writeFileSync('/tmp/quartz-sync-pdf-optimized', '1', 'utf8'); } catch {}
  }
  return { optimized };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

module.exports = {
  PLAN_FILE,
  HASH_FILE,
  CAP_LEDGER_FILE,
  readHashCache,
  writeHashCache,
  detectLfsChanges,
  currentUsage,
  recordBytesPushed,
  checkCaps,
  planNextSync,
  clearPlan,
  updateHashCache,
  findDuplicates,
  optimizePendingPdfs,
  formatBytes,
};
