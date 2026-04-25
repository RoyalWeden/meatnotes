#!/usr/bin/env bash
# migrate-git-out-of-icloud.sh
#
# Move a repo's .git directory out of iCloud Drive to prevent file-provider
# conflicts (e.g. ".git 2" duplicates). Leaves a "gitdir:" pointer file in
# place so the working tree continues to behave like a normal repo.
#
# Usage:
#   REPO=/path/to/repo TARGET=~/.local/share/meatnotes-git $0
#   REPO=/path/to/repo TARGET=... $0 --rollback
#
# Machine-readable stdout:
#   STATUS:<message>
#   OK
#   ERR:<message>
# Exit codes:
#   0 success, 2 bad arguments, 3 unclean tree, 4 already migrated / nothing to do

set -euo pipefail

REPO="${REPO:-}"
TARGET="${TARGET:-}"
MODE="migrate"

while [ $# -gt 0 ]; do
  case "$1" in
    --rollback) MODE="rollback"; shift ;;
    *) echo "ERR:unknown arg $1" >&2; exit 2 ;;
  esac
done

[ -z "$REPO" ]   && { echo "ERR:REPO not set"; exit 2; }
[ -z "$TARGET" ] && { echo "ERR:TARGET not set"; exit 2; }

cd "$REPO"

git_is_pointer() {
  [ -f "$REPO/.git" ] && head -n1 "$REPO/.git" | grep -q "^gitdir: "
}

pointer_target() {
  head -n1 "$REPO/.git" | sed 's/^gitdir: //'
}

ensure_clean_tree() {
  local dirty
  dirty="$(git status --porcelain | head -n 10)"
  if [ -n "$dirty" ]; then
    echo "ERR:working tree is not clean — commit or stash changes first"
    while IFS= read -r line; do
      printf "DIRTY:%s\n" "$line"
    done <<< "$dirty"
    exit 3
  fi
}

if [ "$MODE" = "migrate" ]; then
  if git_is_pointer; then
    echo "ERR:already migrated (pointer → $(pointer_target))"
    exit 4
  fi
  if [ ! -d "$REPO/.git" ]; then
    echo "ERR:$REPO/.git is not a directory"
    exit 4
  fi

  # NOTE: We deliberately do NOT require a clean working tree here. Moving the
  # internal .git store does not touch any worktree files; the symlink in
  # content/ (iCloud-backed) can make `git status` report phantom "deleted"
  # paths that would otherwise block migration for no real reason.

  echo "STATUS:creating target dir $(dirname "$TARGET")"
  mkdir -p "$(dirname "$TARGET")"

  if [ -e "$TARGET" ]; then
    echo "ERR:target already exists: $TARGET"
    exit 4
  fi

  echo "STATUS:moving .git to $TARGET"
  mv "$REPO/.git" "$TARGET"

  echo "STATUS:writing gitdir pointer"
  printf "gitdir: %s\n" "$TARGET" > "$REPO/.git"

  echo "STATUS:verifying"
  if ! git -C "$REPO" status >/dev/null 2>&1; then
    echo "ERR:verification failed — attempting rollback"
    rm -f "$REPO/.git"
    mv "$TARGET" "$REPO/.git"
    echo "ERR:rolled back; .git restored"
    exit 5
  fi

  echo "STATUS:pointer now reads: $(head -n1 "$REPO/.git")"
  echo "OK"
  exit 0
fi

if [ "$MODE" = "rollback" ]; then
  if ! git_is_pointer; then
    echo "ERR:not migrated — nothing to roll back"
    exit 4
  fi
  SRC="$(pointer_target)"
  if [ ! -d "$SRC" ]; then
    echo "ERR:pointer target missing: $SRC"
    exit 4
  fi

  ensure_clean_tree

  echo "STATUS:removing pointer"
  rm -f "$REPO/.git"

  echo "STATUS:moving $SRC back to $REPO/.git"
  mv "$SRC" "$REPO/.git"

  echo "STATUS:verifying"
  if ! git -C "$REPO" status >/dev/null 2>&1; then
    echo "ERR:verification failed after rollback"
    exit 5
  fi

  echo "OK"
  exit 0
fi
