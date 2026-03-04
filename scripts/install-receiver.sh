#!/usr/bin/env bash
# install-receiver.sh — Build the WiFi Sync plugin and install it into a Mac vault.
#
# Usage:
#   VAULT_PATH="/path/to/your/MacVault" ./scripts/install-receiver.sh
#
# Example:
#   VAULT_PATH="$HOME/Documents/MyVault" ./scripts/install-receiver.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/packages/wifi-sync"

if [[ -z "${VAULT_PATH:-}" ]]; then
  echo "Error: VAULT_PATH is not set."
  echo ""
  echo "Usage: VAULT_PATH=/path/to/your/vault $0"
  echo "Example: VAULT_PATH=\"\$HOME/Documents/MyVault\" $0"
  exit 1
fi

if [[ ! -d "$VAULT_PATH" ]]; then
  echo "Error: VAULT_PATH does not exist: $VAULT_PATH"
  exit 1
fi

PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/wifi-sync"

echo "==> Building WiFi Sync plugin..."
cd "$REPO_ROOT"
~/.bun/bin/bun run build

echo "==> Installing to: $PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"

cp "$PLUGIN_SRC/dist/main.js" "$PLUGIN_DIR/main.js"
cp "$PLUGIN_SRC/manifest.json" "$PLUGIN_DIR/manifest.json"

echo ""
echo "Done! Next steps:"
echo "  1. Open Obsidian on your Mac and go to Settings → Community Plugins"
echo "  2. Disable safe mode if prompted"
echo "  3. Enable 'WiFi Sync'"
echo "  4. Open plugin settings, generate an auth token"
echo "  5. Scan the QR code with your iPhone to auto-configure the mobile side"
