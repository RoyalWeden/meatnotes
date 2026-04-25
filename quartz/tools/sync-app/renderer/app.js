'use strict';
// Bible Sync — main window renderer

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const PIPELINE_ORDER = ['pull', 'build', 'commit', 'lfs_push', 'git_push', 'deploy'];
// lfs_skipped folds into lfs_push slot with "skipped" styling.

const state = {
  status: null,
  entries: [],
};

// ── Helpers ──────────────────────────────────────────────────────────
function fmtBytes(n) {
  if (!n || n < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(iso); }
}
function fmtRelative(ts) {
  if (!ts) return '—';
  const now = Date.now();
  const diff = now - new Date(ts).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return fmtTime(ts);
}
function fmtCountdown(msToTarget) {
  if (msToTarget == null || msToTarget <= 0) return 'now';
  const s = Math.floor(msToTarget / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── Settings binder ──────────────────────────────────────────────────
// Every input with `data-setting="<key>"` auto-persists to settings.json on
// change. Optional attributes:
//   data-unit="mb-to-bytes"     — number input stored as bytes, rendered in MB
//   data-unit="min-to-sec"      — number input stored as seconds, rendered in minutes
//   data-invert="1"             — checkbox inverts (UI true = stored false)
// Unmarked inputs are left alone (buttons, non-settings controls).
function readSettingValue(el) {
  const unit = el.dataset.unit || '';
  const invert = el.dataset.invert === '1';
  if (el.type === 'checkbox') {
    const v = !!el.checked;
    return invert ? !v : v;
  }
  if (el.type === 'number' || el.inputMode === 'decimal') {
    const n = el.step && el.step !== '1' ? parseFloat(el.value) : parseInt(el.value, 10);
    const val = isNaN(n) ? 0 : n;
    if (unit === 'mb-to-bytes') return Math.round(val * 1024 * 1024);
    if (unit === 'min-to-sec')  return Math.round(val * 60);
    return val;
  }
  return el.value;
}
function writeSettingValue(el, v) {
  const unit = el.dataset.unit || '';
  const invert = el.dataset.invert === '1';
  if (el.type === 'checkbox') {
    el.checked = invert ? !v : !!v;
    return;
  }
  if (el.type === 'number') {
    if (unit === 'mb-to-bytes') { el.value = Math.round((Number(v) || 0) / (1024 * 1024)); return; }
    if (unit === 'min-to-sec')  { el.value = Math.max(1, Math.round((Number(v) || 0) / 60)); return; }
    el.value = v ?? 0;
    return;
  }
  el.value = v ?? '';
}
function attachSettingBinders(root = document) {
  root.querySelectorAll('[data-setting]').forEach(el => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      const key = el.dataset.setting;
      try { window.api.saveSettings({ [key]: readSettingValue(el) }); } catch {}
      // Some settings have side-effects the renderer wants to reflect immediately.
      if (key === 'icloudBannerDismissed') { try { refreshGitLocation(); } catch {} }
    });
  });
}
function hydrateSettings(root, settings) {
  root.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;
    if (!(key in settings)) return;
    writeSettingValue(el, settings[key]);
  });
}

// ── Routing ──────────────────────────────────────────────────────────
function showPane(name) {
  $$('.pane').forEach(p => p.hidden = p.id !== `pane-${name}`);
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.pane === name));
  if (name === 'pdfs')    refreshPdfs();
  if (name === 'deploy')  refreshDeploy();
  if (name === 'logs')    refreshLogs();
  if (name === 'bg')      refreshBg();
  if (name === 'settings') { refreshSettings(); refreshGitLocation(); }
}

$$('.nav-item').forEach(btn => btn.addEventListener('click', () => showPane(btn.dataset.pane)));

// ── Header + Overview ────────────────────────────────────────────────
function paintHeader(s) {
  const dot = $('#status-dot');
  const txt = $('#status-text');
  dot.className = 'status-dot';
  if (s.isSyncing)      { dot.classList.add('syncing'); txt.textContent = 'Syncing'; }
  else if (s.isPaused)  { dot.classList.add('paused');  txt.textContent = 'Paused'; }
  else if (s.lastSyncError) { dot.classList.add('err'); txt.textContent = 'Error'; }
  else                  { dot.classList.add('idle');    txt.textContent = 'Idle'; }

  // Mini meter — show LFS storage % of cycle
  const meterFill = $('#meter-fill');
  const meterLbl  = $('#meter-label');
  if (s.lfsQuota && s.lfsQuota.estimatedStorageForMonth != null) {
    // Shared storage is reported in GB from GitHub; used as soft indicator only.
    const used = s.lfsQuota.estimatedStorageForMonth || 0;
    meterLbl.textContent = `LFS ≈ ${used.toFixed(1)} GB`;
    const frac = Math.min(1, used / 50); // no hard total from API — normalize to 50GB
    meterFill.style.width = `${frac * 100}%`;
    meterFill.classList.toggle('warn', frac >= (s.lfsQuotaThreshold || 0.8));
    meterFill.classList.toggle('err',  frac >= 0.95);
  } else {
    meterLbl.textContent = s.hasGithubToken ? 'LFS —' : 'LFS (token?)';
    meterFill.style.width = '0%';
  }
}

