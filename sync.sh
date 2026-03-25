#!/bin/bash
set -euo pipefail

# ── Environment ────────────────────────────────────────────────
eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH

PROJECT="/Users/roywe/Library/Mobile Documents/com~apple~CloudDocs/Octarine/workspaces/bible"
LOCK_FILE="/tmp/quartz-sync.lock"
LOG_FILE="$HOME/Library/Logs/quartz-sync.log"

# ── Lock file (prevent concurrent runs) ────────────────────────
if [ -f "$LOCK_FILE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Already running, skipping." >> "$LOG_FILE"
  exit 0
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

# ── Logging ────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

# ── Log rotation (keep last 2000 lines) ────────────────────────
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 2000 ]; then
  tail -n 2000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

log "Sync started"

# ── Pre-flight checks ──────────────────────────────────────────
if ! command -v node &>/dev/null; then
  log "ERROR: node not found in PATH"
  osascript -e 'display notification "node not found" with title "Quartz Sync Failed"'
  exit 1
fi

# ── Change directory ───────────────────────────────────────────
cd "$PROJECT" || { log "ERROR: Failed to cd to $PROJECT"; exit 1; }

# ── Network check ──────────────────────────────────────────────
if ! ping -c1 -W2 github.com &>/dev/null; then
  log "No internet connection, skipping sync"
  exit 0
fi

# ── Write sync timestamp ────────────────────────────────────────
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$PROJECT/content/.last-sync"

# ── Git LFS ────────────────────────────────────────────────────
# PDFs are tracked via LFS (.gitattributes: *.pdf filter=lfs).
# quartz sync does git pull which triggers LFS filters, but we
# explicitly pull LFS objects first to match the CI pipeline behavior.
git lfs pull >> "$LOG_FILE" 2>&1 || log "WARN: git lfs pull had issues (non-fatal)"

# ── Run sync ───────────────────────────────────────────────────
if npx quartz sync >> "$LOG_FILE" 2>&1; then
  log "Sync completed successfully"
else
  EXIT_CODE=$?
  log "ERROR: Sync failed with exit code $EXIT_CODE"
  osascript -e "display notification \"Sync failed (exit $EXIT_CODE)\" with title \"Quartz Sync Failed\""
  exit $EXIT_CODE
fi
