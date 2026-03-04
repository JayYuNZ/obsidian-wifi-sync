import { HttpClient } from "./httpClient";
import { ReceiverStatus } from "@wifi-sync/shared/types";

const BATCH_SIZE = 20;

/**
 * Sweeps IPs .1–.254 on the given subnet prefix in batches of 20 parallel
 * requests. Returns the first IP that responds as a valid receiver, or null.
 *
 * @param subnetPrefix  e.g. "192.168.1"
 * @param port          receiver port
 * @param authToken     pre-shared token
 */
export async function discoverReceiver(
  subnetPrefix: string,
  port: number,
  authToken: string,
  httpMode = false
): Promise<string | null> {
  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) {
    ips.push(`${subnetPrefix}.${i}`);
  }

  for (let offset = 0; offset < ips.length; offset += BATCH_SIZE) {
    const batch = ips.slice(offset, offset + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (ip) => {
        const protocol = httpMode ? "http" : "https";
        const client = new HttpClient(`${protocol}://${ip}:${port}`, authToken);
        const response = await client.get("/status");
        if (response.status === 200) {
          const status = response.json as ReceiverStatus;
          if (status.online === true) return ip;
        }
        throw new Error("not a receiver");
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        return result.value;
      }
    }
  }

  return null;
}