function paintStepper(s) {
  const stage = s.pipelineStage;
  const stamps = s.stageTimestamps || {};
  const stepEls = $$('#stepper .step');
  stepEls.forEach(el => {
    el.classList.remove('running', 'done', 'skipped', 'failed');
    const id = el.dataset.stage;
    const stamp = stamps[id];
    const skipped = id === 'lfs_push' && stamps['lfs_skipped'];
    if (skipped) { el.classList.add('skipped'); }
    if (stamp) {
      const started = stamp.start;
      const ended = stamp.end;
      if (ended) el.classList.add('done');
      else el.classList.add('running');
      // Tooltip with start + duration
      const dur = ended ? Math.round((new Date(ended) - new Date(started)) / 1000) : null;
      el.title = `Started ${fmtTime(started)}${dur != null ? ` • ${dur}s` : ' • in progress'}`;
    } else if (!s.isSyncing && stage === 'error') {
      // nothing
    }
  });
  // If whole pipeline complete, mark remaining as done/skipped based on stamps
  if (!s.isSyncing && stage === 'done') {
    stepEls.forEach(el => {
      if (!el.classList.contains('done') && !el.classList.contains('skipped')) el.classList.add('done');
    });
  }
}

function paintOverview(s) {
  $('#ov-status').textContent = s.isSyncing ? 'Syncing' : s.isPaused ? 'Paused' : s.lastSyncError ? 'Error' : 'Idle';
  $('#ov-last').textContent   = fmtRelative(s.lastSyncTime);
  if (s.isSyncing) {
    $('#ov-next').textContent = 'running…';
  } else if (s.isPaused) {
    $('#ov-next').textContent = 'paused';
  } else if (s.nextSyncAt) {
    $('#ov-next').textContent = `in ${fmtCountdown(s.nextSyncAt - Date.now())}`;
  } else $('#ov-next').textContent = '—';
  $('#ov-streak').textContent = `${s.syncStreak || 0}${s.syncStreakBest ? ` (best ${s.syncStreakBest})` : ''}`;

  // Pause button label
  $('#btn-pause').textContent = s.isPaused ? 'Resume' : 'Pause';

  paintStepper(s);
}

