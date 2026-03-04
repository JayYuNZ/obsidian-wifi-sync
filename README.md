# WiFi Sync for Obsidian

Sync your Obsidian vault from iPhone/iPad/Android to Mac over your local WiFi network — no cloud, no subscription, no data leaving your network.

One plugin runs on both platforms: it auto-detects whether it's running on desktop (Mac receiver) or mobile (iOS/Android sender) and activates the appropriate mode.

---

## Install

Install **WiFi Sync** from the Obsidian community plugin browser on both your Mac and your mobile device.

> Settings → Community Plugins → Browse → search "WiFi Sync"

---

## Setup

### Step 1 — Mac (receiver)

1. Enable the plugin in Obsidian on your Mac
2. Open plugin settings → click **Generate** next to Auth Token
3. Click **Start** to start the server
4. A QR code will appear in the settings panel

### Step 2 — Mobile (sender)

1. Enable the plugin in Obsidian on your iPhone/iPad/Android
2. Open the camera app and scan the QR code from Step 1
3. Tap the link that appears — the plugin auto-configures itself
4. Tap **Sync Now** in settings (or use the ribbon button)

That's it. Files from your mobile vault are pushed to the Mac vault.

---

## iOS Certificate Setup

The receiver uses HTTPS with a self-signed certificate (required for iOS 17+). You need to trust this certificate on your iPhone once:

1. In Mac plugin settings, click **Copy PEM to Clipboard**
2. Paste into a text file, save it as `wifi-sync.pem`
3. AirDrop the `.pem` file to your iPhone
4. On iPhone: tap the file → Settings → General → VPN & Device Management → install it
5. Go to Settings → General → About → Certificate Trust Settings → enable the certificate

After this, syncs will work without interruption.

> **Android:** Enable **HTTP Mode** in both Mac and mobile settings — Android handles plain HTTP fine and doesn't require certificate installation.

---

## Troubleshooting

**"Unauthorized" error**
Token in sender doesn't match receiver — regenerate and re-scan the QR code.

**Sync hangs / times out**
- Check both devices are on the same WiFi network
- Verify the server is running (Mac status bar shows the port)
- Mac firewall may be blocking the port: System Settings → Network → Firewall → allow Obsidian

**413 error**
A file exceeds the 10 MB limit. Add it to Excluded Paths in mobile settings.

**Certificate error on iOS**
Follow the iOS Certificate Setup steps above.

**Files land in wrong location**
Check the **Sync Folder** setting on Mac — files go into that subfolder if set.

---

## Settings Reference

### Mac (receiver)
| Setting | Description |
|---------|-------------|
| Port | TCP port (default 27123) |
| Auth Token | Bearer secret — click Generate |
| Auto-start | Start server when Obsidian opens |
| Sync Folder | Subfolder for received files (blank = vault root) |
| Conflict Strategy | `skip`, `overwrite`, or `keep-both` |
| HTTP Mode | Plain HTTP instead of HTTPS (Android-friendly) |

### Mobile (sender)
| Setting | Description |
|---------|-------------|
| Receiver IP | Auto-filled by QR scan, or enter manually |
| Port | Must match receiver (default 27123) |
| Auth Token | Auto-filled by QR scan, or paste from receiver |
| Incremental Sync | Only send files changed since last sync |
| Excluded Paths | Prefixes to skip (one per line) |
| HTTP Mode | Must match receiver's HTTP Mode |
| Subnet Prefix | For auto-discovery without QR (e.g. `192.168.1`) |

---

## Local Two-Vault Testing

To test without a phone:

1. Install the plugin into one vault on Mac, start server, generate token
2. Install into a second vault on the same Mac
3. In second vault's plugin settings: set Receiver IP to `127.0.0.1`, port and token to match
4. Click **Sync Now** — files should appear in the first vault

---

## License

MIT
