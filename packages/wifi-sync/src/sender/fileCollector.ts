import { App, TFile } from "obsidian";

export interface CollectedFile {
  path: string;
  content: string;
  mtime: number;
  hash: string;
  encoding: "utf8" | "base64";
}

// Extensions treated as UTF-8 text; everything else is sent as base64
const TEXT_EXTENSIONS = new Set([
  "md", "txt", "json", "yaml", "yml", "csv",
  "html", "htm", "css", "js", "ts", "xml",
  "toml", "ini", "conf", "sh", "py", "rb",
  "go", "rs", "c", "cpp", "h", "java",
]);

export class FileCollector {
  constructor(
    private app: App,
    private excludedPaths: string[],
    private lastSyncTimestamp: number,
    private incrementalSync: boolean
  ) {}

  async collect(): Promise<CollectedFile[]> {
    const files = this.app.vault.getFiles();
    const results: CollectedFile[] = [];

    for (const file of files) {
      if (this.isExcluded(file.path)) continue;
      if (this.incrementalSync && file.stat.mtime <= this.lastSyncTimestamp) continue;

      try {
        results.push(await this.collectFile(file));
      } catch (e) {
        console.warn(`WiFi Sync Sender: skipping ${file.path}:`, e);
      }
    }

    return results;
  }

  private isExcluded(filePath: string): boolean {
    return this.excludedPaths.some((pattern) => {
      const p = pattern.trim();
      if (!p) return false;
      // Treat patterns ending with "/" as prefix matches (folder exclusions)
      return filePath.startsWith(p) || filePath === p;
    });
  }

  private async collectFile(file: TFile): Promise<CollectedFile> {
    const isText = TEXT_EXTENSIONS.has(file.extension.toLowerCase());

    if (isText) {
      const content = await this.app.vault.read(file);
      const hash = await computeHash(content);
      return { path: file.path, content, mtime: file.stat.mtime, hash, encoding: "utf8" };
    } else {
      const buffer = await this.app.vault.readBinary(file);
      const content = arrayBufferToBase64(buffer);
      const hash = await computeHash(content);
      return { path: file.path, content, mtime: file.stat.mtime, hash, encoding: "base64" };
    }
  }
}

async function computeHash(content: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    console.warn("WiFi Sync Sender: failed to compute hash, using fallback:", e);
    return "";
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