// Recent activity list
function paintRecent(entries) {
  const host = $('#ov-recent');
  const items = entries.slice(0, 5);
  if (!items.length) { host.className = 'list empty'; host.textContent = 'No recent syncs.'; return; }
  host.className = 'list';
  host.innerHTML = items.map(e => {
    const cls = e.status === 'success' ? 'ok'
              : e.status === 'error'   ? 'err'
              : e.status === 'running' ? 'running'
              : e.status === 'partial' ? 'warn'
              : 'warn';
    return `<div class="list-item ${cls}">
      <span class="time">${fmtTime(e.timestamp)}</span>
      <span class="msg">${escapeHtml(e.detail || '')}${e.filesChanged ? ` <span class="muted small">· ${escapeHtml(e.filesChanged)}</span>` : ''}</span>
      <span class="pill">${e.status}</span>
    </div>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── PDFs pane ────────────────────────────────────────────────────────
function renderPdfPending(changes) {
  const host = $('#pdf-pending');
  if (!host) return;
  if (!changes.changed.length) {
    host.className = 'list empty'; host.textContent = 'No pending PDF changes.';
    return;
  }
  host.className = 'list';
  host.innerHTML = changes.changed.slice(0, 30).map(f => `
    <div class="list-item">
      <span class="msg">${escapeHtml(f.path)}</span>
      <span class="pill">${fmtBytes(f.size)}</span>
    </div>`).join('')
    + (changes.changed.length > 30 ? `<div class="muted small">+${changes.changed.length - 30} more…</div>` : '')
    + `<div class="muted small" style="margin-top:6px">Total: ${changes.changed.length} files · ${fmtBytes(changes.bytesChanged)}</div>`;
}

async function refreshPdfs() {
  const host = $('#pdf-pending');
  if (host) { host.className = 'list'; host.innerHTML = `<div class="muted small">Scanning…</div>`; }

  const [usage, changes, settings, entries, plan] = await Promise.all([
    window.api.getLfsUsage(),
    window.api.getLfsChanges(),
    window.api.getSettings(),
    window.api.getLogEntries(),
    window.api.getLfsPlanPreview(settings_willInclude(null)), // will resolve based on includePdfsByDefault below
  ]);
  $('#lfs-today').textContent = fmtBytes(usage.usage?.dayBytes || 0);
  $('#lfs-month').textContent = fmtBytes(usage.usage?.monthBytes || 0);

  // Storage / cycle headline: prefer manual entry, else API estimate.
  const q = usage.quota;
  if (q && q.source === 'manual') {
    $('#lfs-storage').textContent = `${(q.storageUsedGB || 0).toFixed(2)} GB / ${(q.storageIncludedGB || 0).toFixed(0)} GB`;
    $('#lfs-cycle').textContent = `${q.daysLeft ?? '—'} d`;
  } else if (q) {
    $('#lfs-storage').textContent = `${(q.estimatedStorageForMonth || 0).toFixed(2)} GB`;
    $('#lfs-cycle').textContent = `${q.daysLeftInBillingCycle ?? '—'} d`;
  } else {
    $('#lfs-storage').textContent = '—';
    $('#lfs-cycle').textContent = settings.githubToken ? '—' : 'token required';
  }

  // Generic hydration — handles type conversions (mb-to-bytes etc.) via data-unit attrs
  hydrateSettings($('#pane-pdfs'), settings);
  // Sensible defaults for fields the user hasn't set yet
  if (settings.lfsDedup === undefined)          $('#opt-dedup').checked = true;
  if (settings.lfsQuotaThreshold === undefined) $('#opt-quota-threshold').value = 0.8;
  attachSettingBinders($('#pane-pdfs'));

  renderPdfPending(changes);
  paintNextSyncEstimate(plan, entries, settings);
  paintPresetRadios(settings);
  paintCostCard(q, settings);
}
// Placeholder — the first call to planNextSync needs no explicit flag.
function settings_willInclude() { return undefined; }

// ── PDFs: next-sync bandwidth estimate ───────────────────────────────
function paintNextSyncEstimate(plan, entries, settings) {
  const bytes = plan?.pending?.bytes || 0;
  const files = plan?.pending?.totalFiles || 0;
  $('#pdf-next-bytes').textContent = bytes ? fmtBytes(bytes) : (files ? '0 B' : 'Nothing to push');
  $('#pdf-next-files').textContent = files ? `${files} PDF${files === 1 ? '' : 's'}` : '—';

  // Monthly projection: count successful syncs in the last 30 days and their
  // average bytesChanged. We only have log entries (no bytesChanged recorded),
  // so fall back to assuming each sync pushes ~this sync's bytes.
  const now = Date.now();
  const THIRTY = 30 * 24 * 60 * 60 * 1000;
  const recent = (entries || []).filter(e => {
    const t = new Date(e.timestamp).getTime();
    return !isNaN(t) && (now - t) < THIRTY && e.status === 'success';
  });
  const syncsPerDay = recent.length / 30;
  // Use current "today pushed" as a per-sync proxy if we have it, else this sync.
  const perSync = bytes || 0;
  const projBytes = Math.round(perSync * syncsPerDay * 30);
  $('#pdf-monthly-proj').textContent = projBytes ? fmtBytes(projBytes) : '—';
  $('#pdf-monthly-basis').textContent = recent.length
    ? `Based on ${recent.length} successful syncs in the last 30 days (≈${syncsPerDay.toFixed(1)}/day).`
    : 'Projection needs 30 days of sync history.';
}

// ── PDFs: preset radios ──────────────────────────────────────────────
const LFS_PRESETS = {
  conservative: {
    lfsMaxBytesPerRun: 25 * 1024 * 1024,
    lfsDailyCapBytes:  100 * 1024 * 1024,
    lfsMonthlyCapBytes: 2 * 1024 * 1024 * 1024,
    lfsQuotaThreshold: 0.75,
  },
  balanced: {
    lfsMaxBytesPerRun: 50 * 1024 * 1024,
    lfsDailyCapBytes:  500 * 1024 * 1024,
    lfsMonthlyCapBytes: 8 * 1024 * 1024 * 1024,
    lfsQuotaThreshold: 0.85,
  },
  eager: {
    lfsMaxBytesPerRun: 0,
    lfsDailyCapBytes:  0,
    lfsMonthlyCapBytes: 0,
    lfsQuotaThreshold: 0.98,
  },
};
function presetMatch(settings) {
  for (const [name, patch] of Object.entries(LFS_PRESETS)) {
    const ok = Object.entries(patch).every(([k, v]) => {
      const cur = settings[k];
      if (typeof v === 'number' && typeof cur === 'number') {
        return Math.abs(cur - v) / Math.max(1, v) < 0.05 || (v === 0 && cur === 0);
      }
      return cur === v;
    });
    if (ok) return name;
  }
  return null;
}
function paintPresetRadios(settings) {
  const name = presetMatch(settings) || 'balanced';
  document.querySelectorAll('input[name="lfs-preset"]').forEach(r => {
    r.checked = r.value === name;
  });
}
document.querySelectorAll('input[name="lfs-preset"]').forEach(r => {
  r.addEventListener('change', async () => {
    if (!r.checked) return;
    const patch = { ...LFS_PRESETS[r.value], lfsPresetName: r.value };
    await window.api.saveSettings(patch);
    await refreshPdfs();
  });
});

// ── PDFs: cost estimator ─────────────────────────────────────────────
const LFS_PRICE_PER_GB = 0.10; // $5 per 50 GB pack, both storage and bandwidth
function paintCostCard(q, _settings) {
  if (!q) {
    $('#cost-storage').textContent = '—';
    $('#cost-bandwidth').textContent = '—';
    $('#cost-total').textContent = '—';
    $('#cost-basis').textContent = 'Click "Update usage…" to enter values from your GitHub billing page.';
    return;
  }
  const storageUsed = q.storageUsedGB ?? q.estimatedStorageForMonth ?? 0;
  const storageIncl = q.storageIncludedGB ?? 1;
  const bwUsed      = q.bandwidthUsedGB ?? 0;
  const bwIncl      = q.bandwidthIncludedGB ?? 1;
  const storageOver = Math.max(0, storageUsed - storageIncl);
  const bwOver      = Math.max(0, bwUsed - bwIncl);
  // Packs are sold in 50 GB increments; charge per-pack not per-GB for honesty.
  const storageCost = Math.ceil(storageOver / 50) * 5;
  const bwCost      = Math.ceil(bwOver / 50) * 5;
  $('#cost-storage').textContent   = `${storageUsed.toFixed(1)} / ${storageIncl.toFixed(0)} GB · $${storageCost.toFixed(2)}`;
  $('#cost-bandwidth').textContent = `${bwUsed.toFixed(1)} / ${bwIncl.toFixed(0)} GB · $${bwCost.toFixed(2)}`;
  $('#cost-total').textContent     = `$${(storageCost + bwCost).toFixed(2)} / mo`;
  const caption = q.source === 'manual'
    ? `Manual entry · updated ${fmtRelative(q.updatedAt)}`
    : `GitHub API (storage estimate only — no bandwidth data)`;
  $('#cost-basis').textContent = caption;
}

$('#btn-edit-lfs-manual')?.addEventListener('click', async () => {
  const usage = await window.api.getLfsUsage();
  const m = usage.manual || {};
  $('#lfs-manual-storage-used').value = m.storageUsedGB ?? '';
  $('#lfs-manual-storage-incl').value = m.storageIncludedGB ?? '';
  $('#lfs-manual-bw-used').value      = m.bandwidthUsedGB ?? '';
  $('#lfs-manual-bw-incl').value      = m.bandwidthIncludedGB ?? '';
  $('#lfs-manual-days').value         = m.daysLeft ?? '';
  $('#modal-lfs-manual').hidden = false;
});
$('#btn-lfs-manual-cancel')?.addEventListener('click', () => { $('#modal-lfs-manual').hidden = true; });
$('#btn-lfs-manual-save')?.addEventListener('click', async () => {
  await window.api.saveLfsManual({
    storageUsedGB:       parseFloat($('#lfs-manual-storage-used').value) || 0,
    storageIncludedGB:   parseFloat($('#lfs-manual-storage-incl').value) || 0,
    bandwidthUsedGB:     parseFloat($('#lfs-manual-bw-used').value) || 0,
    bandwidthIncludedGB: parseFloat($('#lfs-manual-bw-incl').value) || 0,
    daysLeft:            parseInt($('#lfs-manual-days').value, 10)    || 0,
  });
  $('#modal-lfs-manual').hidden = true;
  refreshPdfs();
});
$('#link-lfs-calc')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.api.openExternal('https://github.com/pricing/calculator?feature=lfs');
});
$('#link-gh-billing')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.api.openExternal('https://github.com/settings/billing/summary');
});

// Background scan completes → re-render with accurate numbers.
window.api.onLfsChangesUpdated?.((changes) => {
  if (changes && !$('#pane-pdfs').hidden) renderPdfPending(changes);
});

// The binder persists every change automatically — the Save button is retained
// for users who expect it and just surfaces a confirmation state.
$('#btn-save-pdfs')?.addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const orig = btn.textContent;
  btn.textContent = 'Saved ✓'; btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1000);
});

$('#btn-fetch-pdfs')?.addEventListener('click', () => window.api.triggerLfsPull());
$('#btn-publish-pdfs')?.addEventListener('click', async () => {
  const preview = await window.api.getLfsPlanPreview(true);
  const n = preview?.pending?.totalFiles || 0;
  const b = fmtBytes(preview?.pending?.bytes || 0);
  if (!n) { alert('No pending PDF changes to publish.'); return; }
  if (confirm(`Publish ${n} PDF file${n === 1 ? '' : 's'} (${b}) to GitHub LFS?`)) {
    window.api.syncWithPdfs();
  }
});
$('#btn-refresh-quota')?.addEventListener('click', () => window.api.fetchLfsQuota().then(refreshPdfs));

// ── Deploy pane ──────────────────────────────────────────────────────
async function refreshDeploy() {
  const s = state.status;
  if (!s || !s.deployStatus) {
    $('#deploy-status').textContent = '—';
    $('#deploy-num').textContent = '—';
    $('#deploy-updated').textContent = '—';
    $('#deploy-jobs').innerHTML = '';
    return;
  }
  const d = s.deployStatus;
  $('#deploy-status').textContent  = d.status === 'completed' ? (d.conclusion || 'completed') : (d.status || '—');
  $('#deploy-num').textContent     = d.runNumber ? `#${d.runNumber}` : '—';
  $('#deploy-updated').textContent = fmtRelative(d.updatedAt);
  $('#deploy-link').href = d.url || '#';
  $('#deploy-link').onclick = (e) => { e.preventDefault(); if (d.url) window.api.openExternal(d.url); };

  const jobs = s.deployJobs || [];
  $('#deploy-jobs').innerHTML = jobs.map(j => `
    <div class="job">
      <div class="job-head">${escapeHtml(j.name)} <span class="muted small">· ${escapeHtml(j.status)}${j.conclusion ? ' / ' + escapeHtml(j.conclusion) : ''}</span></div>
      <div class="steps">
        ${(j.steps || []).map(st => {
          const cls = st.conclusion === 'success' ? 'ok'
            : st.conclusion === 'failure' ? 'err'
            : st.status === 'in_progress' ? 'run' : '';
          const mark = st.conclusion === 'success' ? '✓'
            : st.conclusion === 'failure' ? '✗'
            : st.status === 'in_progress' ? '◐' : '○';
          return `<div class="job-step ${cls}"><span class="mark">${mark}</span>${escapeHtml(st.name)}</div>`;
        }).join('')}
      </div>
    </div>`).join('');

  const host = $('#deploy-recent');
  const runs = (s.deployRuns || []).slice(0, 3);
  host.className = runs.length ? 'list' : 'list empty';
  host.innerHTML = runs.length ? runs.map(r => {
    const cls = r.conclusion === 'success' ? 'ok' : r.conclusion === 'failure' ? 'err' : 'warn';
    return `<div class="list-item ${cls}">
      <span class="time">${fmtTime(r.updatedAt)}</span>
      <span class="msg">#${r.runNumber} — ${escapeHtml(r.status)}${r.conclusion ? ' / ' + escapeHtml(r.conclusion) : ''}</span>
      <a class="link" href="#" data-url="${r.url}">open</a>
    </div>`;
  }).join('') : 'No recent runs.';
  host.querySelectorAll('a.link').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); window.api.openExternal(a.dataset.url);
  }));
}

