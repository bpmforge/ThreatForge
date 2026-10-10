/**
 * OAuth Provider Management API
 *
 * Manage OAuth provider configurations (Google, GitHub, Microsoft, OIDC) dynamically
 * instead of using environment variables.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  encryptValue,
  decryptValue,
} from "../services/encryption/encryption-service.js";
import {
  sendSuccess,
  sendForbidden,
  sendBadRequest,
} from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const SUPER_ADMIN = routeAuthz("superAdmin");

// =============================================================================
// Types
// =============================================================================

type OAuthProviderType = "google" | "github" | "microsoft" | "oidc";

interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  // For OIDC custom provider
  issuer?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  scopes?: string[];
  // Display name for custom OIDC
  name?: string;
}

interface OAuthProvidersConfig {
  google?: OAuthProviderConfig;
  github?: OAuthProviderConfig;
  microsoft?: OAuthProviderConfig;
  oidc?: OAuthProviderConfig;
}

// =============================================================================
// Helpers
// =============================================================================

/** Check if user is a super admin */
async function isSuperAdmin(userId: string): Promise<boolean> {
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return user?.isSuperAdmin ?? false;
}

/** Get OAuth providers config from database */
async function getOAuthConfig(): Promise<OAuthProvidersConfig> {
  const prisma = await getPrisma();
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { oauthProviders: true },
  });

  if (!settings?.oauthProviders) {
    return {};
  }

  try {
    const decrypted = decryptValue(settings.oauthProviders);
    if (!decrypted) return {};
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

/** Save OAuth providers config to database */
async function saveOAuthConfig(
  config: OAuthProvidersConfig,
  userId: string,
): Promise<void> {
  const prisma = await getPrisma();
  const encrypted = encryptValue(JSON.stringify(config));

  if (!encrypted) {
    throw new Error("Failed to encrypt OAuth configuration");
  }

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      oauthProviders: encrypted,
      updatedById: userId,
    },
    update: {
      oauthProviders: encrypted,
      updatedById: userId,
    },
  });
}

/** Mask a client secret for display */
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return "";
  return secret.slice(0, 4) + "••••••••";
}

/** Check if a secret is masked (was not changed) */
export function isSecretMasked(secret: string): boolean {
  return secret.includes("••••");
}

// =============================================================================
// Routes
// =============================================================================

export const oauthProviderRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/admin/oauth-providers
   * Get all OAuth provider configurations (secrets masked).
   */
  server.get(
    "/api/admin/oauth-providers",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      // Only super admins can manage OAuth providers
      const isSuper = await isSuperAdmin(authUser.id);
      if (!isSuper) {
        return sendForbidden(reply, "Super admin access required");
      }

      const config = await getOAuthConfig();

      // Mask secrets before returning
      const maskedConfig: Record<string, unknown> = {};
      for (const [provider, providerConfig] of Object.entries(config)) {
        if (providerConfig) {
          maskedConfig[provider] = {
            ...providerConfig,
            clientSecret: maskSecret(providerConfig.clientSecret),
          };
        }
      }

      // Also include env-based providers (read-only info)
      const envProviders: Record<
        string,
        { enabled: boolean; source: "env" | "database" }
      > = {};
      if (process.env.GOOGLE_CLIENT_ID) {
        envProviders.google = { enabled: true, source: "env" };
      }
      if (process.env.GITHUB_CLIENT_ID) {
        envProviders.github = { enabled: true, source: "env" };
      }

      return sendSuccess(reply, {
        providers: maskedConfig,
        envProviders,
      });
    },
  );

  /**
   * PUT /api/admin/oauth-providers/:provider
   * Update a specific OAuth provider configuration.
   */
  server.patch<{
    Params: { provider: OAuthProviderType };
    Body: OAuthProviderConfig;
  }>(
    "/api/admin/oauth-providers/:provider",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      // Only super admins can manage OAuth providers
      const isSuper = await isSuperAdmin(authUser.id);
      if (!isSuper) {
        return sendForbidden(reply, "Super admin access required");
      }

      const { provider } = request.params;
      const providerConfig = request.body;

      // Validate provider type
      const validProviders: OAuthProviderType[] = [
        "google",
        "github",
        "microsoft",
        "oidc",
      ];
      if (!validProviders.includes(provider)) {
        return sendBadRequest(reply, "Invalid provider type");
      }

      // Get current config
      const currentConfig = await getOAuthConfig();

      // If secret is masked, keep the existing secret
      if (isSecretMasked(providerConfig.clientSecret)) {
        const existingProvider = currentConfig[provider];
        if (existingProvider) {
          providerConfig.clientSecret = existingProvider.clientSecret;
        } else {
          return sendBadRequest(
            reply,
            "Cannot update with masked secret - no existing secret found",
          );
        }
      }

      // Validate required fields for enabled providers
      if (providerConfig.enabled) {
        if (!providerConfig.clientId || !providerConfig.clientSecret) {
          return sendBadRequest(
            reply,
            "Client ID and Client Secret are required",
          );
        }

        // OIDC requires additional fields
        if (provider === "oidc" && !providerConfig.issuer) {
          return sendBadRequest(
            reply,
            "Issuer URL is required for OIDC provider",
          );
        }
      }

      // Update config
      const newConfig: OAuthProvidersConfig = {
        ...currentConfig,
        [provider]: providerConfig,
      };

      await saveOAuthConfig(newConfig, authUser.id);

      // Return masked version
      return sendSuccess(reply, {
        provider,
        config: {
          ...providerConfig,
          clientSecret: maskSecret(providerConfig.clientSecret),
        },
      });
    },
  );

  /**
   * DELETE /api/admin/oauth-providers/:provider
   * Remove an OAuth provider configuration.
   */
  server.delete<{ Params: { provider: OAuthProviderType } }>(
    "/api/admin/oauth-providers/:provider",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      // Only super admins can manage OAuth providers
      const isSuper = await isSuperAdmin(authUser.id);
      if (!isSuper) {
        return sendForbidden(reply, "Super admin access required");
      }

      const { provider } = request.params;

      // Get current config
      const currentConfig = await getOAuthConfig();

      // Remove provider
      delete currentConfig[provider];

      await saveOAuthConfig(currentConfig, authUser.id);

      return sendSuccess(reply, { provider });
    },
  );

  /**
   * GET /api/admin/oauth-providers/callback-urls
   * Get callback URLs for OAuth provider configuration.
   */
  server.get(
    "/api/admin/oauth-providers/callback-urls",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      // Only super admins can manage OAuth providers
      const isSuper = await isSuperAdmin(authUser.id);
      if (!isSuper) {
        return sendForbidden(reply, "Super admin access required");
      }

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.APP_URL ||
        "http://localhost:3000";

      return sendSuccess(reply, {
        google: `${baseUrl}/api/auth/callback/google`,
        github: `${baseUrl}/api/auth/callback/github`,
        microsoft: `${baseUrl}/api/auth/callback/azure-ad`,
        oidc: `${baseUrl}/api/auth/callback/oidc`,
      });
    },
  );
};

// Export helper functions for use in auth.ts
export { getOAuthConfig };
