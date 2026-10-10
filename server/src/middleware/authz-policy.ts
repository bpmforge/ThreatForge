/**
 * Route Authorization Policy
 *
 * Every route declares who may call it via `config: { authz: ... }`.
 * The declaration is checked mechanically by the route-authz inventory test
 * (src/__tests__/route-authz-inventory.test.ts): a new route without one
 * fails the suite. It is a declaration only — enforcement still lives in the
 * `authenticate` preHandler, access-control-service and the route handlers.
 */
import type { RouteOptions } from "fastify";

type OrgRole = "VIEWER" | "EDITOR" | "ADMIN" | "OWNER";
type ModelAction = "view" | "comment" | "edit" | "delete" | "manage";

export type AuthzPolicy =
  /** No user session. The string says why that is safe (signed webhook, own bearer token, health check...). */
  | { public: string }
  /** Any signed-in user, acting on their own data. */
  | "authenticated"
  /** Caller must hold at least this role in the organization the route addresses. */
  | { org: OrgRole }
  /** Caller must be allowed this action on the threat model the route addresses. */
  | { model: ModelAction }
  /** Platform super-admin only. */
  | "superAdmin"
  /** Authorization is decided inside the handler. The string says what it checks. */
  | { handler: string };

declare module "fastify" {
  interface FastifyContextConfig {
    authz?: AuthzPolicy;
  }
}

/**
 * Route options carrying only an authz declaration, for routes that have no
 * other options: `server.get("/x", routeAuthz("superAdmin"), handler)`.
 */
export function routeAuthz(policy: AuthzPolicy): {
  config: { authz: AuthzPolicy };
} {
  return { config: { authz: policy } };
}

const ORG_ROLES: readonly string[] = ["VIEWER", "EDITOR", "ADMIN", "OWNER"];
const MODEL_ACTIONS: readonly string[] = [
  "view",
  "comment",
  "edit",
  "delete",
  "manage",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Runtime guard — the inventory test reports malformed values, not just missing ones. */
export function isAuthzPolicy(value: unknown): value is AuthzPolicy {
  if (value === "authenticated" || value === "superAdmin") return true;
  if (typeof value !== "object" || value === null) return false;
  const entries = Object.entries(value);
  if (entries.length !== 1) return false;
  const [kind, arg] = entries[0];
  switch (kind) {
    case "public":
    case "handler":
      return isNonEmptyString(arg);
    case "org":
      return typeof arg === "string" && ORG_ROLES.includes(arg);
    case "model":
      return typeof arg === "string" && MODEL_ACTIONS.includes(arg);
    default:
      return false;
  }
}

export interface RouteAuthzRecord {
  method: string;
  url: string;
  authz: unknown;
}

/** Inventory key for a route, e.g. "GET /api/admin/users". */
function routeKey(method: string, url: string): string {
  return `${method} ${url}`;
}

/** Flatten a Fastify onRoute payload (method may be an array) into one record per method. */
export function toAuthzRecords(route: RouteOptions): RouteAuthzRecord[] {
  const methods = Array.isArray(route.method) ? route.method : [route.method];
  const config = route.config as { authz?: unknown } | undefined;
  return methods.map((method) => ({
    method,
    url: route.url,
    authz: config?.authz,
  }));
}

/**
 * Routes owned by registered plugins, not by ThreatForge code:
 * the CORS preflight catch-all and the dev-only Swagger UI (not registered
 * when NODE_ENV=production).
 */
export function isDependencyOwnedRoute({
  method,
  url,
}: RouteAuthzRecord): boolean {
  if (method === "OPTIONS" && url === "*") return true;
  return url === "/docs" || url.startsWith("/docs/");
}

export interface RouteAuthzReport {
  /** Routes with no `config.authz` that are not grandfathered. */
  undeclared: string[];
  /** Routes whose `config.authz` is not a valid AuthzPolicy. */
  invalid: string[];
  /** Grandfather entries whose route no longer exists. */
  staleGrandfather: string[];
  /** Grandfather entries whose route now declares authz — remove them. */
  annotatedGrandfather: string[];
  /** Number of routes checked (after HEAD mirrors and dependency routes). */
  checked: number;
}

/**
 * Compare registered routes against the grandfather list.
 * Fastify mirrors every GET as an automatic HEAD route; those HEAD records
 * are folded into their GET so they are not inventoried twice.
 */
export function checkRouteAuthz(
  records: RouteAuthzRecord[],
  grandfather: string[],
): RouteAuthzReport {
  const getUrls = new Set(
    records.filter((r) => r.method === "GET").map((r) => r.url),
  );
  const routes = records.filter(
    (r) =>
      !isDependencyOwnedRoute(r) &&
      !(r.method === "HEAD" && getUrls.has(r.url)),
  );

  const grandfathered = new Set(grandfather);
  const seen = new Set<string>();
  const report: RouteAuthzReport = {
    undeclared: [],
    invalid: [],
    staleGrandfather: [],
    annotatedGrandfather: [],
    checked: routes.length,
  };

  for (const route of routes) {
    const key = routeKey(route.method, route.url);
    seen.add(key);
    if (route.authz === undefined) {
      if (!grandfathered.has(key)) report.undeclared.push(key);
    } else if (!isAuthzPolicy(route.authz)) {
      report.invalid.push(key);
    } else if (grandfathered.has(key)) {
      report.annotatedGrandfather.push(key);
    }
  }
  report.staleGrandfather = grandfather.filter((key) => !seen.has(key));

  report.undeclared.sort();
  report.invalid.sort();
  report.annotatedGrandfather.sort();
  report.staleGrandfather.sort();
  return report;
}

export function isCleanAuthzReport(report: RouteAuthzReport): boolean {
  return (
    report.undeclared.length === 0 &&
    report.invalid.length === 0 &&
    report.staleGrandfather.length === 0 &&
    report.annotatedGrandfather.length === 0
  );
}

/** Human-readable failure message telling the developer exactly what to change. */
export function formatAuthzReport(report: RouteAuthzReport): string {
  const lines: string[] = [];
  const section = (title: string, keys: string[]) => {
    if (keys.length === 0) return;
    lines.push("", `${title} (${keys.length}):`, ...keys.map((k) => `  ${k}`));
  };

  section(
    "Routes with no authorization declaration. Add `config: { authz: ... }` to the route options " +
      '("authenticated" | "superAdmin" | { org: role } | { model: action } | { public: why } | { handler: what it checks }; ' +
      "see src/middleware/authz-policy.ts)",
    report.undeclared,
  );
  section(
    "Routes whose config.authz is not a valid AuthzPolicy",
    report.invalid,
  );
  section(
    "Grandfather entries for routes that now declare authz — delete them from src/__tests__/route-authz-grandfather.json",
    report.annotatedGrandfather,
  );
  section(
    "Grandfather entries for routes that no longer exist — delete them from src/__tests__/route-authz-grandfather.json " +
      "(the list may only shrink; a renamed route needs a declaration, not a new entry)",
    report.staleGrandfather,
  );
  return lines.join("\n") + "\n";
}
