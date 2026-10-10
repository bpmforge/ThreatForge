import { internalBackendUrl } from "@/lib/backend-url";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

const BACKEND_URL = internalBackendUrl();

export async function GET() {
  const hdrs = await headers();
  const cookie = hdrs.get("cookie") ?? "";

  const res = await fetch(`${BACKEND_URL}/api/users/me/avatar`, {
    headers: { cookie },
    cache: "no-store",
  }).catch(() => null);

  if (!res) return NextResponse.json({ success: false }, { status: 503 });

  // Pass through binary/redirect responses
  const contentType = res.headers.get("content-type") ?? "application/json";
  if (res.redirected || res.status === 302 || res.status === 301) {
    return NextResponse.redirect(res.url);
  }
  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}

export async function POST(req: NextRequest) {
  const hdrs = await headers();
  const cookie = hdrs.get("cookie") ?? "";
  const body = await req.arrayBuffer();
  const contentType =
    req.headers.get("content-type") ?? "application/octet-stream";

  const res = await fetch(`${BACKEND_URL}/api/users/me/avatar`, {
    method: "POST",
    headers: { cookie, "content-type": contentType },
    body,
  }).catch(() => null);

  if (!res) return NextResponse.json({ success: false }, { status: 503 });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE() {
  const hdrs = await headers();
  const cookie = hdrs.get("cookie") ?? "";

  const res = await fetch(`${BACKEND_URL}/api/users/me/avatar`, {
    method: "DELETE",
    headers: { cookie },
  }).catch(() => null);

  if (!res) return NextResponse.json({ success: false }, { status: 503 });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
