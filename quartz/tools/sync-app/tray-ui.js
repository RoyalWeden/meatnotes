'use strict';
const { Notification, nativeImage } = require('electron');
const { makeCircleIcon } = require('./icon-generator');
const { isAgentLoaded } = require('./plist-manager');
const { state, loadSettings, COLORS, SPINNER_FRAMES } = require('./state');

// ── Icon helpers ──────────────────────────────────────────────────────────
function makeIcon(color) {
  const [r, g, b] = COLORS[color] || COLORS.grey;
  const buf = makeCircleIcon(r, g, b, 32);
  return nativeImage.createFromBuffer(buf, { scaleFactor: 2 });
}

const ICON_CACHE = {};
function getCachedIcon(color) {
  if (!ICON_CACHE[color]) ICON_CACHE[color] = makeIcon(color);
  return ICON_CACHE[color];
}

// ── Icon / title management ────────────────────────────────────────────────
function setTrayState(color, label) {
  if (!state.tray) return;
  state.tray.setImage(getCachedIcon(color));
  state.tray.setTitle(label ? ` ${label}` : '');
}

function refreshTrayAppearance() {
  if (state.isSyncing) return;
  const paused = !isAgentLoaded();
  const { getLastSyncTime, formatTime } = require('./time-helpers');
  const lastTime = getLastSyncTime();
  const rawTimeLabel = formatTime(lastTime);
  // Round-5 R6 \u2014 never let the tray title literally say "never". If we have
  // no .last-sync timestamp yet, show an empty string instead so the icon
  // stands alone. If we DO have a time AND a notes count > 0, show both
  // ("7:51 \u21912") so the user sees activity at a glance.
  const safeTime = (rawTimeLabel === 'never') ? '' : rawTimeLabel;
  const count = state.lastNotesChanged > 0 ? `\u2191${state.lastNotesChanged}` : '';
  const compoundLabel = [safeTime, count].filter(Boolean).join(' ');
  if (state.isWaiting)               setTrayState('orange', safeTime);
  else if (state.isQuietHours)       setTrayState('blue',   '\ud83c\udf19');
  else if (paused)                   setTrayState('grey',   '\u23f8');
  else if (state.lastSyncError)      setTrayState('red',    safeTime);
  else if (state.lfsStatus === 'failed') setTrayState('orange', compoundLabel || safeTime);
  else                               setTrayState('green',  compoundLabel || safeTime);
}

function startSpinner() {
  state.isSyncing = true;
  state.spinnerTimer = setInterval(() => {
    if (!state.tray) return;
    state.spinnerFrame = (state.spinnerFrame + 1) % SPINNER_FRAMES.length;
    state.tray.setImage(getCachedIcon('yellow'));
    state.tray.setTitle(` ${SPINNER_FRAMES[state.spinnerFrame]}`);
  }, 200);
}

function stopSpinner() {
  state.isSyncing = false;
  clearInterval(state.spinnerTimer);
  state.spinnerTimer = null;
  refreshTrayAppearance();
}

function flashTraySuccess() {
  let count = 0;
  const t = setInterval(() => {
    setTrayState(count % 2 === 0 ? 'grey' : 'green', '');
    if (++count >= 4) { clearInterval(t); refreshTrayAppearance(); }
  }, 250);
}

function flashTrayError() {
  let count = 0;
  const t = setInterval(() => {
    setTrayState(count % 2 === 0 ? 'grey' : 'red', '');
    if (++count >= 6) { clearInterval(t); refreshTrayAppearance(); }
  }, 300);
}

// ── Notifications ──────────────────────────────────────────────────────────
function notifyIfAllowed(title, body, opts = {}) {
  const nl = loadSettings().notifyLevel || 'errors';
  if (nl !== 'all') return null;
  const n = new Notification({ title, body, ...opts });
  n.show();
  return n;
}

function notifyError(title, body, opts = {}) {
  const nl = loadSettings().notifyLevel || 'errors';
  if (nl === 'never') return null;
  const n = new Notification({ title, body, ...opts });
  n.show();
  return n;
}

module.exports = {
  makeIcon,
  getCachedIcon,
  setTrayState,
  refreshTrayAppearance,
  startSpinner,
  stopSpinner,
  flashTraySuccess,
  flashTrayError,
  notifyIfAllowed,
  notifyError,
};
