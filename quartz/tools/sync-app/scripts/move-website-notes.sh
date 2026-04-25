#!/usr/bin/env bash
# move-website-notes.sh — move notes whose frontmatter has `publish: true`
# into content/Website/ and rewrite any [[wikilinks]] that pointed at them.
#
# Rationale:
#   content/ mixes private daily notes with website-bound notes. The user
#   wants website-only notes gathered under content/Website/ for clarity.
#   Quartz resolves [[wikilinks]] globally by filename, so moving the file
#   does not break links — but we still rewrite any [[wikilinks]] that
#   included a folder path, to keep things tidy.
#
# Modes:
#   --list              Print FOUND:<path> for each candidate; DONE:<count>.
#   --move [--commit]   Move files via git mv and rewrite inbound wikilinks;
#                       with --commit, create one commit at the end.
#
# Env: REPO (required) — repo root containing content/.
#
# Compatible with macOS bash 3.2 (no mapfile, no assoc arrays).

set -euo pipefail

REPO="${REPO:-}"
MODE="list"
DO_COMMIT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --list)   MODE="list";   shift ;;
    --move)   MODE="move";   shift ;;
    --commit) DO_COMMIT=1;   shift ;;
    --repo)   REPO="$2";     shift 2 ;;
    *)        echo "ERR:unknown arg $1" >&2; exit 2 ;;
  esac
done

[ -z "$REPO" ] && { echo "ERR:REPO not set"; exit 2; }
cd "$REPO"

[ -d "content" ] || { echo "ERR:content/ missing at $REPO"; exit 2; }

DEST="content/Website"
mkdir -p "$DEST"

TMP_CANDS="$(mktemp)"
TMP_BASES="$(mktemp)"
trap 'rm -f "$TMP_CANDS" "$TMP_BASES"' EXIT

# Gather candidates: *.md under content/ (follow symlink) whose frontmatter
# contains `publish: true`. Skip anything already under content/Website/.
# We require the file to start with a `---` frontmatter block.
find -L content -type f -name '*.md' 2>/dev/null \
  | grep -v '^content/Website/' \
  | while IFS= read -r f; do
      # Only scan the first ~40 lines for a frontmatter block.
      head -n 1 "$f" 2>/dev/null | grep -qx -- '---' || continue
      # Extract lines from start to the closing '---'; check for publish: true.
      awk '
        NR==1 && $0=="---" { inside=1; next }
        inside && $0=="---" { exit }
        inside && /^publish:[[:space:]]*true[[:space:]]*$/ { found=1 }
        END { exit found ? 0 : 1 }
      ' "$f" 2>/dev/null && echo "$f" >> "$TMP_CANDS" || true
    done

count=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "FOUND:$f"
  count=$((count + 1))
done < "$TMP_CANDS"

if [ "$MODE" = "list" ]; then
  echo "DONE:$count"
  exit 0
fi

# ------ MOVE MODE ------
moved=0
# Collect basenames (without .md) for wikilink rewriting after the moves.
: > "$TMP_BASES"

while IFS= read -r src; do
  [ -z "$src" ] && continue
  base="$(basename "$src")"
  dst="$DEST/$base"
  # If a same-name file already exists at dst, skip with a warning.
  if [ -e "$dst" ] && [ "$src" != "$dst" ]; then
    echo "ERR:destination exists, skipping: $dst"
    continue
  fi
  if git ls-files --error-unmatch -- "$src" >/dev/null 2>&1; then
    if git mv -- "$src" "$dst" >/dev/null 2>&1; then
      echo "MOVED:$src -> $dst"
      moved=$((moved + 1))
      echo "${base%.md}" >> "$TMP_BASES"
    else
      echo "ERR:git mv failed for $src"
    fi
  else
    mkdir -p "$(dirname "$dst")"
    if mv -- "$src" "$dst" 2>/dev/null; then
      echo "MOVED:$src -> $dst"
      moved=$((moved + 1))
      echo "${base%.md}" >> "$TMP_BASES"
    else
      echo "ERR:mv failed for $src"
    fi
  fi
done < "$TMP_CANDS"

# Rewrite inbound wikilinks: any [[path/to/basename]] or [[basename]] that
# resolves to one of the moved files gets rewritten to [[Website/basename]].
# Quartz resolves links by filename, so we only need to fix ones that
# explicitly include a folder segment pointing at the old location.
rewrote=0
if [ "$moved" -gt 0 ]; then
  while IFS= read -r bname; do
    [ -z "$bname" ] && continue
    # Escape regex metacharacters in basename for sed.
    esc="$(printf '%s' "$bname" | sed 's/[][\.*^$/+?()|{}]/\\&/g')"
    # Find md files (excluding Website/) that reference a [[.../bname]]
    # pattern where the middle part is NOT already "Website".
    while IFS= read -r mdfile; do
      [ -z "$mdfile" ] && continue
      # Perl: rewrite [[<prefix>/<bname>(|alias)?]] -> [[Website/<bname>...]]
      # Leave bare [[bname]] alone (Quartz resolves it globally).
      if perl -i -pe '
        s{\[\[(?!Website/)(?:[^\[\]\|]+/)?'"$esc"'(\|[^\]]*)?\]\]}{[[Website/'"$esc"'$1]]}g
      ' "$mdfile" 2>/dev/null; then
        # Only count if the file is now modified in git.
        if git diff --quiet -- "$mdfile" 2>/dev/null; then
          :
        else
          echo "REWROTE:$mdfile"
          rewrote=$((rewrote + 1))
        fi
      fi
    done < <(git ls-files 'content/*.md' 2>/dev/null | grep -v '^content/Website/')
  done < "$TMP_BASES"
fi

if [ "$DO_COMMIT" = "1" ] && [ "$moved" -gt 0 ]; then
  git add -A content/ >/dev/null 2>&1 || true
  if git diff --cached --quiet; then
    echo "ERR:nothing staged to commit"
  elif git commit -m "Organize: move $moved website-only notes to content/Website/" >/dev/null 2>&1; then
    echo "COMMITTED:$moved"
  else
    echo "ERR:commit failed"
  fi
fi

echo "DONE:$moved"
