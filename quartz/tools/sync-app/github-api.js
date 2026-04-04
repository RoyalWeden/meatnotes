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

module.exports = { getGithubHeaders, pollDeployStatus };