// ── Logs pane ────────────────────────────────────────────────────────
async function refreshLogs() {
  const entries = state.entries.length ? state.entries : await window.api.getLogEntries();
  const host = $('#log-entries');
  if (!entries.length) { host.className = 'log-list empty'; host.textContent = 'No entries.'; }
  else {
    host.className = 'log-list';
    host.innerHTML = entries.slice(0, 100).map((e, i) => {
      const cls = e.status === 'success' ? 'ok'
                : e.status === 'error'   ? 'err'
                : e.status === 'running' ? 'running'
                : 'warn';
      return `<div class="list-item ${cls}" data-idx="${i}">
        <span class="time">${fmtTime(e.timestamp)}</span>
        <span class="msg">${escapeHtml(e.detail || e.status)}</span>
      </div>`;
    }).join('');
  }
  const tail = await window.api.getLastOutput();
  $('#log-tail').textContent = tail || '';
  $('#log-tail').scrollTop = $('#log-tail').scrollHeight;
}

$('#btn-open-log')?.addEventListener('click', () => window.api.openLogFile());

// Live append to tail
window.api.onSyncOutput((chunk) => {
  const tail = $('#log-tail');
  if (!tail) return;
  tail.textContent += chunk;
  if (tail.textContent.length > 200_000) tail.textContent = tail.textContent.slice(-150_000);
  tail.scrollTop = tail.scrollHeight;
});

