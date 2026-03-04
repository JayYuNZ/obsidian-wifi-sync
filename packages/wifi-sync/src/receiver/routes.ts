import { App, TFile, normalizePath } from "obsidian";
import type * as http from "http";
import { validateBearerToken } from "@wifi-sync/shared/auth";
import { sanitizePath } from "@wifi-sync/shared/paths";
import { FileSyncPayload, FileSyncResult, ReceiverStatus } from "@wifi-sync/shared/types";
import { ReceiverSettings } from "./settings";
import { StatusBarManager } from "./statusBar";
import { ConflictResolver } from "./conflictResolver";

function sendJSON(res: http.ServerResponse, status: number, data: unknown) {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(json);
}

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function createRouteHandler(
  app: App,
  settings: ReceiverSettings,
  statusBar: StatusBarManager,
  version: string,
  consumePairingToken: (token: string) => boolean
) {
  const conflictResolver = new ConflictResolver(app, settings);

  // Track syncing progress
  let sessionTotal = 0;
  let sessionCurrent = 0;

  return async function handler(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      });
      res.end();
      return;
    }

    const url = req.url ?? "/";

    // POST /pair — exchange one-time pairing token for real auth token (no auth required)
    if (req.method === "POST" && url === "/pair") {
      const body = await readBody(req);
      const { pairingToken } = JSON.parse(body);
      if (typeof pairingToken === "string" && consumePairingToken(pairingToken)) {
        sendJSON(res, 200, { token: settings.authToken });
      } else {
        sendJSON(res, 401, { error: "Invalid or expired pairing token" });
      }
      return;
    }

    // Auth check
    if (!validateBearerToken(req.headers["authorization"], settings.authToken)) {
      sendJSON(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      // GET /status — health check and auth verification
      if (req.method === "GET" && url === "/status") {
        const status: ReceiverStatus = {
          online: true,
          version,
          vaultName: app.vault.getName(),
        };
        sendJSON(res, 200, status);
        return;
      }

      // POST /sync/session/start
      if (req.method === "POST" && url === "/sync/session/start") {
        const body = await readBody(req);
        const data = JSON.parse(body);
        sessionTotal = data.totalFiles ?? 0;
        sessionCurrent = 0;
        statusBar.setSyncing(0, sessionTotal);
        sendJSON(res, 200, { ok: true });
        return;
      }

      // POST /sync/file
      if (req.method === "POST" && url === "/sync/file") {
        const body = await readBody(req);
        const payload: FileSyncPayload = JSON.parse(body);

        const safePath = sanitizePath(payload.path);
        if (!safePath) {
          sendJSON(res, 400, { error: "Invalid path" });
          return;
        }
        payload.path = safePath;

        const result = await syncFile(app, payload, settings, conflictResolver);

        sessionCurrent++;
        statusBar.setSyncing(sessionCurrent, sessionTotal);

        sendJSON(res, 200, result);
        return;
      }

      // POST /sync/session/end
      if (req.method === "POST" && url === "/sync/session/end") {
        statusBar.setListening();
        sessionTotal = 0;
        sessionCurrent = 0;
        sendJSON(res, 200, { ok: true });
        return;
      }

      sendJSON(res, 404, { error: "Not found" });
    } catch (e: any) {
      console.error("WiFi Sync Receiver route error:", e);
      const status = e?.status === 413 ? 413 : 500;
      sendJSON(res, status, { error: e?.message ?? "Internal server error" });
    }
  };
}

async function ensureParentFolders(app: App, filePath: string): Promise<void> {
  const parts = filePath.split("/");
  parts.pop(); // remove filename
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(normalizePath(current));
    if (!existing) {
      await app.vault.createFolder(normalizePath(current));
    }
  }
}

async function syncFile(
  app: App,
  payload: FileSyncPayload,
  settings: ReceiverSettings,
  conflictResolver: ConflictResolver
): Promise<FileSyncResult> {
  const targetPath = settings.syncFolder
    ? normalizePath(`${settings.syncFolder}/${payload.path}`)
    : normalizePath(payload.path);

  const existing = app.vault.getAbstractFileByPath(targetPath);

  if (existing instanceof TFile) {
    return conflictResolver.resolve(existing, payload, targetPath);
  }

  // Create new file — ensure parent folders exist first
  await ensureParentFolders(app, targetPath);

  if (payload.encoding === "base64") {
    const binary = base64ToArrayBuffer(payload.content);
    await app.vault.createBinary(targetPath, binary);
  } else {
    await app.vault.create(targetPath, payload.content);
  }

  return { path: payload.path, status: "created" };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
