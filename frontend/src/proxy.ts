/**
 * Next.js proxy: sends signed-out visitors to /login.
 *
 * This only checks that a session cookie is present, so it runs without
 * calling Auth.js on the edge. The session itself is validated where data is
 * read: the API verifies the token on every request and pages load the
 * session server-side.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes - no auth check needed
  const publicPaths = [
    "/login",
    "/register",
    "/api/auth",
    "/setup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/api/",
  ];

  // Dev-only /labs test fixtures (used by e2e) skip the login redirect
  // outside production; the pages themselves notFound() in production.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/labs")) {
    return NextResponse.next();
  }

  // Root path shows landing page for unauthenticated users
  if (
    pathname === "/" ||
    publicPaths.some((path) => pathname.startsWith(path))
  ) {
    return NextResponse.next();
  }

  // Check for session cookie (simple presence check)
  // Full validation happens server-side in API routes and pages
  const sessionCookie =
    req.cookies.get("authjs.session-token") ||
    req.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", req.url);

    // Set callback URL for redirect after login
    if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
