'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const plist = require('plist');

const PLIST_PATH = path.join(os.homedir(), 'Library/LaunchAgents/com.roywe.quartz-sync.plist');
const AGENT_LABEL = 'com.roywe.quartz-sync';

let plistCache = null; // { mtimeMs, result }

function readPlist() {
  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(PLIST_PATH).mtimeMs; } catch {}
  if (plistCache && plistCache.mtimeMs === mtimeMs) return plistCache.result;

  const raw = fs.readFileSync(PLIST_PATH, 'utf8');
  const data = plist.parse(raw);
  const result = {
    label: data.Label,
    startInterval: data.StartInterval || 1800,
    programArguments: data.ProgramArguments || [],
    raw: data,
  };
  plistCache = { mtimeMs, result };
  return result;
}

function invalidatePlistCache() { plistCache = null; }

function writePlist(data) {
  const xml = plist.build(data);
  fs.writeFileSync(PLIST_PATH, xml, 'utf8');
}

function writeInterval(seconds) {
  const { raw } = readPlist();
  raw.StartInterval = seconds;
  writePlist(raw);
}

let agentLoadedCache = null; // { result, ts }
const AGENT_CACHE_TTL = 5000;

function isAgentLoaded() {
  if (agentLoadedCache && Date.now() - agentLoadedCache.ts < AGENT_CACHE_TTL) {
    return agentLoadedCache.result;
  }
  try {
    const out = execSync(`launchctl list 2>/dev/null`, { encoding: 'utf8' });
    const result = out.includes(AGENT_LABEL);
    agentLoadedCache = { result, ts: Date.now() };
    return result;
  } catch {
    agentLoadedCache = { result: false, ts: Date.now() };
    return false;
  }
}

function invalidateAgentCache() { agentLoadedCache = null; }

function unloadAgent() {
  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { encoding: 'utf8' });
  } catch {
    // May fail if not loaded — that's fine
  }
}

function loadAgent() {
  execSync(`launchctl load "${PLIST_PATH}"`, { encoding: 'utf8' });
}

module.exports = { readPlist, writeInterval, isAgentLoaded, invalidateAgentCache, invalidatePlistCache, unloadAgent, loadAgent, PLIST_PATH };
