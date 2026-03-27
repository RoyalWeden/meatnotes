'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const plist = require('plist');

const PLIST_PATH = path.join(os.homedir(), 'Library/LaunchAgents/com.roywe.quartz-sync.plist');
const AGENT_LABEL = 'com.roywe.quartz-sync';

function readPlist() {
  const raw = fs.readFileSync(PLIST_PATH, 'utf8');
  const data = plist.parse(raw);
  return {
    label: data.Label,
    startInterval: data.StartInterval || 1800,
    programArguments: data.ProgramArguments || [],
    raw: data,
  };
}

function writePlist(data) {
  const xml = plist.build(data);
  fs.writeFileSync(PLIST_PATH, xml, 'utf8');
}

function writeInterval(seconds) {
  const { raw } = readPlist();
  raw.StartInterval = seconds;
  writePlist(raw);
}

function isAgentLoaded() {
  try {
    const out = execSync(`launchctl list 2>/dev/null`, { encoding: 'utf8' });
    return out.includes(AGENT_LABEL);
  } catch {
    return false;
  }
}

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

module.exports = { readPlist, writeInterval, isAgentLoaded, unloadAgent, loadAgent, PLIST_PATH };
