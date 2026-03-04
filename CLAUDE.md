# WiFi Sync Plugin — Claude Code Context

## Monorepo Structure

```
packages/
  wifi-sync/  Single community plugin (desktop receiver + mobile sender in one).
    src/
      main.ts           Platform detection entry point
      receiver/         Desktop-only code (runs in Electron/Node.js)
        core.ts         ReceiverCore class
        server.ts       HTTPS/HTTP server
        routes.ts       Request handling
        settings.ts     ReceiverSettingTab
        statusBar.ts
        conflictResolver.ts
      sender/           Mobile code (pure browser/Obsidian API)
        core.ts         SenderCore class
        syncEngine.ts
        httpClient.ts
        fileCollector.ts
        discovery.ts
        settings.ts     SenderSettingTab
    manifest.json
    esbuild.config.mjs
    tsconfig.json
  shared/     Common types, auth, path utilities. Not a plugin — source only.
scripts/
  install-receiver.sh   Copies wifi-sync dist into a vault's plugins folder.
```

## Platform Detection

`src/main.ts` uses `Platform.isDesktop` at runtime to load either `ReceiverCore` or `SenderCore` via dynamic import. esbuild bundles both, but Node built-ins in receiver code are loaded via inline `require()` inside functions — they never execute on mobile.

## Key Constraints

### Sender (iOS/mobile — SenderCore)
- **Must use ONLY `requestUrl` from `obsidian`** for HTTP calls — never `fetch`, `XMLHttpRequest`, or Node's `http`. Mobile Obsidian does not provide Node.js.
- No Node built-ins available. Pure browser/Obsidian API environment.

### Receiver (Mac/desktop — ReceiverCore, runs in Electron)
- Uses Node built-ins: `http`, `https`, `crypto`, `os`. These are available via Electron.
- **Mark Node built-ins as `external` in esbuild** — never bundle them. See `packages/wifi-sync/esbuild.config.mjs`.
- Node built-ins use `import type` at file level + inline `require()` inside function bodies so mobile never triggers them.
- Uses `crypto.subtle` for hashing (Web Crypto API, available in both Electron and iOS).

## Shared Code Resolution

The `@wifi-sync/shared` import alias is resolved at build time by esbuild:

```
@wifi-sync/shared/auth   → packages/shared/src/auth.ts
@wifi-sync/shared/types  → packages/shared/src/types.ts
@wifi-sync/shared/paths  → packages/shared/src/paths.ts
```

This avoids npm linking — the shared package is inlined into the plugin bundle.

## Build Commands

```bash
# Build the plugin
bun run build
# or directly:
~/.bun/bin/bun packages/wifi-sync/esbuild.config.mjs

# Type-check without emitting (esbuild skips type errors)
bun run typecheck
# or directly:
~/.bun/bin/bunx tsc -p packages/wifi-sync/tsconfig.json --noEmit

# Watch mode for development
bun run dev
```

Output: `packages/wifi-sync/dist/main.js`

## Install (Mac vault)

```bash
VAULT_PATH="$HOME/path/to/YourVault" ./scripts/install-receiver.sh
```

This copies `dist/main.js` + `manifest.json` into `.obsidian/plugins/wifi-sync/`.

## Install on Mobile

Manually copy these two files into the mobile vault's plugin folder:
- `packages/wifi-sync/dist/main.js`
- `packages/wifi-sync/manifest.json`

Target: `.obsidian/plugins/wifi-sync/`

Or use the QR code in Mac settings — it generates an `obsidian://wifi-sync-connect?...` URI that auto-configures the mobile sender.

## Local Two-Vault Testing

1. Install into a Mac vault, enable the plugin, generate an auth token, start server.
2. Install into a second vault on the same Mac, enable it.
3. In sender settings (second vault): set Receiver IP to `127.0.0.1`, port and auth token to match.
4. Click "Sync Now" — files should appear in the first vault.

## Architecture Notes

- **Auth**: Bearer token (random hex, stored in plugin data). Validated on every request.
- **Conflict strategies**: `overwrite`, `keep-both` (creates a `-mobile-<timestamp>` copy), `skip`.
- **Incremental sync**: tracks `lastSyncTimestamp`; only sends files modified after last sync.
- **Body size limit**: `readBody` in `routes.ts` caps payloads at 10 MB (returns 413 if exceeded).
- **Request timeout**: `httpClient.ts` wraps `requestUrl` in a 30-second `Promise.race`.
- **Hash failures**: `crypto.subtle.digest` calls are wrapped in try-catch; failed files are skipped with a console warning rather than crashing the sync.
- **QR code**: receiver settings shows an `obsidian://wifi-sync-connect?ip=...&port=...&token=...&http=...` QR that auto-configures sender.
