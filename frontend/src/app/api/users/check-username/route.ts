/**
 * Username Validation API
 *
 * Checks if a username is valid and available.
 * Used for real-time validation during registration or profile updates.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { validateUsername, validateUsernameFormat } from "@/lib/username";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "Username parameter is required" },
        { status: 400 },
      );
    }

    // First do a quick format validation (no DB call)
    const formatResult = validateUsernameFormat(username);
    if (!formatResult.valid) {
      return NextResponse.json({
        valid: false,
        error: formatResult.error,
      });
    }

    // Get current user if authenticated (to exclude their own username)
    const session = await auth();
    const excludeUserId = session?.user?.id;

    // Full validation including availability check
    const result = await validateUsername(username, excludeUserId);

    return NextResponse.json({
      valid: result.valid,
      error: result.error,
      username,
    });
  } catch (error) {
    console.error("Username validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate username" },
      { status: 500 },
    );
  }
}
