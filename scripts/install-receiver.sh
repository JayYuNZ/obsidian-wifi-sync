#!/usr/bin/env bash
# install-receiver.sh — Build the receiver plugin and install it into a Mac vault.
#
# Usage:
#   VAULT_PATH="/path/to/your/MacVault" ./scripts/install-receiver.sh
#
# Example:
#   VAULT_PATH="$HOME/Documents/MyVault" ./scripts/install-receiver.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RECEIVER_DIR="$REPO_ROOT/packages/receiver"

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

PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/wifi-sync-receiver"

echo "==> Building receiver plugin..."
cd "$REPO_ROOT"
~/.bun/bin/bun run build:receiver

echo "==> Installing to: $PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"

cp "$RECEIVER_DIR/dist/main.js" "$PLUGIN_DIR/main.js"
cp "$RECEIVER_DIR/manifest.json" "$PLUGIN_DIR/manifest.json"

echo ""
echo "Done! Next steps:"
echo "  1. Open Obsidian on your Mac and go to Settings → Community Plugins"
echo "  2. Disable safe mode if prompted"
echo "  3. Enable 'WiFi Sync Receiver'"
echo "  4. Open plugin settings, generate an auth token, and note your Mac IP"
echo "  5. Copy the auth token and IP to your mobile 'WiFi Sync Sender' settings"
