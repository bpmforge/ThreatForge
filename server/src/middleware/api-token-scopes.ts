/**
 * Default-deny scope mapping for personal API tokens (ftm_...).
 *
 * Maps a request to the single scope it needs. null means API tokens
 * may not call the endpoint at all.
 */

// Never reachable with an API token, whatever the prefix rules say.
const DENIED_PREFIXES = ["/api/users/me", "/api/auth", "/api/admin"];
const DENIED_WORDS = [
  "api-tokens",
  "two-factor",
  "sessions",
  "password",
  "sso",
  "scim-tokens",
  "saml",
];

// CI routes that are admin/secret management or inbound webhooks.
const CI_DENIED = ["/api/ci/api-keys", "/api/ci/webhook"];

function startsWithSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

export function requiredScopeFor(method: string, url: string): string | null {
  const path = (url.split("?")[0] ?? "").split("#")[0] ?? "";
  const lower = path.toLowerCase().replace(/\/+$/, "") || "/";

  if (DENIED_PREFIXES.some((p) => startsWithSegment(lower, p))) return null;
  if (DENIED_WORDS.some((w) => lower.includes(w))) return null;

  const m = method.toUpperCase();
  const isRead = m === "GET" || m === "HEAD" || m === "OPTIONS";
  const action = isRead ? "read" : "write";

  // Threats (nested under a model, or top level)
  if (
    startsWithSegment(lower, "/api/threats") ||
    /^\/api\/(v1\/)?threat-models\/[^/]+\/threats(\/|$)/.test(lower)
  ) {
    return `${action}:threats`;
  }

  if (
    startsWithSegment(lower, "/api/threat-models") ||
    startsWithSegment(lower, "/api/models") ||
    startsWithSegment(lower, "/api/v1/threat-models")
  ) {
    return `${action}:models`;
  }

  if (startsWithSegment(lower, "/api/projects")) return `${action}:projects`;

  if (
    startsWithSegment(lower, "/api/organizations") ||
    startsWithSegment(lower, "/api/v1/organizations")
  ) {
    return isRead ? "read:organizations" : null;
  }

  // CI scans (keyed CI routes are separate; this covers personal tokens)
  if (startsWithSegment(lower, "/api/ci")) {
    if (CI_DENIED.some((p) => startsWithSegment(lower, p))) return null;
    if (lower.startsWith("/api/ci/scan"))
      return `ci:${isRead ? "read" : "write"}`;
    return null;
  }

  return null;
}

/** Scopes that satisfy a required scope: write:X also grants read:X. */
export function satisfyingScopes(required: string): string[] {
  const [action, resource] = required.split(":");
  return action === "read" && resource && resource !== "organizations"
    ? [required, `write:${resource}`]
    : [required];
}
