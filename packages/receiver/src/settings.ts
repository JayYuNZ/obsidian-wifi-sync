import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import WiFiSyncReceiverPlugin from "./main";
import * as crypto from "crypto";
import * as os from "os";

export type ConflictStrategy = "skip" | "overwrite" | "keep-both";

export interface ReceiverSettings {
  port: number;
  authToken: string;
  conflictStrategy: ConflictStrategy;
  syncFolder: string;
  autoStart: boolean;
  httpMode: boolean;
  certPem: string;
  keyPem: string;
  certFingerprint: string;
}

export const DEFAULT_SETTINGS: ReceiverSettings = {
  port: 27123,
  authToken: "",
  conflictStrategy: "skip",
  syncFolder: "",
  autoStart: true,
  httpMode: false,
  certPem: "",
  keyPem: "",
  certFingerprint: "",
};

export class ReceiverSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: WiFiSyncReceiverPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "WiFi Sync Receiver" });

    // Show local IPs so user can copy to mobile settings
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal) {
          ips.push(addr.address);
        }
      }
    }
    if (ips.length > 0) {
      const ipEl = containerEl.createEl("p", {
        text: `Mac IP address(es): ${ips.join(", ")}`,
      });
      ipEl.style.fontWeight = "bold";
      ipEl.style.color = "var(--color-accent)";
      ipEl.style.marginBottom = "1em";
    }

    // Port
    new Setting(containerEl)
      .setName("Port")
      .setDesc("Port to listen on (default 27123). Firewall must allow inbound TCP.")
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

    // Auth token
    new Setting(containerEl)
      .setName("Auth Token")
      .setDesc("Pre-shared secret. Copy this value into the mobile sender settings.")
      .addText((text) => {
        text
          .setPlaceholder("Click Generate →")
          .setValue(this.plugin.settings.authToken)
          .onChange(async (value) => {
            this.plugin.settings.authToken = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.style.fontFamily = "monospace";
        text.inputEl.style.width = "320px";
      })
      .addButton((btn) =>
        btn.setButtonText("Generate").onClick(async () => {
          this.plugin.settings.authToken = crypto.randomBytes(32).toString("hex");
          await this.plugin.saveSettings();
          this.display();
        })
      );

    // Sync folder
    new Setting(containerEl)
      .setName("Sync Folder")
      .setDesc(
        "Optional subfolder in the Mac vault where synced files land. Leave blank for vault root."
      )
      .addText((text) =>
        text
          .setPlaceholder("Mobile")
          .setValue(this.plugin.settings.syncFolder)
          .onChange(async (value) => {
            this.plugin.settings.syncFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Conflict strategy
    new Setting(containerEl)
      .setName("Conflict Strategy")
      .setDesc("What to do when a synced file already exists on Mac")
      .addDropdown((drop) =>
        drop
          .addOption("skip", "Skip — keep Mac version")
          .addOption("overwrite", "Overwrite — mobile wins")
          .addOption("keep-both", "Keep Both — save mobile copy with timestamp suffix")
          .setValue(this.plugin.settings.conflictStrategy)
          .onChange(async (value) => {
            this.plugin.settings.conflictStrategy = value as ConflictStrategy;
            await this.plugin.saveSettings();
          })
      );

    // Auto-start
    new Setting(containerEl)
      .setName("Auto-start Server")
      .setDesc("Start listening automatically when Obsidian opens")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoStart).onChange(async (value) => {
          this.plugin.settings.autoStart = value;
          await this.plugin.saveSettings();
        })
      );

    // Server controls
    containerEl.createEl("h3", { text: "Server Controls" });

    new Setting(containerEl)
      .setName(this.plugin.server?.isRunning() ? "Server is running" : "Server is stopped")
      .addButton((btn) =>
        btn.setButtonText("Start").onClick(() => this.plugin.startServer())
      )
      .addButton((btn) =>
        btn
          .setButtonText("Stop")
          .setCta()
          .onClick(() => this.plugin.stopServer())
      );

    // HTTP mode
    new Setting(containerEl)
      .setName("HTTP Mode (no certificate)")
      .setDesc("Use plain HTTP instead of HTTPS. Easier for local testing and Android. Not recommended for iOS.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.httpMode).onChange(async (value) => {
          this.plugin.settings.httpMode = value;
          await this.plugin.saveSettings();
          if (this.plugin.server?.isRunning()) {
            await this.plugin.startServer();
          }
          this.display();
        })
      );

    // TLS / Certificate
    containerEl.createEl("h3", { text: "TLS Certificate (iOS Setup)" });
    containerEl.createEl("p", {
      text:
        "iOS 17+ requires HTTPS. Install the self-signed certificate on your iPhone once: " +
        "copy the PEM below → save as a .pem file → AirDrop to iPhone → install via Settings → General → VPN & Device Management → trust it.",
      cls: "setting-item-description",
    });

    const fingerprint =
      this.plugin.server?.getCertFingerprint() || this.plugin.settings.certFingerprint;

    if (fingerprint) {
      new Setting(containerEl)
        .setName("Certificate Fingerprint (SHA-256)")
        .setDesc("Use this to verify the correct cert is trusted on iOS")
        .addText((text) => {
          text.setValue(fingerprint).setDisabled(true);
          text.inputEl.style.fontFamily = "monospace";
          text.inputEl.style.fontSize = "11px";
          text.inputEl.style.width = "480px";
        });

      new Setting(containerEl)
        .setName("Certificate PEM")
        .setDesc("Copy and transfer to iOS for trust installation")
        .addButton((btn) =>
          btn.setButtonText("Copy PEM to Clipboard").onClick(async () => {
            const pem =
              this.plugin.server?.getCertPem() || this.plugin.settings.certPem;
            await navigator.clipboard.writeText(pem);
            new Notice("Certificate PEM copied to clipboard");
          })
        );
    } else {
      containerEl.createEl("p", {
        text: "No certificate yet — start the server to generate one.",
        cls: "setting-item-description",
      });
    }

    new Setting(containerEl)
      .setName("Regenerate Certificate")
      .setDesc(
        "Generates a new self-signed certificate. You will need to re-trust it on iOS."
      )
      .addButton((btn) =>
        btn.setButtonText("Regenerate").onClick(async () => {
          this.plugin.settings.certPem = "";
          this.plugin.settings.keyPem = "";
          this.plugin.settings.certFingerprint = "";
          await this.plugin.saveSettings();
          await this.plugin.startServer();
          this.display();
          new Notice("Certificate regenerated — re-trust on iOS required");
        })
      );
  }
}
