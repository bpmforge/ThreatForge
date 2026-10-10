/**
 * OAuth Provider Status Routes
 *
 * Get enabled OAuth providers for the login page.
 * PUBLIC - no authentication required.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getOAuthConfig } from "../../oauth-providers.js";
import { sendSuccess } from "../../../utils/api-response.js";
import logger from "../../../utils/logger.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const LOGIN_PAGE = routeAuthz({
  public:
    "login page; returns only enabled provider names and signup flag, no secrets",
});

export const providerRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/auth/providers
   * Get enabled OAuth providers for the login page.
   */
  server.get("/api/auth/providers", LOGIN_PAGE, async (_request, reply) => {
    const prisma = await getPrisma();

    interface ProviderInfo {
      id: string;
      name: string;
      enabled: boolean;
    }

    const providers: ProviderInfo[] = [];

    // Check env-based providers
    if (process.env.GOOGLE_CLIENT_ID) {
      providers.push({ id: "google", name: "Google", enabled: true });
    }

    if (process.env.GITHUB_CLIENT_ID) {
      providers.push({ id: "github", name: "GitHub", enabled: true });
    }

    // Check for SAML
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { samlEnabled: true, allowSignups: true },
    });

    if (settings?.samlEnabled && process.env.AUTH_BOXYHQ_SAML_ISSUER) {
      providers.push({ id: "boxyhq-saml", name: "SSO", enabled: true });
    }

    // Get database-configured OAuth providers
    try {
      const oauthConfig = await getOAuthConfig();

      // Only add database providers if not already added from env
      if (oauthConfig.google?.enabled && !process.env.GOOGLE_CLIENT_ID) {
        providers.push({ id: "google", name: "Google", enabled: true });
      }
      if (oauthConfig.github?.enabled && !process.env.GITHUB_CLIENT_ID) {
        providers.push({ id: "github", name: "GitHub", enabled: true });
      }
      if (oauthConfig.microsoft?.enabled) {
        providers.push({ id: "azure-ad", name: "Microsoft", enabled: true });
      }
      if (oauthConfig.oidc?.enabled) {
        providers.push({
          id: "oidc",
          name: oauthConfig.oidc.name || "SSO",
          enabled: true,
        });
      }
    } catch (error) {
      // Log but don't fail - database OAuth config is optional
      logger.warn({ err: error }, "Failed to load database OAuth config:");
    }

    return sendSuccess(reply, {
      providers,
      credentialsEnabled: true,
      signupsEnabled: settings?.allowSignups ?? true,
    });
  });
};
