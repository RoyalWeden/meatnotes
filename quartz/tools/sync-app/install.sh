#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHELL_DIR="$SCRIPT_DIR/shell"
APP_NAME="Bible Notes Sync.app"
INSTALL_TARGET="/Applications/$APP_NAME"

echo ""
echo "  Bible Notes Sync — Installer"
echo "  ─────────────────────────────"
echo ""

echo "→ Installing app runtime dependencies..."
cd "$SCRIPT_DIR"
npm install --silent

echo "→ Installing shell dependencies..."
cd "$SHELL_DIR"
npm install --silent

echo "→ Building $APP_NAME..."
npm run build 2>&1 | grep -E '(packaging|error|warning|✓|⨯)' || true

BUILT_APP="$SHELL_DIR/dist/mac-arm64/$APP_NAME"
if [ ! -d "$BUILT_APP" ]; then
  echo ""
  echo "✗ Build failed — $APP_NAME not found in dist/"
  exit 1
fi

echo "→ Installing to /Applications/..."
if [ -d "$INSTALL_TARGET" ]; then
  echo "  (replacing existing installation)"
  rm -rf "$INSTALL_TARGET"
fi
cp -R "$BUILT_APP" "$INSTALL_TARGET"

echo ""
echo "  ✅ Done! Bible Notes Sync is installed."
echo ""
echo "     Launch:   open '/Applications/Bible Notes Sync.app'"
echo "     Updates:  automatic — quartz sync keeps the app current."
echo "               Just quit + relaunch to pick up changes."
echo ""
