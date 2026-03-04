import { App, Plugin, PluginSettingTab, Setting, Notice } from "obsidian";
import type { ReceiverCore } from "./core";
import QRCode from "qrcode";

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
  httpMode: true,
  certPem: "",
  keyPem: "",
  certFingerprint: "",
};

export class ReceiverSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private core: ReceiverCore) {
    super(app, plugin);
  }

  display(): void {
    // Inline requires so Node built-ins only load on desktop
    const crypto = require("crypto") as typeof import("crypto");
    const os = require("os") as typeof import("os");

    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "WiFi Sync" });

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

    // QR code for mobile setup
    if (this.core.server?.isRunning() && this.core.settings.authToken) {
      containerEl.createEl("h3", { text: "Connect Mobile" });
      containerEl.createEl("p", {
        text: "Scan this QR code with your phone's camera app, then tap the link to auto-configure the sender plugin.",
        cls: "setting-item-description",
      });

      const canvas = containerEl.createEl("canvas");
      canvas.style.display = "block";
      canvas.style.margin = "8px 0";

      const primaryIp = ips[0] ?? "127.0.0.1";
      // Generate a fresh one-time pairing token for each QR render
      const pairingToken = crypto.randomBytes(16).toString("hex");
      this.core.pairingToken = pairingToken;
      const params = new URLSearchParams({
        ip: primaryIp,
        port: String(this.core.settings.port),
        pairing_token: pairingToken,
        http: this.core.settings.httpMode ? "1" : "0",
      });
      const uri = `obsidian://wifi-sync-connect?${params.toString()}`;

      QRCode.toCanvas(canvas, uri, { width: 200, margin: 2 });
    }

    // Port
    new Setting(containerEl)
      .setName("Port")
      .setDesc("Port to listen on (default 27123). Firewall must allow inbound TCP.")
      .addText((text) =>
        text
          .setPlaceholder("27123")
          .setValue(String(this.core.settings.port))
          .onChange(async (value) => {
            const port = parseInt(value, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.core.settings.port = port;
              await this.core.saveSettings();
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
          .setValue(this.core.settings.authToken)
          .onChange(async (value) => {
            this.core.settings.authToken = value;
            await this.core.saveSettings();
          });
        text.inputEl.style.fontFamily = "monospace";
        text.inputEl.style.width = "320px";
      })
      .addButton((btn) =>
        btn.setButtonText("Generate").onClick(async () => {
          this.core.settings.authToken = crypto.randomBytes(32).toString("hex");
          await this.core.saveSettings();
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
          .setValue(this.core.settings.syncFolder)
          .onChange(async (value) => {
            this.core.settings.syncFolder = value.trim();
            await this.core.saveSettings();
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
          .setValue(this.core.settings.conflictStrategy)
          .onChange(async (value) => {
            this.core.settings.conflictStrategy = value as ConflictStrategy;
            await this.core.saveSettings();
          })
      );

    // Auto-start
    new Setting(containerEl)
      .setName("Auto-start Server")
      .setDesc("Start listening automatically when Obsidian opens")
      .addToggle((toggle) =>
        toggle.setValue(this.core.settings.autoStart).onChange(async (value) => {
          this.core.settings.autoStart = value;
          await this.core.saveSettings();
        })
      );

    // Server controls
    containerEl.createEl("h3", { text: "Server Controls" });

    new Setting(containerEl)
      .setName(this.core.server?.isRunning() ? "Server is running" : "Server is stopped")
      .addButton((btn) =>
        btn.setButtonText("Start").onClick(() => this.core.startServer())
      )
      .addButton((btn) =>
        btn
          .setButtonText("Stop")
          .setCta()
          .onClick(() => this.core.stopServer())
      );

    // HTTP mode
    new Setting(containerEl)
      .setName("HTTP Mode (no certificate)")
      .setDesc("Use plain HTTP instead of HTTPS. Easier for local testing and Android. Not recommended for iOS.")
      .addToggle((toggle) =>
        toggle.setValue(this.core.settings.httpMode).onChange(async (value) => {
          this.core.settings.httpMode = value;
          await this.core.saveSettings();
          if (this.core.server?.isRunning()) {
            await this.core.startServer();
          }
          this.display();
        })
      );

    if (this.core.settings.httpMode) {
      const warn = containerEl.createEl("p", {
        text: "⚠ HTTP mode: data is unencrypted. Only use on a trusted home network.",
        cls: "setting-item-description",
      });
      warn.style.color = "var(--color-red)";
    }

    // TLS / Certificate
    containerEl.createEl("h3", { text: "TLS Certificate (iOS Setup)" });
    containerEl.createEl("p", {
      text:
        "iOS 17+ requires HTTPS. Install the self-signed certificate on your iPhone once: " +
        "copy the PEM below → save as a .pem file → AirDrop to iPhone → install via Settings → General → VPN & Device Management → trust it.",
      cls: "setting-item-description",
    });

    const fingerprint =
      this.core.server?.getCertFingerprint() || this.core.settings.certFingerprint;

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
              this.core.server?.getCertPem() || this.core.settings.certPem;
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
          this.core.settings.certPem = "";
          this.core.settings.keyPem = "";
          this.core.settings.certFingerprint = "";
          await this.core.saveSettings();
          await this.core.startServer();
          this.display();
          new Notice("Certificate regenerated — re-trust on iOS required");
        })
      );
  }
}
