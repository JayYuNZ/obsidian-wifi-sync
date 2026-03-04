import { Plugin, Notice, addIcon, requestUrl } from "obsidian";
import { SyncEngine } from "./syncEngine";
import { SenderSettingTab, SenderSettings, DEFAULT_SETTINGS } from "./settings";

// Simple WiFi/sync SVG icon
const WIFI_SYNC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>`;

export class SenderCore {
  settings!: SenderSettings;
  syncEngine!: SyncEngine;

  constructor(private plugin: Plugin) {}

  async onload() {
    await this.loadSettings();

    addIcon("wifi-sync", WIFI_SYNC_ICON);

    this.syncEngine = new SyncEngine(this.plugin.app, this.settings);

    // Ribbon button
    this.plugin.addRibbonIcon("wifi-sync", "WiFi Sync: Send Notes to Mac", () => {
      this.triggerSync();
    });

    // Command palette
    this.plugin.addCommand({
      id: "wifi-sync-now",
      name: "Sync Now",
      callback: () => this.triggerSync(),
    });

    this.plugin.addCommand({
      id: "wifi-sync-check-connection",
      name: "Check Receiver Connection",
      callback: () => this.checkConnection(),
    });

    this.plugin.addSettingTab(new SenderSettingTab(this.plugin.app, this.plugin, this));

    this.plugin.registerObsidianProtocolHandler("wifi-sync-connect", async (params) => {
      const { ip, port, pairing_token, http } = params;
      if (!ip || !port || !pairing_token) {
        new Notice("WiFi Sync: Invalid QR code — missing connection data");
        return;
      }
      try {
        const protocol = http === "1" ? "http" : "https";
        const response = await requestUrl({
          url: `${protocol}://${ip}:${port}/pair`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pairingToken: pairing_token }),
          throw: false,
        });
        if (response.status !== 200) {
          new Notice("WiFi Sync: QR code has expired or already been used");
          return;
        }
        const { token } = response.json as { token: string };
        this.settings.receiverIp = ip;
        this.settings.port = parseInt(port, 10);
        this.settings.authToken = token;
        this.settings.httpMode = http === "1";
        await this.saveSettings();
        new Notice(`WiFi Sync: Connected to ${ip}:${port}`);
      } catch (e: any) {
        new Notice(`WiFi Sync: Failed to connect — ${e?.message}`);
      }
    });
  }

  async triggerSync() {
    if (this.syncEngine.isSyncing()) {
      new Notice("WiFi Sync: Already syncing…");
      return;
    }
    if (!this.settings.receiverIp || !this.settings.authToken) {
      new Notice("WiFi Sync: Configure receiver IP and auth token in settings first.");
      return;
    }

    new Notice("WiFi Sync: Starting sync…");
    try {
      const result = await this.syncEngine.sync();
      const parts: string[] = [];
      if (result.synced > 0) parts.push(`${result.synced} synced`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      if (result.conflicts > 0) parts.push(`${result.conflicts} conflicts`);
      if (result.errors > 0) parts.push(`${result.errors} errors`);
      const summary = parts.length > 0 ? parts.join(", ") : "nothing to sync";
      new Notice(`WiFi Sync: Done — ${summary}`);

      // Persist last sync time for incremental sync
      this.settings.lastSyncTimestamp = Date.now();
      await this.saveSettings();
    } catch (e: any) {
      new Notice(`WiFi Sync: Error — ${e?.message ?? "unknown error"}`);
      console.error("WiFi Sync Sender error:", e);
    }
  }

  async checkConnection() {
    if (!this.settings.receiverIp || !this.settings.authToken) {
      new Notice("WiFi Sync: Configure receiver IP and auth token first.");
      return;
    }
    try {
      const status = await this.syncEngine.checkStatus();
      new Notice(
        `WiFi Sync: Connected ✓\nVault: "${status.vaultName}" (receiver v${status.version})`
      );
    } catch (e: any) {
      new Notice(`WiFi Sync: Cannot connect — ${e?.message}`);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
  }

  async saveSettings() {
    await this.plugin.saveData(this.settings);
    this.syncEngine?.updateSettings(this.settings);
  }
}