// ── BibleGateway pane ────────────────────────────────────────────────
async function refreshBg() {
  const [bg, settings] = await Promise.all([
    window.api.getBgStatus(),
    window.api.getSettings(),
  ]);
  $('#bg-status').textContent = bg.status || 'idle';
  $('#bg-count').textContent = bg.noteCount != null ? String(bg.noteCount) : (settings.bgNoteCount ?? '—');
  $('#bg-last').textContent  = fmtRelative(settings.lastBGSync);
  hydrateSettings($('#pane-bg'), settings);
  attachSettingBinders($('#pane-bg'));
}
$('#btn-bg-sync')?.addEventListener('click', () => window.api.triggerBgSync());

// ── BibleGateway activity feed ───────────────────────────────────────
const BG_ACTIVITY_CAP = 100;
function bgActivityList() { return document.getElementById('bg-activity'); }
function appendBgActivity(entry) {
  const ul = bgActivityList();
  if (!ul) return;
  // Clear placeholder on first real event
  if (ul.querySelector('.muted')) ul.innerHTML = '';
  const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cls = entry.error ? 'err' : entry.done ? 'ok' : 'running';
  const main = `<span class="time">${time}</span><span class="msg">${escapeHtml(entry.message || entry.step || '')}</span>${entry.count != null ? `<span class="pill">${entry.count}</span>` : ''}`;
  const sub = entry.previews && entry.previews.length
    ? `<div class="muted small" style="margin-top:2px">${entry.previews.map(p => escapeHtml(`${p.verse}: ${p.text}`)).join('<br>')}</div>`
    : '';
  const li = document.createElement('li');
  li.className = `list-item ${cls}`;
  li.innerHTML = `<div style="flex:1">${main}${sub}</div>`;
  ul.appendChild(li);
  while (ul.children.length > BG_ACTIVITY_CAP) ul.removeChild(ul.firstChild);
  ul.scrollTop = ul.scrollHeight;
}
window.api.onBgProgress?.((data) => {
  if (!data) return;
  let message = data.message || data.step || '';
  // Prefix chapter context where useful
  if (data.chapter && !message.includes(data.chapter)) message = `${data.chapter} — ${message}`;
  const count = data.notesCollected ?? data.totalNotes ?? data.chapterNotes;
  appendBgActivity({
    message,
    count,
    previews: data.notePreviews,
    error: data.step === 'phase2-error',
  });
});
window.api.onBgComplete?.((data) => {
  appendBgActivity({
    message: data?.message || `Imported ${data?.notesCount ?? '?'} notes, ${data?.connectionsCount ?? '?'} connections`,
    count: data?.notesCount,
    done: true,
  });
});
// The binder already persists bgUsername/bgPassword on every keystroke; the
// Save button just gives the user a confirmation beat.
$('#btn-save-bg')?.addEventListener('click', () => {
  const btn = $('#btn-save-bg');
  const orig = btn.textContent;
  btn.textContent = 'Saved ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
});

