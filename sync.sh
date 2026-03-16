#!/bin/bash
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd "/Users/roywe/Library/Mobile Documents/com~apple~CloudDocs/Octarine/workspaces/bible"
node quartz/bootstrap-cli.mjs sync
