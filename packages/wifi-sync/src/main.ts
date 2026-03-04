import { Plugin, Platform, Notice } from "obsidian";

export default class WiFiSyncPlugin extends Plugin {
  async onload() {
    if (Platform.isDesktop) {
      const { ReceiverCore } = await import("./receiver/core");
      await new ReceiverCore(this).onload();
    } else {
      const { SenderCore } = await import("./sender/core");
      await new SenderCore(this).onload();
    }
  }
}
