import { requestUrl, RequestUrlParam } from "obsidian";

export interface HttpResponse {
  status: number;
  json: unknown;
}

const REQUEST_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 30s")), REQUEST_TIMEOUT_MS)
    ),
  ]);
}

/**
 * Thin wrapper around Obsidian's requestUrl API.
 * Uses requestUrl (not fetch/XMLHttpRequest/Node http) so it works on mobile.
 */
export class HttpClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authToken = authToken;
  }

  async get(path: string): Promise<HttpResponse> {
    const params: RequestUrlParam = {
      url: `${this.baseUrl}${path}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
      throw: false,
    };
    const response = await withTimeout(requestUrl(params));
    return { status: response.status, json: response.json };
  }

  async post(path: string, body: unknown): Promise<HttpResponse> {
    const params: RequestUrlParam = {
      url: `${this.baseUrl}${path}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      throw: false,
    };
    const response = await withTimeout(requestUrl(params));
    return { status: response.status, json: response.json };
  }
}
