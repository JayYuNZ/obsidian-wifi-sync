export class StatusBarManager {
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  setIdle() {
    this.el.setText("WiFi Sync: Idle");
  }

  setListening() {
    this.el.setText("WiFi Sync: On");
  }

  setSyncing(current: number, total: number) {
    this.el.setText(`WiFi Sync: Syncing (${current}/${total})`);
  }

  setError(msg: string) {
    this.el.setText(`WiFi Sync: Error — ${msg}`);
  }
}
