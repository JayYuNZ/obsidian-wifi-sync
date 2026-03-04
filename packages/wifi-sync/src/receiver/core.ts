import { Plugin, Notice } from "obsidian";
import { ReceiverServer } from "./server";
import { ReceiverSettingTab, ReceiverSettings, DEFAULT_SETTINGS } from "./settings";
import { StatusBarManager } from "./statusBar";

export class ReceiverCore {
  settings!: ReceiverSettings;
  server!: ReceiverServer;
  statusBar!: StatusBarManager;
  pairingToken: string | null = null;

  constructor(private plugin: Plugin) {}

  consumePairingToken(token: string): boolean {
    if (this.pairingToken && this.pairingToken === token) {
      this.pairingToken = null;
      return true;
    }
    return false;
  }

  async onload() {
    await this.loadSettings();

    this.statusBar = new StatusBarManager(this.plugin.addStatusBarItem());
    this.statusBar.setIdle();

    this.server = new ReceiverServer(
      this.plugin.app,
      this.settings,
      this.statusBar,
      this.plugin.manifest.version,
      (token) => this.consumePairingToken(token)
    );

    this.plugin.addCommand({
      id: "start-server",
      name: "Start WiFi Sync Server",
      callback: () => this.startServer(),
    });

    this.plugin.addCommand({
      id: "stop-server",
      name: "Stop WiFi Sync Server",
      callback: () => this.stopServer(),
    });

    this.plugin.addSettingTab(new ReceiverSettingTab(this.plugin.app, this.plugin, this));

    if (this.settings.autoStart) {
      this.plugin.app.workspace.onLayoutReady(() => this.startServer());
    }

    // Clean up server on plugin unload
    this.plugin.register(() => this.server?.stop());
  }

  async startServer() {
    try {
      const newCert = await this.server.start();

      // Persist newly generated cert so it survives restarts
      if (newCert) {
        this.settings.certPem = newCert.cert;
        this.settings.keyPem = newCert.key;
        this.settings.certFingerprint = newCert.fingerprint;
        await this.saveSettings();
      }

      this.statusBar.setListening();
    } catch (e: any) {
      this.statusBar.setError(e?.message ?? "unknown error");
      new Notice(`WiFi Sync: Failed to start — ${e?.message}`);
      console.error("WiFi Sync Receiver: start error", e);
    }
  }

  async stopServer() {
    await this.server.stop();
    this.statusBar.setIdle();
    new Notice("WiFi Sync: Server stopped");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
  }

  async saveSettings() {
    await this.plugin.saveData(this.settings);
    this.server?.updateSettings(this.settings);
  }
}
