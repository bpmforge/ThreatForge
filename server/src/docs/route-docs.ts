/**
 * Route documentation generator.
 *
 * Builds the real Fastify app (no listen, no database) the same way the
 * route-authz inventory test does, and renders every registered route as the
 * generated API section of docs/FEATURES.md. The CLI is
 * scripts/generate-api-docs.ts (`npm run docs:routes`); the freshness test
 * (src/__tests__/api-docs-freshness.test.ts) re-renders in memory and fails
 * when the committed section differs.
 *
 * Output must be deterministic: no timestamps, routes sorted by url then method.
 */
import { fileURLToPath } from "url";
import type { RouteOptions } from "fastify";
import { isDependencyOwnedRoute } from "../middleware/authz-policy.js";

export const FEATURES_PATH = fileURLToPath(
  new URL("../../../docs/FEATURES.md", import.meta.url),
);
const BEGIN_MARKER = "<!-- BEGIN GENERATED ROUTES -->";
const END_MARKER = "<!-- END GENERATED ROUTES -->";

export interface RouteDoc {
  method: string;
  url: string;
  authz: unknown;
  description: string;
}

function routeDescription(route: RouteOptions): string {
  const schema = route.schema as
    | { summary?: unknown; description?: unknown }
    | undefined;
  const text = schema?.summary ?? schema?.description;
  return typeof text === "string" ? text : "";
}

/** Build the app and collect one RouteDoc per method, minus HEAD mirrors and plugin-owned routes. */
export async function collectRouteDocs(): Promise<RouteDoc[]> {
  const routes: RouteDoc[] = [];
  const previousLogLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = "silent";
  try {
    const { buildServer } = await import("../app.js");
    const app = await buildServer({
      jwtSecret: "route-docs-generator-secret",
      onRoute: (route) => {
        const methods = Array.isArray(route.method)
          ? route.method
          : [route.method];
        const config = route.config as { authz?: unknown } | undefined;
        for (const method of methods) {
          routes.push({
            method,
            url: route.url,
            authz: config?.authz,
            description: routeDescription(route),
          });
        }
      },
    });
    await app.ready();
    await app.close();
  } finally {
    if (previousLogLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = previousLogLevel;
  }

  const getUrls = new Set(
    routes.filter((r) => r.method === "GET").map((r) => r.url),
  );
  return routes
    .filter(
      (r) =>
        !isDependencyOwnedRoute(r) &&
        !(r.method === "HEAD" && getUrls.has(r.url)),
    )
    .sort((a, b) =>
      a.url === b.url
        ? a.method.localeCompare(b.method)
        : a.url.localeCompare(b.url),
    );
}

/** `/api/organizations/:id` → `/api/organizations`; `/api/v1/x/y` → `/api/v1/x`; `/health` → `/health`. */
export function routeGroup(url: string): string {
  const segments = url.split("/").filter(Boolean);
  const depth = segments[0] === "api" ? (segments[1] === "v1" ? 3 : 2) : 1;
  return `/${segments.slice(0, depth).join("/")}`;
}

export function formatAuthz(authz: unknown): string {
  if (authz === undefined) return "— (grandfathered)";
  if (typeof authz === "string") return authz;
  if (typeof authz === "object" && authz !== null) {
    const [kind, arg] = Object.entries(authz)[0] ?? [];
    if (kind === "org" || kind === "model") return `${kind}:${String(arg)}`;
    if (kind) return `${kind} (${String(arg)})`;
  }
  return JSON.stringify(authz);
}

function cell(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

export function renderRoutesSection(routes: RouteDoc[]): string {
  const groups = new Map<string, RouteDoc[]>();
  for (const route of routes) {
    const key = routeGroup(route.url);
    groups.set(key, [...(groups.get(key) ?? []), route]);
  }
  const keys = [...groups.keys()].sort();

  const lines = [
    "_Generated from the registered Fastify routes by `npm run docs:routes` (run in `server/`). " +
      "Do not edit by hand: `server/src/__tests__/api-docs-freshness.test.ts` fails when this section is stale._",
    "",
    `${routes.length} routes in ${keys.length} groups. **Authz** is the route's \`config.authz\` declaration ` +
      "(see `server/src/middleware/authz-policy.ts`); grandfathered routes predate it.",
  ];
  for (const key of keys) {
    const group = groups.get(key) ?? [];
    lines.push(
      "",
      `### \`${key}\` (${group.length})`,
      "",
      "| Method | Path | Authz | Description |",
      "|--------|------|-------|-------------|",
      ...group.map(
        (r) =>
          `| ${r.method} | \`${r.url}\` | ${cell(formatAuthz(r.authz))} | ${cell(r.description)} |`,
      ),
    );
  }
  return lines.join("\n");
}

/** Replace the text between the markers. Throws when either marker is missing. */
export function spliceGeneratedSection(
  markdown: string,
  section: string,
): string {
  const begin = markdown.indexOf(BEGIN_MARKER);
  const end = markdown.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `docs/FEATURES.md must contain ${BEGIN_MARKER} followed by ${END_MARKER}`,
    );
  }
  return (
    markdown.slice(0, begin + BEGIN_MARKER.length) +
    "\n" +
    section +
    "\n" +
    markdown.slice(end)
  );
}
