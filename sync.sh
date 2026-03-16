#!/bin/bash
source ~/.zprofile
source ~/.zshrc 2>/dev/null || true
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH
cd "/Users/roywe/Library/Mobile Documents/com~apple~CloudDocs/Octarine/workspaces/bible"
npx quartz sync
