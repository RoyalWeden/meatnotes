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
if date -u +"%Y-%m-%dT%H:%M:%SZ" > "$PROJECT/content/.last-sync" 2>>"$LOG_FILE"; then
  log "Wrote .last-sync timestamp"
else
  log "WARN: Could not write .last-sync"
fi

# ── Git LFS (isolated, non-fatal) ──────────────────────────────
# PDFs are tracked via LFS (.gitattributes: *.pdf filter=lfs).
# LFS pull is decoupled from the main sync so failures never block
# content updates. A hash cache avoids redundant pulls when nothing changed.
LFS_HASH_FILE="$HOME/.cache/quartz-sync/lfs-hash.txt"
mkdir -p "$(dirname "$LFS_HASH_FILE")"

if [ "${SKIP_LFS:-0}" = "1" ]; then
  log "LFS skipped by user setting"
  log "LFS_STATUS:skipped"
else
  CURRENT_LFS_HASH=$(git lfs ls-files -l 2>/dev/null | cut -d' ' -f1 | sort | shasum -a 256 | cut -d' ' -f1)
  CACHED_LFS_HASH=$(cat "$LFS_HASH_FILE" 2>/dev/null || echo "")

  if [ "$CURRENT_LFS_HASH" = "$CACHED_LFS_HASH" ] && [ -n "$CACHED_LFS_HASH" ]; then
    log "No new LFS objects to fetch"
    log "LFS_STATUS:unchanged"
  else
    log "Running git lfs pull..."
    # Throttle concurrent transfers if bandwidth limit is set
    if [ -n "${LFS_BANDWIDTH_LIMIT:-}" ]; then
      git config lfs.concurrenttransfers 1
    fi
    if git lfs pull >> "$LOG_FILE" 2>&1; then
      echo "$CURRENT_LFS_HASH" > "$LFS_HASH_FILE"
      log "LFS_STATUS:success"
    else
      log "WARN: git lfs pull had issues (non-fatal)"
      log "LFS_STATUS:failed"
    fi
    # Clean up throttle config
    if [ -n "${LFS_BANDWIDTH_LIMIT:-}" ]; then
      git config --unset lfs.concurrenttransfers 2>/dev/null || true
    fi
  fi
fi

# ── Run sync ───────────────────────────────────────────────────
# Skip LFS smudge during quartz sync's internal git pull so it
# never blocks on LFS — we already handled LFS above.
export GIT_LFS_SKIP_SMUDGE=1

log "Running quartz sync..."
if npx quartz sync >> "$LOG_FILE" 2>&1; then
  # Re-cache LFS hash after pull may have brought in new pointers
  NEW_LFS_HASH=$(git lfs ls-files -l 2>/dev/null | cut -d' ' -f1 | sort | shasum -a 256 | cut -d' ' -f1)
  if [ -n "$NEW_LFS_HASH" ]; then
    echo "$NEW_LFS_HASH" > "$LFS_HASH_FILE"
  fi
  log "Sync completed successfully"
else
  EXIT_CODE=$?
  log "ERROR: Sync failed with exit code $EXIT_CODE"
  osascript -e "display notification \"Sync failed (exit $EXIT_CODE)\" with title \"Quartz Sync Failed\""
  exit $EXIT_CODE
fi
