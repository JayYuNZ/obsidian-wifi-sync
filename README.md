# WiFi Sync for Obsidian

Sync your Obsidian vault from iPhone/iPad to Mac over your local WiFi network — no cloud required.

Two plugins work together:
- **Receiver** — runs on your Mac, starts an HTTP server inside Obsidian
- **Sender** — runs on your iPhone/iPad, pushes files to the receiver on demand

---

## Prerequisites

- [Bun](https://bun.sh) (JavaScript runtime for building): `curl -fsSL https://bun.sh/install | bash`
- Obsidian installed on both Mac and iOS
- Both devices on the same WiFi network

---

## Build

```bash
git clone <this repo>
cd obsidian-wifi-sync

bun install
bun run build
```

Output:
- `packages/receiver/dist/main.js`
- `packages/sender/dist/main.js`

To type-check without building:
```bash
bun run typecheck
```

---

## Install Receiver (Mac)

```bash
VAULT_PATH="$HOME/Documents/MyVault" ./scripts/install-receiver.sh
```

This copies the plugin into `.obsidian/plugins/wifi-sync-receiver/` inside your vault.

Then in Obsidian on Mac:
1. Settings → Community Plugins → enable "WiFi Sync Receiver"
2. Open plugin settings → click **Generate Token** → copy the token
3. Note the **port** (default: 8080)

---

## Install Sender (iPhone/iPad)

1. On your Mac, locate:
   - `packages/sender/dist/main.js`
   - `packages/sender/manifest.json`
2. In the iOS vault's `.obsidian/plugins/` folder, create a subfolder named `wifi-sync-sender`
3. Copy both files into that folder (use the Files app, Working Copy, or AirDrop)
4. In Obsidian on iOS: Settings → Community Plugins → enable "WiFi Sync Sender"
5. Open plugin settings:
   - **Receiver IP**: your Mac's local IP address (find it in Mac System Settings → WiFi → Details)
   - **Port**: match the receiver's port
   - **Auth Token**: paste the token you copied from the receiver

---

## iOS Certificate Setup

The receiver uses HTTPS with a self-signed certificate. On first sync, iOS will reject it unless you trust it:

1. In the sender settings, tap **Download Certificate**
2. iOS will prompt you to install a profile — tap **Allow**
3. Go to iOS Settings → General → VPN & Device Management → install the profile
4. Go to iOS Settings → General → About → Certificate Trust Settings → enable the certificate

After this, syncs will work without certificate warnings.

---

## Local Testing (Two Vaults on Mac)

To test without a phone:

1. Install the receiver into one vault, start the server, note the port and token
2. Install the sender into a second vault on the same Mac
3. In sender settings: set Receiver IP to `127.0.0.1`, port and token to match
4. Click **Sync Now** — files should appear in the receiver vault

---

## Settings Reference

### Receiver
| Setting | Description |
|---------|-------------|
| Port | TCP port for the HTTP server (default: 8080) |
| Auth Token | Bearer token — click Generate to create one |
| Auto Start | Start the server when Obsidian loads |
| Sync Folder | If set, received files go into this subfolder |
| Conflict Strategy | `overwrite`, `keep-both`, or `skip` |

### Sender
| Setting | Description |
|---------|-------------|
| Receiver IP | Local IP of your Mac |
| Port | Must match receiver port |
| Auth Token | Must match receiver token |
| Incremental Sync | Only send files changed since last sync |
| Excluded Paths | Folders/files to skip (one per line) |

---

## Troubleshooting

**"Unauthorized" error**
- Token in sender doesn't match token in receiver — regenerate and re-paste.

**Sync hangs / times out**
- Check both devices are on the same WiFi network.
- Check the receiver is running (status bar should show the port).
- Check Mac firewall isn't blocking the port: System Settings → Network → Firewall → allow Obsidian.

**413 error during sync**
- A file exceeds the 10 MB payload limit. Exclude large binary files using the Excluded Paths setting.

**Certificate error on iOS**
- Follow the iOS Certificate Setup steps above.

**Files not appearing after sync**
- Check the Sync Folder setting in the receiver — files may have landed in a subfolder.
