/**
 * GitHub Integration - Helper Functions
 */
import { decryptValue } from "../../../../services/encryption/encryption-service.js";
import { assertPublicHttpUrl } from "../../../../utils/outbound-url.js";
import type { GitHubConfig, GitHubCredentials } from "./schemas.js";

/** Decrypt and parse JSON safely */
export function decryptAndParse<T>(encrypted: string | null): T | null {
  if (!encrypted) return null;
  const decrypted = decryptValue(encrypted);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}

/** Make GitHub API request */
export async function githubRequest(
  config: GitHubConfig,
  credentials: GitHubCredentials,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  // baseUrl is tenant-supplied and gets the stored token attached
  const urlError = await assertPublicHttpUrl(config.baseUrl);
  if (urlError) return { ok: false, status: 0, error: urlError };

  const url = `${config.baseUrl}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (credentials.type === "pat" && credentials.token) {
    headers["Authorization"] = `Bearer ${credentials.token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });

    const data = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!response.ok) {
      const message = data?.message as string | undefined;
      return {
        ok: false,
        status: response.status,
        error: message || `HTTP ${response.status}`,
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
