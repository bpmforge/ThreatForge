/**
 * Test AI Connection API Route
 * Proxies to the backend to test AI provider connections during setup.
 * This is a public endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { internalBackendUrl } from "@/lib/backend-url";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${internalBackendUrl()}/api/setup/test-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Setup-Token": request.headers.get("x-setup-token") ?? "",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to test AI connection:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to connect to backend",
      },
      { status: 500 },
    );
  }
}
