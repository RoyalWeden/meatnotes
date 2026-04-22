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

// ── Routing ──────────────────────────────────────────────────────────
function showPane(name) {
  $$('.pane').forEach(p => p.hidden = p.id !== `pane-${name}`);
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.pane === name));
  if (name === 'pdfs')    refreshPdfs();
  if (name === 'deploy')  refreshDeploy();
  if (name === 'logs')    refreshLogs();
  if (name === 'bg')      refreshBg();
  if (name === 'settings') refreshSettings();
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
    const cls = e.status === 'success' ? 'ok' : e.status === 'error' ? 'err' : 'warn';
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
async function refreshPdfs() {
  const [usage, changes, settings] = await Promise.all([
    window.api.getLfsUsage(),
    window.api.getLfsChanges(),
    window.api.getSettings(),
  ]);
  $('#lfs-today').textContent = fmtBytes(usage.usage?.dayBytes || 0);
  $('#lfs-month').textContent = fmtBytes(usage.usage?.monthBytes || 0);
  if (usage.quota) {
    $('#lfs-storage').textContent = `${(usage.quota.estimatedStorageForMonth || 0).toFixed(2)} GB`;
    $('#lfs-cycle').textContent = `${usage.quota.daysLeftInBillingCycle ?? '—'} d`;
  } else {
    $('#lfs-storage').textContent = '—';
    $('#lfs-cycle').textContent = settings.githubToken ? '—' : 'token required';
  }

  $('#opt-default').checked   = !!settings.includePdfsByDefault;
  $('#opt-optimize').checked  = !!settings.lfsOptimizePdfs;
  $('#opt-dedup').checked     = settings.lfsDedup !== false;
  $('#opt-throttle').value    = settings.lfsThrottleKBps || settings.lfsBandwidthLimit || 0;
  $('#opt-day-cap').value     = Math.round((settings.lfsDailyCapBytes || 0) / (1024 * 1024));
  $('#opt-month-cap').value   = Math.round((settings.lfsMonthlyCapBytes || 0) / (1024 * 1024));
  $('#opt-batch-files').value = settings.lfsBatchMinFiles || 0;
  $('#opt-batch-bytes').value = Math.round((settings.lfsBatchMinBytes || 0) / (1024 * 1024));
  $('#opt-quota-threshold').value = settings.lfsQuotaThreshold ?? 0.8;

  const host = $('#pdf-pending');
  if (!changes.changed.length) {
    host.className = 'list empty'; host.textContent = 'No pending PDF changes.';
  } else {
    host.className = 'list';
    host.innerHTML = changes.changed.slice(0, 30).map(f => `
      <div class="list-item">
        <span class="msg">${escapeHtml(f.path)}</span>
        <span class="pill">${fmtBytes(f.size)}</span>
      </div>`).join('')
      + (changes.changed.length > 30 ? `<div class="muted small">+${changes.changed.length - 30} more…</div>` : '')
      + `<div class="muted small" style="margin-top:6px">Total: ${changes.changed.length} files · ${fmtBytes(changes.bytesChanged)}</div>`;
  }
}

$('#btn-save-pdfs')?.addEventListener('click', () => {
  const patch = {
    includePdfsByDefault: $('#opt-default').checked,
    lfsOptimizePdfs:      $('#opt-optimize').checked,
    lfsDedup:             $('#opt-dedup').checked,
    lfsThrottleKBps:      parseInt($('#opt-throttle').value, 10) || 0,
    lfsBandwidthLimit:    parseInt($('#opt-throttle').value, 10) || 0,
    lfsDailyCapBytes:     (parseInt($('#opt-day-cap').value, 10)  || 0) * 1024 * 1024,
    lfsMonthlyCapBytes:   (parseInt($('#opt-month-cap').value, 10) || 0) * 1024 * 1024,
    lfsBatchMinFiles:     parseInt($('#opt-batch-files').value, 10) || 0,
    lfsBatchMinBytes:     (parseInt($('#opt-batch-bytes').value, 10) || 0) * 1024 * 1024,
    lfsQuotaThreshold:    parseFloat($('#opt-quota-threshold').value) || 0.8,
  };
  window.api.saveSettings(patch);
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
      const cls = e.status === 'success' ? 'ok' : e.status === 'error' ? 'err' : 'warn';
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
  $('#bg-username').value    = settings.bgUsername || '';
  $('#bg-password').value    = settings.bgPassword || '';
}
$('#btn-bg-sync')?.addEventListener('click', () => window.api.triggerBgSync());
$('#btn-save-bg')?.addEventListener('click', () => {
  window.api.saveSettings({
    bgUsername: $('#bg-username').value.trim(),
    bgPassword: $('#bg-password').value,
  });
  const btn = $('#btn-save-bg');
  const orig = btn.textContent;
  btn.textContent = 'Saved ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
});

// ── Settings pane ────────────────────────────────────────────────────
async function refreshSettings() {
  const s = await window.api.getSettings();
  $('#opt-interval').value = Math.max(1, Math.round((s.intervalSeconds || 900) / 60));
  $('#opt-login').checked  = !!s.loginItem;
  $('#opt-notify').value   = s.notifyLevel || 'errors';
  $('#opt-token').value    = s.githubToken || '';
}
$('#btn-save-settings')?.addEventListener('click', () => {
  const intervalMin = Math.max(1, parseInt($('#opt-interval').value, 10) || 15);
  window.api.setInterval(intervalMin * 60);
  window.api.setLoginItem($('#opt-login').checked);
  window.api.saveSettings({
    notifyLevel: $('#opt-notify').value,
    githubToken: $('#opt-token').value,
  });
});

// ── Top-bar actions ──────────────────────────────────────────────────
$('#btn-sync-now')?.addEventListener('click', () => window.api.syncNow());
$('#btn-sync-no-pdfs')?.addEventListener('click', () => window.api.syncNoPdfs());
$('#btn-sync-with-pdfs')?.addEventListener('click', () => window.api.syncWithPdfs());
$('#btn-pause')?.addEventListener('click', () => window.api.togglePause());

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
  } catch (err) {
    console.error('init failed', err);
  }
})();
