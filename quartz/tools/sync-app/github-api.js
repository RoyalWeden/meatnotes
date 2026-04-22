'use strict';
const { state, loadSettings, GITHUB_API_OWNER, GITHUB_API_REPO, DEPLOY_WORKFLOW_FILE } = require('./state');
const { pushStatusToWindow } = require('./status');
const { notifyError } = require('./tray-ui');

function getGithubHeaders() {
  const token = loadSettings().githubToken || process.env.GITHUB_TOKEN || '';
  const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'quartz-sync-app' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// Fetch the job+step list for a workflow run. Each job.steps[] has:
//   { name, status, conclusion, number, started_at, completed_at }
// Returns [] on any error (unauthenticated or rate-limited).
async function fetchRunJobs(runId) {
  if (!runId) return [];
  try {
    const url = `https://api.github.com/repos/${GITHUB_API_OWNER}/${GITHUB_API_REPO}/actions/runs/${runId}/jobs?per_page=20`;
    const res = await fetch(url, { headers: getGithubHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.jobs || []).map(j => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      url: j.html_url,
      steps: (j.steps || []).map(s => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
        number: s.number,
        startedAt: s.started_at,
        completedAt: s.completed_at,
      })),
    }));
  } catch {
    return [];
  }
}

// Fetch LFS/Actions quota for the authenticated user/org. Uses the billing
// endpoints which require a token with `repo` scope (user) or admin:org (org).
// Returns null if no token or the call fails — callers should fall back gracefully.
async function fetchLfsQuota() {
  const token = loadSettings().githubToken || process.env.GITHUB_TOKEN || '';
  if (!token) return null;
  try {
    const storageUrl = `https://api.github.com/users/${GITHUB_API_OWNER}/settings/billing/shared-storage`;
    const res = await fetch(storageUrl, { headers: getGithubHeaders() });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      daysLeftInBillingCycle: j.days_left_in_billing_cycle ?? null,
      estimatedPaidStorageForMonth: j.estimated_paid_storage_for_month ?? 0,
      estimatedStorageForMonth: j.estimated_storage_for_month ?? 0,
    };
  } catch {
    return null;
  }
}

async function pollLfsQuota() {
  clearTimeout(state.lfsQuotaPollTimer);
  const quota = await fetchLfsQuota();
  if (quota) {
    state.lfsQuota = quota;
    pushStatusToWindow();
  }
  state.lfsQuotaPollTimer = setTimeout(pollLfsQuota, 5 * 60_000);
}

async function pollDeployStatus() {
  clearTimeout(state.deployPollTimer);
  try {
    const url = `https://api.github.com/repos/${GITHUB_API_OWNER}/${GITHUB_API_REPO}/actions/workflows/${DEPLOY_WORKFLOW_FILE}/runs?per_page=3`;
    const res = await fetch(url, { headers: getGithubHeaders() });
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '60', 10);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const runs = json.workflow_runs || [];

    if (runs.length > 0) {
      const prev = state.deployStatus;
      state.deployRuns = runs.map(run => ({
        status:     run.status,
        conclusion: run.conclusion,
        runId:      run.id,
        runNumber:  run.run_number,
        updatedAt:  run.updated_at,
        url:        run.html_url,
        headSha:    run.head_sha,
      }));
      state.deployStatus = state.deployRuns[0];

      // Fetch job+step list for the current run so the Deploy pane can render a live checklist.
      if (state.deployStatus.runId) {
        fetchRunJobs(state.deployStatus.runId).then(jobs => {
          state.deployJobs = jobs;
          pushStatusToWindow();
        });
      }

      const wasInProgress = prev?.status === 'in_progress';
      const nowFailed = state.deployStatus.status === 'completed' && state.deployStatus.conclusion === 'failure';
      if (wasInProgress && nowFailed) {
        notifyError('Deploy Failed', `Run #${state.deployStatus.runNumber} failed. Check deploy logs in the sync window.`);
      }

      if (!prev ||
          prev.status !== state.deployStatus.status ||
          prev.conclusion !== state.deployStatus.conclusion ||
          prev.runId !== state.deployStatus.runId) {
        pushStatusToWindow();
      }
    }
    const interval = remaining < 5 ? 60_000
      : state.deployStatus?.status === 'in_progress' ? 10_000
      : 60_000;
    state.deployPollTimer = setTimeout(pollDeployStatus, interval);
  } catch {
    state.deployPollTimer = setTimeout(pollDeployStatus, 60_000);
  }
}

module.exports = { getGithubHeaders, pollDeployStatus, fetchRunJobs, fetchLfsQuota, pollLfsQuota };
