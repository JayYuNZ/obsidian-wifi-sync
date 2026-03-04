import { Plugin, Notice } from "obsidian";
import { SenderCore } from "./sender/core";

export default class WiFiSyncPlugin extends Plugin {
  async onload() {
    try {
      await new SenderCore(this).onload();
    } catch (e: any) {
      new Notice(`WiFi Sync failed to load: ${e?.message ?? e}`, 0);
      console.error("WiFi Sync load error:", e);
    }
  }
}
