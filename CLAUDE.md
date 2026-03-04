# WiFi Sync Plugin — Claude Code Context

## Monorepo Structure

```
packages/
  receiver/   Obsidian plugin installed on Mac (desktop). Acts as HTTP server.
  sender/     Obsidian plugin installed on iOS (mobile). Initiates sync.
  shared/     Common types, auth, path utilities. Not a plugin — source only.
scripts/
  install-receiver.sh   Copies receiver dist into a vault's plugins folder.
```

## Key Constraints

### Sender (iOS/mobile)
- **Must use ONLY `requestUrl` from `obsidian`** for HTTP calls — never `fetch`, `XMLHttpRequest`, or Node's `http`. Mobile Obsidian does not provide Node.js.
- No Node built-ins available. Pure browser/Obsidian API environment.

### Receiver (Mac/desktop — runs in Electron)
- Uses Node built-ins: `http`, `https`, `crypto`, `os`. These are available via Electron.
- **Mark Node built-ins as `external` in esbuild** — never bundle them. See `packages/receiver/esbuild.config.mjs`.
- Uses `crypto.subtle` for hashing (Web Crypto API, available in both Electron and iOS).

## Shared Code Resolution

The `@wifi-sync/shared` import alias is resolved at build time by esbuild:

```
@wifi-sync/shared/auth   → ../shared/src/auth.ts
@wifi-sync/shared/types  → ../shared/src/types.ts
@wifi-sync/shared/paths  → ../shared/src/paths.ts
```

This avoids npm linking — the shared package is inlined into each plugin's bundle.

## Build Commands

```bash
# Build both plugins
npm run build

# Build individually
npm run build:receiver
npm run build:sender

# Type-check without emitting (esbuild skips type errors)
npm run typecheck

# Watch mode for development
npm run dev:receiver
npm run dev:sender
```

Output: `packages/receiver/dist/main.js` and `packages/sender/dist/main.js`

## Install Receiver

```bash
VAULT_PATH="$HOME/path/to/YourVault" ./scripts/install-receiver.sh
```

This copies `dist/main.js` + `manifest.json` into `.obsidian/plugins/wifi-sync-receiver/`.

## Install Sender on Mobile

Manually copy these two files into the mobile vault's plugin folder:
- `packages/sender/dist/main.js`
- `packages/sender/manifest.json`

Target: `.obsidian/plugins/wifi-sync-sender/`

On iOS with the Obsidian mobile app, use the Files app or a tool like Working Copy.

## Local Two-Vault Testing

1. Install receiver into a Mac vault, enable the plugin, generate an auth token, note the port.
2. Install sender into a second vault on the same Mac, enable it.
3. In sender settings: set Receiver IP to `127.0.0.1`, set port and auth token to match receiver.
4. Click "Sync Now" — files should appear in the receiver vault.

## Architecture Notes

- **Auth**: Bearer token (generated UUID, stored in plugin data). Validated on every request.
- **Conflict strategies**: `overwrite`, `keep-both` (creates a `-mobile-<timestamp>` copy), `skip`.
- **Incremental sync**: tracks `lastSyncTimestamp`; only sends files modified after last sync.
- **Body size limit**: `readBody` in `routes.ts` caps payloads at 10 MB (returns 413 if exceeded).
- **Request timeout**: `httpClient.ts` wraps `requestUrl` in a 30-second `Promise.race`.
- **Hash failures**: `crypto.subtle.digest` calls are wrapped in try-catch; failed files are skipped with a console warning rather than crashing the sync.
