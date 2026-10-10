/**
 * Setup Status API Route
 * Proxies to the backend to check if first-time setup is complete.
 * This is a public endpoint.
 */
import { NextResponse } from "next/server";
import { internalBackendUrl } from "@/lib/backend-url";

export async function GET() {
  try {
    const response = await fetch(`${internalBackendUrl()}/api/setup/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // If backend is not reachable, assume setup is complete
      // (to avoid redirect loops if backend is down)
      return NextResponse.json({
        setupComplete: true,
        hasUsers: true,
        hasSuperAdmin: true,
        backendError: true,
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // If there's a network error, assume setup is complete
    console.error("Failed to check setup status:", error);
    return NextResponse.json({
      setupComplete: true,
      hasUsers: true,
      hasSuperAdmin: true,
      backendError: true,
    });
  }
}
