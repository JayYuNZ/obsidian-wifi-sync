import { App } from "obsidian";
import * as https from "https";
import * as http from "http";
import { ReceiverSettings } from "./settings";
import { StatusBarManager } from "./statusBar";
import { createRouteHandler } from "./routes";

// node-forge is bundled by esbuild (listed in dependencies, not external)
import forge from "node-forge";

export interface CertData {
  cert: string;
  key: string;
  fingerprint: string;
}

export class ReceiverServer {
  private server: https.Server | null = null;
  private certData: CertData | null = null;

  constructor(
    private app: App,
    private settings: ReceiverSettings,
    private statusBar: StatusBarManager,
    private version: string
  ) {}

  updateSettings(settings: ReceiverSettings) {
    this.settings = settings;
  }

  getCertFingerprint(): string {
    return this.certData?.fingerprint ?? "";
  }

  getCertPem(): string {
    return this.certData?.cert ?? "";
  }

  /**
   * Generates a new self-signed certificate using node-forge.
   * Required for iOS 17+ App Transport Security compatibility.
   */
  async generateCert(): Promise<CertData> {
    return new Promise((resolve, reject) => {
      try {
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();

        cert.publicKey = keys.publicKey;
        cert.serialNumber = "01";
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

        const attrs = [
          { name: "commonName", value: "WiFi Sync Receiver" },
          { name: "organizationName", value: "Obsidian WiFi Sync" },
        ];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([
          { name: "basicConstraints", cA: true },
          {
            name: "keyUsage",
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true,
          },
          {
            name: "subjectAltName",
            altNames: [
              { type: 7, ip: "0.0.0.0" },
              { type: 7, ip: "127.0.0.1" },
            ],
          },
        ]);

        cert.sign(keys.privateKey, forge.md.sha256.create());

        const certPem = forge.pki.certificateToPem(cert);
        const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

        // Compute SHA-256 fingerprint
        const md = forge.md.sha256.create();
        md.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
        const fingerprint = md
          .digest()
          .toHex()
          .match(/../g)!
          .join(":")
          .toUpperCase();

        resolve({ cert: certPem, key: keyPem, fingerprint });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Starts the HTTPS server. Returns new CertData if a cert was generated,
   * null if an existing cert from settings was used.
   */
  async start(): Promise<CertData | null> {
    if (this.server) {
      await this.stop();
    }

    let newCert: CertData | null = null;

    const routeHandler = createRouteHandler(
      this.app,
      this.settings,
      this.statusBar,
      this.version
    );

    if (this.settings.httpMode) {
      this.server = http.createServer(routeHandler);
    } else {
      if (this.settings.certPem && this.settings.keyPem) {
        this.certData = {
          cert: this.settings.certPem,
          key: this.settings.keyPem,
          fingerprint: this.settings.certFingerprint ?? "Unknown",
        };
      } else {
        this.certData = await this.generateCert();
        newCert = this.certData;
      }
      this.server = https.createServer(
        { cert: this.certData!.cert, key: this.certData!.key },
        routeHandler
      );
    }

    return new Promise<CertData | null>((resolve, reject) => {
      this.server!.listen(this.settings.port, "0.0.0.0", () => {
        resolve(newCert);
      });
      this.server!.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
