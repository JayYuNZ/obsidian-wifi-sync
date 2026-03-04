import { Plugin, Notice } from "obsidian";
import { ReceiverServer } from "./server";
import { ReceiverSettingTab, ReceiverSettings, DEFAULT_SETTINGS } from "./settings";
import { StatusBarManager } from "./statusBar";

export default class WiFiSyncReceiverPlugin extends Plugin {
  settings!: ReceiverSettings;
  server!: ReceiverServer;
  statusBar!: StatusBarManager;

  async onload() {
    await this.loadSettings();

    this.statusBar = new StatusBarManager(this.addStatusBarItem());
    this.statusBar.setIdle();

    this.server = new ReceiverServer(
      this.app,
      this.settings,
      this.statusBar,
      this.manifest.version
    );

    this.addCommand({
      id: "start-server",
      name: "Start WiFi Sync Server",
      callback: () => this.startServer(),
    });

    this.addCommand({
      id: "stop-server",
      name: "Stop WiFi Sync Server",
      callback: () => this.stopServer(),
    });

    this.addSettingTab(new ReceiverSettingTab(this.app, this));

    if (this.settings.autoStart) {
      // Defer slightly so vault is fully loaded
      this.app.workspace.onLayoutReady(() => this.startServer());
    }
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

      this.statusBar.setListening(this.settings.port);
      new Notice(`WiFi Sync: Listening on port ${this.settings.port}`);
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

  async onunload() {
    await this.server.stop();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.server?.updateSettings(this.settings);
  }
}
