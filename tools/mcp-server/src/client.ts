/**
 * ThreatForge API Client
 *
 * Thin wrapper around the ThreatForge REST API.
 * Authenticates with an API token (ftm_... format).
 */

export interface ThreatForgeClientOptions {
  baseUrl: string;
  apiToken: string;
}

export class ThreatForgeClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: ThreatForgeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiToken}`,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ThreatForge API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { data?: T } | T;
    // Unwrap { data: T } envelope if present
    if (json && typeof json === "object" && "data" in json) {
      return (json as { data: T }).data;
    }
    return json as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
}

/** Create a client from environment variables */
export function createClientFromEnv(): ThreatForgeClient {
  const baseUrl = process.env.THREATFORGE_BASE_URL;
  const apiToken = process.env.THREATFORGE_API_TOKEN;

  if (!baseUrl) {
    throw new Error(
      "THREATFORGE_BASE_URL environment variable is required. " +
        "Example: http://localhost:3001",
    );
  }
  if (!apiToken) {
    throw new Error(
      "THREATFORGE_API_TOKEN environment variable is required. " +
        "Generate one at Settings → API Keys.",
    );
  }

  return new ThreatForgeClient({ baseUrl, apiToken });
}
