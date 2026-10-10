/**
 * JIRA Integration - Helper Functions
 */
import { assertPublicHttpUrl } from "../../../../utils/outbound-url.js";
import type { JiraConfig, JiraCredentials } from "./schemas.js";

/**
 * Make JIRA API request
 */
export async function jiraRequest(
  config: JiraConfig,
  credentials: JiraCredentials,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  // baseUrl is tenant-supplied and gets the stored credentials attached
  const urlError = await assertPublicHttpUrl(config.baseUrl);
  if (urlError) return { ok: false, status: 0, error: urlError };

  const url = `${config.baseUrl}/rest/api/3${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (
    credentials.type === "api_token" &&
    credentials.email &&
    credentials.apiToken
  ) {
    const auth = Buffer.from(
      `${credentials.email}:${credentials.apiToken}`,
    ).toString("base64");
    headers["Authorization"] = `Basic ${auth}`;
  } else if (credentials.type === "oauth2" && credentials.accessToken) {
    headers["Authorization"] = `Bearer ${credentials.accessToken}`;
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
      const errorMessages = data?.errorMessages as string[] | undefined;
      const message = data?.message as string | undefined;
      return {
        ok: false,
        status: response.status,
        error: errorMessages?.join(", ") || message || "Request failed",
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
