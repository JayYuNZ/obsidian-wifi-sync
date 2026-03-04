import { App } from "obsidian";
import { HttpClient } from "./httpClient";
import { FileCollector } from "./fileCollector";
import { SenderSettings } from "./settings";
import { FileSyncPayload, FileSyncResult, ReceiverStatus } from "@wifi-sync/shared/types";

export interface SyncResult {
  synced: number;
  skipped: number;
  conflicts: number;
  errors: number;
}

export class SyncEngine {
  private syncing = false;
  private client: HttpClient;

  constructor(private app: App, private settings: SenderSettings) {
    this.client = this.buildClient();
  }

  private buildClient(): HttpClient {
    const protocol = this.settings.httpMode ? "http" : "https";
    const baseUrl = `${protocol}://${this.settings.receiverIp}:${this.settings.port}`;
    return new HttpClient(baseUrl, this.settings.authToken);
  }

  updateSettings(settings: SenderSettings) {
    this.settings = settings;
    this.client = this.buildClient();
  }

  isSyncing(): boolean {
    return this.syncing;
  }

  async checkStatus(): Promise<ReceiverStatus> {
    const response = await this.client.get("/status");
    if (response.status === 401) throw new Error("Invalid auth token");
    if (response.status !== 200) throw new Error(`Receiver returned HTTP ${response.status}`);
    return response.json as ReceiverStatus;
  }

  async sync(): Promise<SyncResult> {
    if (this.syncing) throw new Error("Sync already in progress");
    this.syncing = true;

    const result: SyncResult = { synced: 0, skipped: 0, conflicts: 0, errors: 0 };

    try {
      // 1. Verify connectivity + auth
      await this.checkStatus();

      // 2. Collect files to send
      const collector = new FileCollector(
        this.app,
        this.settings.excludedPaths,
        this.settings.lastSyncTimestamp,
        this.settings.incrementalSync
      );
      const files = await collector.collect();

      if (files.length === 0) {
        return result;
      }

      // 3. Notify receiver of session start
      await this.client.post("/sync/session/start", {
        totalFiles: files.length,
        timestamp: Date.now(),
      });

      // 4. Upload each file sequentially to avoid overwhelming the receiver
      for (const file of files) {
        try {
          const payload: FileSyncPayload = {
            path: file.path,
            content: file.content,
            mtime: file.mtime,
            hash: file.hash,
            encoding: file.encoding,
          };
          const response = await this.client.post("/sync/file", payload);

          if (response.status === 200) {
            const fileResult = response.json as FileSyncResult;
            switch (fileResult.status) {
              case "created":
              case "updated":
                result.synced++;
                break;
              case "skipped":
                result.skipped++;
                break;
              case "conflict":
                result.conflicts++;
                break;
            }
          } else {
            result.errors++;
            console.warn(`WiFi Sync: HTTP ${response.status} for ${file.path}`, response.json);
          }
        } catch (e) {
          result.errors++;
          console.warn(`WiFi Sync: Exception syncing ${file.path}:`, e);
        }
      }

      // 5. End session
      await this.client.post("/sync/session/end", {});
    } finally {
      this.syncing = false;
    }

    return result;
  }
}
