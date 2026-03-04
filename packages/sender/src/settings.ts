import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import WiFiSyncSenderPlugin from "./main";
import { discoverReceiver } from "./discovery";

export interface SenderSettings {
  receiverIp: string;
  port: number;
  authToken: string;
  httpMode: boolean;
  excludedPaths: string[];
  lastSyncTimestamp: number;
  incrementalSync: boolean;
  subnetPrefix: string;
}

export const DEFAULT_SETTINGS: SenderSettings = {
  receiverIp: "",
  port: 27123,
  authToken: "",
  httpMode: false,
  excludedPaths: [".obsidian/", ".trash/"],
  lastSyncTimestamp: 0,
  incrementalSync: false,
  subnetPrefix: "",
};

export class SenderSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: WiFiSyncSenderPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "WiFi Sync Sender" });

    // Connection
    containerEl.createEl("h3", { text: "Connection" });

    new Setting(containerEl)
      .setName("Receiver IP Address")
      .setDesc("IPv4 address of your Mac. Find it in the receiver plugin settings.")
      .addText((text) =>
        text
          .setPlaceholder("192.168.1.100")
          .setValue(this.plugin.settings.receiverIp)
          .onChange(async (value) => {
            this.plugin.settings.receiverIp = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Port")
      .setDesc("Must match the receiver plugin port (default 27123)")
      .addText((text) =>
        text
          .setPlaceholder("27123")
          .setValue(String(this.plugin.settings.port))
          .onChange(async (value) => {
            const port = parseInt(value, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.port = port;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Auth Token")
      .setDesc("Paste the token from the Mac receiver plugin settings")
      .addText((text) => {
        text
          .setPlaceholder("64-char hex token")
          .setValue(this.plugin.settings.authToken)
          .onChange(async (value) => {
            this.plugin.settings.authToken = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.style.fontFamily = "monospace";
        text.inputEl.style.width = "320px";
      });

    new Setting(containerEl)
      .setName("HTTP Mode (no certificate)")
      .setDesc("Use plain HTTP instead of HTTPS. Must match the receiver's HTTP Mode setting.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.httpMode).onChange(async (value) => {
          this.plugin.settings.httpMode = value;
          await this.plugin.saveSettings();
        })
      );

    // Sync options
    containerEl.createEl("h3", { text: "Sync Options" });

    new Setting(containerEl)
      .setName("Incremental Sync")
      .setDesc("Only send files modified since the last successful sync (faster)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.incrementalSync).onChange(async (value) => {
          this.plugin.settings.incrementalSync = value;
          await this.plugin.saveSettings();
          this.display(); // refresh to show/hide timestamp
        })
      );

    if (this.plugin.settings.incrementalSync && this.plugin.settings.lastSyncTimestamp > 0) {
      const date = new Date(this.plugin.settings.lastSyncTimestamp);
      containerEl.createEl("p", {
        text: `Last sync: ${date.toLocaleString()}`,
        cls: "setting-item-description",
      });

      new Setting(containerEl)
        .setName("Reset Sync Timestamp")
        .setDesc("Force a full sync on the next run")
        .addButton((btn) =>
          btn.setButtonText("Reset").onClick(async () => {
            this.plugin.settings.lastSyncTimestamp = 0;
            await this.plugin.saveSettings();
            new Notice("Sync timestamp reset — next sync will be full");
            this.display();
          })
        );
    }

    new Setting(containerEl)
      .setName("Excluded Paths")
      .setDesc(
        "One path prefix per line. Files whose paths start with any of these are skipped."
      )
      .addTextArea((area) => {
        area
          .setPlaceholder(".obsidian/\n.trash/\nPrivate/")
          .setValue(this.plugin.settings.excludedPaths.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludedPaths = value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 4;
        area.inputEl.style.width = "100%";
      });

    // Auto-discovery
    containerEl.createEl("h3", { text: "Auto-Discovery" });
    containerEl.createEl("p", {
      text: 'Sweep your local subnet to find the Mac receiver automatically. Enter the first three octets of your network (e.g. "192.168.1").',
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Subnet Prefix")
      .addText((text) =>
        text
          .setPlaceholder("192.168.1")
          .setValue(this.plugin.settings.subnetPrefix)
          .onChange(async (value) => {
            this.plugin.settings.subnetPrefix = value.trim();
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) => {
        btn.setButtonText("Discover").onClick(async () => {
          if (!this.plugin.settings.subnetPrefix) {
            new Notice('Enter a subnet prefix first (e.g. "192.168.1")');
            return;
          }
          btn.setDisabled(true);
          btn.setButtonText("Scanning…");
          try {
            const ip = await discoverReceiver(
              this.plugin.settings.subnetPrefix,
              this.plugin.settings.port,
              this.plugin.settings.authToken
            );
            if (ip) {
              this.plugin.settings.receiverIp = ip;
              await this.plugin.saveSettings();
              new Notice(`Found receiver at ${ip}`);
              this.display();
            } else {
              new Notice("No receiver found on subnet");
            }
          } catch (e: any) {
            new Notice(`Discovery error: ${e?.message}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Discover");
          }
        });
      });

    // Actions
    containerEl.createEl("h3", { text: "Actions" });

    new Setting(containerEl)
      .setName("Test Connection")
      .setDesc("Verify the receiver is reachable with current settings")
      .addButton((btn) =>
        btn.setButtonText("Test").onClick(() => this.plugin.checkConnection())
      );

    new Setting(containerEl)
      .setName("Sync Now")
      .addButton((btn) =>
        btn
          .setButtonText("Sync Now")
          .setCta()
          .onClick(() => this.plugin.triggerSync())
      );
  }
}
