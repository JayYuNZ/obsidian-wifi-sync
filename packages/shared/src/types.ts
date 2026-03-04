// Mobile → Mac per file
export interface FileSyncPayload {
  path: string;      // vault-relative, e.g. "Journal/2024-01-15.md"
  content: string;   // UTF-8 text or base64 for binary
  mtime: number;     // ms since epoch
  hash: string;      // SHA-256 of content
  encoding: "utf8" | "base64";
}

// Mac response per file
export interface FileSyncResult {
  path: string;
  status: "created" | "updated" | "skipped" | "conflict";
  conflictPath?: string;
}

// GET /status response
export interface ReceiverStatus {
  online: true;
  version: string;
  vaultName: string;
}

export interface SyncSessionStart {
  sessionId?: string;
  totalFiles: number;
  timestamp: number;
}
