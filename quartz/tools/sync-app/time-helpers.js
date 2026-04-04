'use strict';
const fs = require('fs');
const { state, loadSettings, LAST_SYNC_FILE } = require('./state');
const { isAgentLoaded } = require('./plist-manager');

function getLastSyncTime() {
  try { return new Date(fs.readFileSync(LAST_SYNC_FILE, 'utf8').trim()); } catch { return null; }
}

function formatTime(date) {
  if (!date || isNaN(date)) return 'never';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatInterval(seconds) {
  if (seconds < 3600) return `${seconds / 60} min`;
  const h = seconds / 3600;
  return h === 1 ? '1 hour' : `${h} hours`;
}

function getPlistInterval() {
  try { return loadSettings().intervalSeconds || 1800; } catch { return 1800; }
}

function getCountdownText(paused) {
  if (state.isWaiting)      return '\u23f3 Waiting for PDF to close\u2026';
  if (state.isQuietHours)   return '\ud83c\udf19 Quiet hours active';
  if (paused)               return '\u23f8 Auto-sync paused';
  if (!state.nextSyncAt) {
    const lastSync = getLastSyncTime();
    if (!lastSync || isNaN(lastSync)) return 'Next sync: unknown';
    const diff = lastSync.getTime() + getPlistInterval() * 1000 - Date.now();
    if (diff <= 0) return 'Next sync: very soon';
    return `Next sync in: ${Math.ceil(diff / 60_000)} min`;
  }
  const diff = state.nextSyncAt - Date.now();
  if (diff <= 0) return 'Next sync: very soon';
  return `Next sync in: ${Math.ceil(diff / 60_000)} min`;
}

function parseTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isInQuietWindow(settings) {
  const qh = settings.quietHours;
  if (!qh || !qh.enabled) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = parseTime(qh.start || '22:00');
  const end   = parseTime(qh.end   || '07:00');
  if (start <= end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

function msUntilQuietEnd(settings) {
  const qh = settings.quietHours;
  const endStr = qh?.end || '07:00';
  const [eh, em] = endStr.split(':').map(Number);
  const now = new Date();
  const end = new Date(now);
  end.setHours(eh, em, 0, 0);
  if (end <= now) end.setDate(end.getDate() + 1);
  return end.getTime() - now.getTime();
}

module.exports = {
  getLastSyncTime,
  formatTime,
  formatInterval,
  getPlistInterval,
  getCountdownText,
  parseTime,
  isInQuietWindow,
  msUntilQuietEnd,
};
