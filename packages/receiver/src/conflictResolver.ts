import { App, TFile, normalizePath } from "obsidian";
import { FileSyncPayload, FileSyncResult } from "@wifi-sync/shared/types";
import { ReceiverSettings } from "./settings";

export class ConflictResolver {
  constructor(private app: App, private settings: ReceiverSettings) {}

  async resolve(
    existing: TFile,
    payload: FileSyncPayload,
    targetPath: string
  ): Promise<FileSyncResult> {
    // Compare hashes — skip if content is unchanged
    const existingHash = await this.hashExistingFile(existing, payload.encoding);
    if (existingHash === payload.hash) {
      return { path: payload.path, status: "skipped" };
    }

    switch (this.settings.conflictStrategy) {
      case "overwrite":
        await this.writeFile(existing, payload);
        return { path: payload.path, status: "updated" };

      case "keep-both": {
        const conflictPath = this.makeConflictPath(targetPath);
        await this.createFile(conflictPath, payload);
        return { path: payload.path, status: "conflict", conflictPath };
      }

      case "skip":
      default:
        return { path: payload.path, status: "skipped" };
    }
  }

  private async hashExistingFile(
    file: TFile,
    encoding: "utf8" | "base64"
  ): Promise<string> {
    let content: string;
    if (encoding === "base64") {
      const binary = await this.app.vault.readBinary(file);
      content = arrayBufferToBase64(binary);
    } else {
      content = await this.app.vault.read(file);
    }
    return computeHash(content);
  }

  private async writeFile(existing: TFile, payload: FileSyncPayload): Promise<void> {
    if (payload.encoding === "base64") {
      const binary = base64ToArrayBuffer(payload.content);
      await this.app.vault.modifyBinary(existing, binary);
    } else {
      await this.app.vault.modify(existing, payload.content);
    }
  }

  private async createFile(path: string, payload: FileSyncPayload): Promise<void> {
    if (payload.encoding === "base64") {
      const binary = base64ToArrayBuffer(payload.content);
      await this.app.vault.createBinary(normalizePath(path), binary);
    } else {
      await this.app.vault.create(normalizePath(path), payload.content);
    }
  }

  private makeConflictPath(targetPath: string): string {
    const dotIdx = targetPath.lastIndexOf(".");
    if (dotIdx === -1) {
      return `${targetPath}-mobile-${Date.now()}`;
    }
    const base = targetPath.slice(0, dotIdx);
    const ext = targetPath.slice(dotIdx + 1);
    return `${base}-mobile-${Date.now()}.${ext}`;
  }
}

async function computeHash(content: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    console.warn("WiFi Sync Receiver: failed to compute hash, treating file as changed:", e);
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

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
