#!/bin/bash
eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd "/Users/roywe/Library/Mobile Documents/com~apple~CloudDocs/Octarine/workspaces/bible"
npx quartz sync
