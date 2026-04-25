#!/usr/bin/env bash
# cleanup-icloud-dupes.sh — remove iCloud conflict artifacts (" N" suffixed files).
#
# Compatible with macOS's bash 3.2 (no mapfile, no assoc arrays).
#
# Modes:
#   --list                  Print FOUND:<path> for each duplicate, then DONE:<count>.
#   --remove [--commit]     git rm / rm the duplicates; with --commit also create a commit.
#
# Env: REPO (required) — repo root.

set -euo pipefail

REPO="${REPO:-}"
MODE="list"
DO_COMMIT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --list)   MODE="list"; shift ;;
    --remove) MODE="remove"; shift ;;
    --commit) DO_COMMIT=1; shift ;;
    --repo)   REPO="$2"; shift 2 ;;
    *)        echo "ERR:unknown arg $1" >&2; exit 2 ;;
  esac
done

[ -z "$REPO" ] && { echo "ERR:REPO not set"; exit 2; }
cd "$REPO"

# Build a newline-separated list of candidate duplicate paths:
# basename ends in " N" or " N.ext" AND a sibling without the " N" exists
# (either tracked or in the working tree). This keeps legitimate filenames
# like "Psalm 40.md" from being flagged.
ALL="$(mktemp)"
TMP="$(mktemp)"
trap 'rm -f "$ALL" "$TMP"' EXIT

{
  git ls-files 2>/dev/null || true
  git ls-files --others --exclude-standard 2>/dev/null || true
} | sort -u > "$ALL"

awk '
{
  full = $0
  n = split(full, parts, "/")
  base = parts[n]
  # strip trailing " N" or " N.ext"; capture the twin basename
  twin = ""
  if (match(base, / [0-9]+\.[^.]+$/)) {
    # " 2.md" → ".md"
    ext = substr(base, RSTART)
    sub(/ [0-9]+/, "", ext)
    twin = substr(base, 1, RSTART - 1) ext
  } else if (match(base, / [0-9]+$/)) {
    twin = substr(base, 1, RSTART - 1)
  } else {
    next
  }
  dir = ""
  for (i = 1; i < n; i++) dir = dir parts[i] "/"
  print full "\t" dir twin
}' "$ALL" > "$TMP.cands"

# For each candidate, keep only if the twin path exists in $ALL or on disk.
: > "$TMP"
while IFS=$'\t' read -r full twin; do
  [ -z "$full" ] && continue
  if grep -Fxq -- "$twin" "$ALL"; then
    echo "$full" >> "$TMP"
  elif [ -e "$twin" ] || [ -L "$twin" ]; then
    echo "$full" >> "$TMP"
  fi
done < "$TMP.cands"
rm -f "$TMP.cands"

count=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "FOUND:$f"
  count=$((count + 1))
done < "$TMP"

if [ "$MODE" = "list" ]; then
  echo "DONE:$count"
  exit 0
fi

removed=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if git ls-files --error-unmatch -- "$f" >/dev/null 2>&1; then
    if git rm -rf -- "$f" >/dev/null 2>&1; then
      echo "REMOVED:$f"
      removed=$((removed + 1))
    else
      echo "ERR:git rm failed for $f"
    fi
  else
    if rm -rf -- "$f" 2>/dev/null; then
      echo "REMOVED:$f"
      removed=$((removed + 1))
    else
      echo "ERR:rm failed for $f"
    fi
  fi
done < "$TMP"

if [ "$DO_COMMIT" = "1" ] && [ "$removed" -gt 0 ]; then
  if git diff --cached --quiet; then
    echo "ERR:nothing staged to commit"
  elif git commit -m "Remove iCloud conflict artifacts ($removed files)" >/dev/null 2>&1; then
    echo "COMMITTED:$removed"
  else
    echo "ERR:commit failed"
  fi
fi

echo "DONE:$removed"