// ── Settings pane ────────────────────────────────────────────────────
async function refreshSettings() {
  const s = await window.api.getSettings();
  // loginItem is a special-case (not stored via save-settings); preserve it.
  $('#opt-login').checked  = !!s.loginItem;
  // Defaults for fields the user hasn't touched yet.
  if (s.notifyLevel === undefined)          $('#opt-notify').value = 'errors';
  if (s.intervalSeconds === undefined)      $('#opt-interval').value = 15;
  if (s.autoCleanDupesBeforeSync === undefined && $('#opt-autoclean-dupes')) {
    $('#opt-autoclean-dupes').checked = true;
  }
  if (s.openMainOnLaunch === undefined && $('#opt-open-main-on-launch')) {
    $('#opt-open-main-on-launch').checked = true;
  }
  hydrateSettings($('#pane-settings'), s);
  attachSettingBinders($('#pane-settings'));
}
// Save button now just gives confirmation feedback — the binder already persists.
$('#btn-save-settings')?.addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const orig = btn.textContent;
  btn.textContent = 'Saved ✓'; btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1000);
});
// loginItem is not a saveSettings key — it's a macOS API call.
$('#opt-login')?.addEventListener('change', (e) => {
  window.api.setLoginItem(e.target.checked);
});

// ── Top-bar actions ──────────────────────────────────────────────────
async function requestSyncNoPdfs() {
  try {
    const preview = await window.api.getLfsPlanPreview(false);
    const pending = preview?.pending || {};
    const n = pending.totalFiles || 0;
    if (!n) { window.api.syncNoPdfs(); return; }
    openPendingPdfsModal(pending);
  } catch {
    window.api.syncNoPdfs();
  }
}

function openPendingPdfsModal(pending) {
  const modal = $('#modal-pending-pdfs');
  const body = $('#pending-pdfs-body');
  const list = $('#pending-pdfs-list');
  const n = pending.totalFiles || 0;
  const bytes = pending.bytes || 0;
  body.innerHTML =
    `You have <b>${n} PDF file${n === 1 ? '' : 's'}</b> (${fmtBytes(bytes)}) with changes waiting to sync. ` +
    `"Sync Now" skips LFS uploads, so these PDFs can't be pushed as-is. Choose how to proceed:`;
  const files = (pending.files || []).slice(0, 20);
  list.innerHTML = files.length
    ? files.map(f => `<div class="list-item"><span class="msg">${escapeHtml(f)}</span></div>`).join('') +
      (n > files.length ? `<div class="muted small">+${n - files.length} more…</div>` : '')
    : '';
  modal.hidden = false;
}

function closePendingPdfsModal() { $('#modal-pending-pdfs').hidden = true; }

$('#btn-pending-cancel')?.addEventListener('click', closePendingPdfsModal);
$('#btn-pending-exclude')?.addEventListener('click', () => {
  closePendingPdfsModal();
  // Plan already has excludeLfsFromCommit=true when skipLfs=true, so a plain
  // syncNoPdfs() does the right thing; the shell will amend the commit.
  window.api.syncNoPdfs();
});
$('#btn-pending-include')?.addEventListener('click', () => {
  closePendingPdfsModal();
  window.api.syncWithPdfs();
});

$('#btn-sync-now')?.addEventListener('click', async () => {
  const settings = await window.api.getSettings();
  if (settings.includePdfsByDefault) window.api.syncWithPdfs();
  else requestSyncNoPdfs();
});
$('#btn-sync-no-pdfs')?.addEventListener('click', requestSyncNoPdfs);
$('#btn-sync-with-pdfs')?.addEventListener('click', () => window.api.syncWithPdfs());
$('#btn-pause')?.addEventListener('click', () => window.api.togglePause());

