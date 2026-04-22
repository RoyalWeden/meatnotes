'use strict';
// This file is permanent — it never needs to change after install.
// All real app logic lives in the repo and auto-updates via quartz sync.
// Just quit and relaunch the app to pick up any code changes.
const path = require('path');
const REPO_APP = '/Users/roywe/Library/Mobile Documents/iCloud~com~octarine~notes/Documents/workspaces/bible/quartz/tools/sync-app';
require(path.join(REPO_APP, 'main.js'));
