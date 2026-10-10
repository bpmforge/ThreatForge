/**
 * Catch-all API proxy — forwards all /api/* requests to the Fastify backend
 * with the session cookie forwarded server-side.
 *
 * Why this exists: SameSite=Lax cookies aren't sent in cross-port browser
 * fetch requests (localhost:3000 → localhost:3001), causing 401s on all
 * protected backend endpoints. Routing through this Next.js server-side
 * proxy ensures the session cookie is always forwarded.
 *
 * Specific proxy routes (e.g. /api/notifications/stats) take precedence in
 * Next.js route resolution, so this only handles what isn't already proxied.
 */
import { internalBackendUrl } from "@/lib/backend-url";
import { clientIpHeaders } from "@/lib/client-ip";
import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

const BACKEND_URL = internalBackendUrl();

async function proxy(req: NextRequest): Promise<NextResponse> {
  const hdrs = await headers();
  const cookie = hdrs.get("cookie") ?? "";

  // Reconstruct the backend URL: /api/[...proxy] → backend /api/[...proxy]
  const url = new URL(req.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  const forwardHeaders: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
    cookie,
    ...clientIpHeaders((name) => req.headers.get(name)),
  };

  // The setup wizard authenticates its first request with this header.
  const setupToken = req.headers.get("x-setup-token");
  if (setupToken) forwardHeaders["x-setup-token"] = setupToken;

  // Forward the body only for methods that have one
  const hasBody = !["GET", "HEAD", "DELETE"].includes(req.method);
  const body = hasBody ? await req.text() : undefined;

  const res = await fetch(backendUrl, {
    method: req.method,
    headers: forwardHeaders,
    body,
    cache: "no-store",
  }).catch((err) => {
    console.error("[proxy] Backend unreachable:", err.message);
    return null;
  });

  if (!res) {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