// ── Confirm modal helper ─────────────────────────────────────────────
function confirmModal({ title, body, list, okLabel = 'Confirm' }) {
  return new Promise((resolve) => {
    const modal = $('#modal-confirm');
    $('#confirm-title').textContent = title;
    $('#confirm-body').innerHTML = body;
    const listHost = $('#confirm-list');
    if (list && list.length) {
      listHost.hidden = false;
      listHost.innerHTML = list.map(f => `<div class="list-item"><span class="msg">${escapeHtml(f)}</span></div>`).join('');
    } else {
      listHost.hidden = true;
      listHost.innerHTML = '';
    }
    $('#btn-confirm-ok').textContent = okLabel;
    modal.hidden = false;
    const cleanup = (result) => {
      modal.hidden = true;
      $('#btn-confirm-ok').onclick = null;
      $('#btn-confirm-cancel').onclick = null;
      resolve(result);
    };
    $('#btn-confirm-ok').onclick     = () => cleanup(true);
    $('#btn-confirm-cancel').onclick = () => cleanup(false);
  });
}

// ── Maintenance: cleanup duplicates ──────────────────────────────────
$('#btn-cleanup-dupes')?.addEventListener('click', async () => {
  const btn = $('#btn-cleanup-dupes');
  btn.disabled = true; btn.textContent = 'Scanning…';
  try {
    const preview = await window.api.cleanupDupes({ commit: false });
    if (preview.errors && preview.errors.length) {
      alert('Could not scan for duplicates:\n' + preview.errors.join('\n'));
      return;
    }
    if (!preview.found.length) {
      alert('No iCloud duplicate files found.');
      return;
    }
    const go = await confirmModal({
      title: `Remove ${preview.found.length} duplicate file${preview.found.length === 1 ? '' : 's'}?`,
      body: `These files look like iCloud conflict duplicates. They will be <code>git rm</code>'d and a commit created.`,
      list: preview.found,
      okLabel: 'Remove and commit',
    });
    if (!go) return;
    btn.textContent = 'Removing…';
    const res = await window.api.cleanupDupes({ commit: true });
    if (res.errors && res.errors.length) {
      alert('Finished with errors:\n' + res.errors.join('\n'));
    } else {
      alert(`Removed ${res.removed.length} file${res.removed.length === 1 ? '' : 's'}${res.committed ? ' and committed.' : '.'}`);
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Clean up…';
  }
});

// ── Maintenance: organize website-only notes ──────────────────────────
$('#btn-organize-preview')?.addEventListener('click', async () => {
  const btn = $('#btn-organize-preview');
  const status = $('#organize-website-status');
  btn.disabled = true; btn.textContent = 'Scanning…';
  if (status) status.textContent = '';
  try {
    const res = await window.api.organizeWebsite({ commit: false });
    if (res.errors && res.errors.length) {
      if (status) status.innerHTML = `<span style="color:#c33">Errors: ${escapeHtml(res.errors.join('; '))}</span>`;
      return;
    }
    if (!res.found.length) {
      if (status) status.textContent = 'No notes with publish: true frontmatter found outside content/Website/.';
      return;
    }
    if (status) {
      const preview = res.found.slice(0, 10).map(p => `<code>${escapeHtml(p)}</code>`).join('<br>');
      const more = res.found.length > 10 ? `<br><em>…and ${res.found.length - 10} more.</em>` : '';
      status.innerHTML = `<strong>${res.found.length}</strong> note${res.found.length === 1 ? '' : 's'} would move:<br>${preview}${more}`;
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Preview';
  }
});

$('#btn-organize-commit')?.addEventListener('click', async () => {
  const btn = $('#btn-organize-commit');
  const status = $('#organize-website-status');
  btn.disabled = true; btn.textContent = 'Scanning…';
  try {
    const preview = await window.api.organizeWebsite({ commit: false });
    if (preview.errors && preview.errors.length) {
      alert('Could not scan:\n' + preview.errors.join('\n'));
      return;
    }
    if (!preview.found.length) {
      alert('No notes with publish: true frontmatter found outside content/Website/.');
      return;
    }
    const go = await confirmModal({
      title: `Move ${preview.found.length} note${preview.found.length === 1 ? '' : 's'} to content/Website/?`,
      body: `These files will be <code>git mv</code>'d into <code>content/Website/</code> and a commit created. Wiki-links that include a folder path will be rewritten.`,
      list: preview.found,
      okLabel: 'Move and commit',
    });
    if (!go) return;
    btn.textContent = 'Moving…';
    const res = await window.api.organizeWebsite({ commit: true });
    if (res.errors && res.errors.length) {
      alert('Finished with errors:\n' + res.errors.join('\n'));
    } else {
      const rw = res.rewrote?.length ? ` Rewrote ${res.rewrote.length} wiki-link reference${res.rewrote.length === 1 ? '' : 's'}.` : '';
      alert(`Moved ${res.moved.length} note${res.moved.length === 1 ? '' : 's'} and committed.${rw}`);
    }
    if (status) status.textContent = '';
  } finally {
    btn.disabled = false; btn.textContent = 'Commit move…';
  }
});

// ── Maintenance: migrate .git out of iCloud ──────────────────────────
async function refreshGitLocation() {
  try {
    const [loc, settings] = await Promise.all([
      window.api.getGitLocation(),
      window.api.getSettings(),
    ]);
    const status = $('#git-location-status');
    const btn = $('#btn-migrate-git');
    const banner = $('#icloud-banner');
    if (loc.migrated) {
      if (status) status.textContent = `Already moved → ${loc.location}`;
      if (btn) { btn.textContent = 'Move back'; btn.dataset.mode = 'rollback'; btn.disabled = false; }
      if (banner) banner.hidden = true;
    } else if (loc.inICloud) {
      if (status) status.innerHTML = `Currently inside iCloud: <code>${escapeHtml(loc.location)}</code> → will move to <code>${escapeHtml(loc.defaultTarget)}</code>. Requires a clean working tree.`;
      if (btn) { btn.textContent = 'Move…'; btn.dataset.mode = 'migrate'; btn.disabled = false; }
      if (banner && loc.needsMigration && !settings.icloudBannerDismissed) banner.hidden = false;
    } else {
      if (status) status.textContent = `Already outside iCloud: ${loc.location}`;
      if (btn) { btn.disabled = true; }
      if (banner) banner.hidden = true;
    }
  } catch {}
}

async function doMigrateGit(rollback = false) {
  const btn = $('#btn-migrate-git');
  const go = await confirmModal({
    title: rollback ? 'Move .git back into iCloud?' : 'Move .git out of iCloud?',
    body: rollback
      ? `The <code>.git</code> folder will be moved back into the repo. Requires a clean working tree.`
      : `Your <code>.git</code> folder will move to <code>~/.local/share/meatnotes-git</code> and a <code>gitdir:</code> pointer file will be left in place. Your notes stay where they are. This is reversible.`,
    okLabel: rollback ? 'Move back' : 'Move .git',
  });
  if (!go) return;
  btn.disabled = true; btn.textContent = rollback ? 'Moving back…' : 'Moving…';
  try {
    const res = await window.api.migrateGit({ rollback });
    if (res.ok) {
      const pointerLine = (res.status || []).find(s => s.startsWith('pointer now reads:'));
      alert(rollback
        ? '.git is now back inside the repo.'
        : `.git is now at ${res.target}.${pointerLine ? '\n\n' + pointerLine : ''}`);
    } else {
      const rawErr = (res.errors || []).join('\n') || res.stderr || `exit ${res.code}`;
      if (rawErr.includes('working tree is not clean')) {
        const dirty = (res.dirty || []).slice(0, 10);
        const dirtyBlock = dirty.length
          ? `\n\nUncommitted paths (first ${dirty.length}):\n${dirty.map(d => '  ' + d).join('\n')}`
          : '';
        alert(
          (rollback
            ? 'Rolling .git back into iCloud needs a clean working tree.'
            : 'Migration failed — working tree is not clean.') +
          '\n\nWhat to do: run "Sync Now" so pending edits are committed and pushed, then try again.' +
          (rollback
            ? ''
            : '\n\n(Note: migrating .git OUT of iCloud no longer requires a clean tree — if you still see this message, please report it.)') +
          dirtyBlock
        );
      } else {
        alert('Migration failed:\n' + rawErr);
      }
    }
  } finally {
    btn.disabled = false;
    refreshGitLocation();
  }
}

$('#btn-migrate-git')?.addEventListener('click', () => {
  const rollback = $('#btn-migrate-git').dataset.mode === 'rollback';
  doMigrateGit(rollback);
});
$('#btn-migrate-git-banner')?.addEventListener('click', () => doMigrateGit(false));
$('#btn-dismiss-icloud')?.addEventListener('click', () => { $('#icloud-banner').hidden = true; });
$('#btn-dismiss-icloud-forever')?.addEventListener('click', () => {
  $('#icloud-banner').hidden = true;
  window.api.saveSettings({ icloudBannerDismissed: true });
});

// ── Live updates ─────────────────────────────────────────────────────
window.api.onStatus((s) => {
  state.status = s;
  paintHeader(s);
  paintOverview(s);
  // Deploy pane is live if currently visible
  const deployVisible = !$('#pane-deploy').hidden;
  if (deployVisible) refreshDeploy();
});

window.api.onLogUpdated((entries) => {
  state.entries = entries || [];
  paintRecent(state.entries);
  if (!$('#pane-logs').hidden) refreshLogs();
});

// Countdown tick for next sync
setInterval(() => {
  if (state.status && !state.status.isSyncing && state.status.nextSyncAt) {
    $('#ov-next').textContent = `in ${fmtCountdown(state.status.nextSyncAt - Date.now())}`;
  }
}, 1000);

// ── Init ─────────────────────────────────────────────────────────────
(async function init() {
  showPane('overview');

  try {
    const [s, entries, version, app] = await Promise.all([
      window.api.getStatus(),
      window.api.getLogEntries(),
      window.api.getSiteVersion().catch(() => ''),
      window.api.getAppVersion().catch(() => ''),
    ]);
    state.status = s; state.entries = entries || [];
    paintHeader(s); paintOverview(s); paintRecent(state.entries);
    $('#version-site').textContent = version || '';
    $('#version-app').textContent = app ? `v${app}` : '';
    // Prime LFS quota (async; harmless if no token)
    window.api.fetchLfsQuota().then(() => { if (state.status) paintHeader(state.status); });
    refreshGitLocation();
  } catch (err) {
    console.error('init failed', err);
  }
})();
