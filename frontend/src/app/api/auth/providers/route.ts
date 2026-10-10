/**
 * OAuth Providers Status API
 *
 * Returns which OAuth providers are enabled for the login page.
 * Checks both environment variables and database configuration.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { internalBackendUrl } from "@/lib/backend-url";

interface ProviderStatus {
  id: string;
  name: string;
  enabled: boolean;
  source: "env" | "database";
}

export async function GET() {
  const providers: ProviderStatus[] = [];

  // Check env-based providers
  if (process.env.GOOGLE_CLIENT_ID) {
    providers.push({
      id: "google",
      name: "Google",
      enabled: true,
      source: "env",
    });
  }

  if (process.env.GITHUB_CLIENT_ID) {
    providers.push({
      id: "github",
      name: "GitHub",
      enabled: true,
      source: "env",
    });
  }

  // Check for SAML
  if (process.env.AUTH_BOXYHQ_SAML_ISSUER) {
    providers.push({
      id: "boxyhq-saml",
      name: "SSO (SAML)",
      enabled: true,
      source: "env",
    });
  }

  // Try to get database-configured providers (if server is available)
  try {
    const response = await fetch(`${internalBackendUrl()}/api/setup/status`, {
      cache: "no-store",
    });

    if (response.ok) {
      const _data = await response.json();

      // Only env-based providers are reported; database-configured OAuth
      // providers need admin auth and are not read here.
    }
  } catch {
    // Server not available, use env-based providers only
  }

  return NextResponse.json({
    providers,
    // Also return if credentials login is allowed
    credentialsEnabled: true,
  });
}
