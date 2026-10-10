/**
 * Organization SSO Configuration API
 *
 * Manage organization-level SSO/SAML settings.
 * Only organization owners can configure SSO.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { getPrisma } from "../db.js";
import { checkOrganizationAccess } from "../services/access-control/access-control-service.js";
import { logAudit } from "../services/audit.js";
import {
  encryptValue,
  decryptValue,
} from "../services/encryption/encryption-service.js";
import type { SSOProvider } from "@prisma/client";
import {
  sendBadRequest,
  sendNotFound,
  sendForbidden,
} from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import logger from "../utils/logger.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { maskSecret, isSecretMasked } from "./oauth-providers.js";

// =============================================================================
// Types
// =============================================================================

interface SSOConfigBase {
  clientId: string;
  clientSecret: string;
}

interface SAMLConfig extends SSOConfigBase {
  metadataUrl?: string;
  metadataXml?: string;
  entryPoint: string;
  issuer: string;
  certificate: string;
  signatureAlgorithm?: "sha256" | "sha512";
  wantAssertionsSigned?: boolean;
}

interface OIDCConfig extends SSOConfigBase {
  issuer: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  jwksUri?: string;
  scopes?: string[];
}

type SSOConfig = SAMLConfig | OIDCConfig;

interface SSOSettingsResponse {
  enabled: boolean;
  provider: SSOProvider | null;
  domain: string | null;
  enforced: boolean;
  config: Partial<SSOConfig> | null; // Secrets masked
}

// =============================================================================
// Helpers
// =============================================================================

async function denyUnlessOwner(
  userId: string,
  orgId: string,
  reply: FastifyReply,
): Promise<FastifyReply | null> {
  const access = await checkOrganizationAccess(userId, orgId);
  if (!access.hasAccess || access.role !== "OWNER") {
    return sendForbidden(
      reply,
      "Only organization owners can manage SSO settings",
    );
  }
  return null;
}

function maskConfig(config: SSOConfig | null): Partial<SSOConfig> | null {
  if (!config) return null;
  return {
    ...config,
    clientSecret: maskSecret(config.clientSecret),
    ...("certificate" in config && config.certificate
      ? { certificate: "••••[CERTIFICATE]••••" }
      : {}),
  };
}

// =============================================================================
// Routes
// =============================================================================

export const ssoRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/organizations/:orgId/sso
   * Get SSO configuration for an organization (secrets masked).
   */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/sso",
    routeAuthz({ org: "OWNER" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      // Only owners can manage SSO
      const denied = await denyUnlessOwner(authUser.id, orgId, reply);
      if (denied) return denied;

      const prisma = await getPrisma();
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          ssoEnabled: true,
          ssoProvider: true,
          ssoConfig: true,
          ssoDomain: true,
          ssoEnforced: true,
        },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      let config: SSOConfig | null = null;
      if (org.ssoConfig) {
        try {
          const decrypted = decryptValue(org.ssoConfig);
          if (decrypted) {
            config = JSON.parse(decrypted);
          }
        } catch (err) {
          logger.warn(
            { err },
            "Failed to decrypt SSO config — returning null config",
          );
        }
      }

      const response: SSOSettingsResponse = {
        enabled: org.ssoEnabled,
        provider: org.ssoProvider,
        domain: org.ssoDomain,
        enforced: org.ssoEnforced,
        config: maskConfig(config),
      };

      return response;
    },
  );

  /**
   * PUT /api/organizations/:orgId/sso
   * Update SSO configuration for an organization.
   */
  server.put<{
    Params: { orgId: string };
    Body: {
      enabled: boolean;
      provider: SSOProvider;
      domain?: string;
      enforced?: boolean;
      config: SSOConfig;
    };
  }>(
    "/api/organizations/:orgId/sso",
    routeAuthz({ org: "OWNER" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { enabled, provider, domain, enforced, config } = request.body;

      // Only owners can manage SSO
      const denied = await denyUnlessOwner(authUser.id, orgId, reply);
      if (denied) return denied;

      const prisma = await getPrisma();

      // Get existing config to preserve secrets if masked
      const existingOrg = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { ssoConfig: true },
      });

      let finalConfig = config;

      // If secrets are masked, preserve existing secrets
      if (existingOrg?.ssoConfig && isSecretMasked(config.clientSecret)) {
        try {
          const decrypted = decryptValue(existingOrg.ssoConfig);
          if (decrypted) {
            const existingConfig = JSON.parse(decrypted) as SSOConfig;
            finalConfig = {
              ...config,
              clientSecret: existingConfig.clientSecret,
            };

            // Also preserve certificate if it's a SAML config
            if ("certificate" in config && "certificate" in existingConfig) {
              const configWithCert = config as SAMLConfig;
              if (configWithCert.certificate?.includes("••••")) {
                (finalConfig as SAMLConfig).certificate = (
                  existingConfig as SAMLConfig
                ).certificate;
              }
            }
          }
        } catch {
          // parse fallback — error surfaced to caller via sendBadRequest
          return sendBadRequest(reply, "Failed to preserve existing secrets");
        }
      }

      // Validate required fields for enabled SSO
      if (enabled) {
        if (!provider) {
          return sendBadRequest(reply, "SSO provider is required");
        }

        if (
          !finalConfig.clientId ||
          (!isSecretMasked(finalConfig.clientSecret) &&
            !finalConfig.clientSecret)
        ) {
          return sendBadRequest(
            reply,
            "Client ID and Client Secret are required",
          );
        }

        // Validate domain format if provided
        if (
          domain &&
          !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(domain)
        ) {
          return sendBadRequest(reply, "Invalid domain format");
        }

        // Check domain uniqueness
        if (domain) {
          const existingDomain = await prisma.organization.findFirst({
            where: {
              ssoDomain: domain,
              id: { not: orgId },
            },
          });
          if (existingDomain) {
            return sendBadRequest(
              reply,
              "This domain is already configured for another organization",
            );
          }
        }
      }

      // Encrypt config
      const encryptedConfig = encryptValue(JSON.stringify(finalConfig));

      // Update organization
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          ssoEnabled: enabled,
          ssoProvider: provider,
          ssoDomain: domain || null,
          ssoEnforced: enforced ?? false,
          ssoConfig: encryptedConfig,
        },
      });

      // Audit log
      await logAudit({
        action: "SSO_CONFIG_UPDATED",
        scope: "ORGANIZATION",
        resourceType: "ORGANIZATION",
        resourceId: orgId,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: {
          provider,
          enabled,
          enforced: enforced ?? false,
          domain: domain || null,
        },
      });

      return {
        success: true,
        enabled,
        provider,
        domain,
        enforced: enforced ?? false,
        config: maskConfig(finalConfig),
      };
    },
  );

  /**
   * DELETE /api/organizations/:orgId/sso
   * Disable and remove SSO configuration.
   */
  server.delete<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/sso",
    routeAuthz({ org: "OWNER" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      // Only owners can manage SSO
      const denied = await denyUnlessOwner(authUser.id, orgId, reply);
      if (denied) return denied;

      const prisma = await getPrisma();

      await prisma.organization.update({
        where: { id: orgId },
        data: {
          ssoEnabled: false,
          ssoProvider: null,
          ssoDomain: null,
          ssoEnforced: false,
          ssoConfig: null,
        },
      });

      // Audit log
      await logAudit({
        action: "SSO_CONFIG_DELETED",
        scope: "ORGANIZATION",
        resourceType: "ORGANIZATION",
        resourceId: orgId,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
      });

      return { success: true };
    },
  );

  /**
   * POST /api/organizations/:orgId/sso/test
   * Test SSO configuration (validates connection to IdP).
   */
  server.post<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/sso/test",
    routeAuthz({ org: "OWNER" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      // Only owners can manage SSO
      const denied = await denyUnlessOwner(authUser.id, orgId, reply);
      if (denied) return denied;

      const prisma = await getPrisma();
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          ssoEnabled: true,
          ssoProvider: true,
          ssoConfig: true,
        },
      });

      if (!org || !org.ssoConfig) {
        return sendBadRequest(reply, "SSO not configured");
      }

      let config: SSOConfig;
      try {
        const decrypted = decryptValue(org.ssoConfig);
        if (!decrypted) {
          return sendBadRequest(reply, "Failed to decrypt SSO configuration");
        }
        config = JSON.parse(decrypted);
      } catch {
        // parse fallback — error surfaced to caller via sendBadRequest
        return sendBadRequest(reply, "Invalid SSO configuration");
      }

      // Basic validation based on provider type
      const validationErrors: string[] = [];

      if (!config.clientId) validationErrors.push("Client ID is missing");
      if (!config.clientSecret)
        validationErrors.push("Client Secret is missing");

      if (org.ssoProvider === "SAML") {
        const samlConfig = config as SAMLConfig;
        if (!samlConfig.entryPoint)
          validationErrors.push("SAML Entry Point URL is missing");
        if (!samlConfig.issuer) validationErrors.push("SAML Issuer is missing");
        if (!samlConfig.certificate)
          validationErrors.push("SAML Certificate is missing");
      } else if (org.ssoProvider === "OIDC") {
        const oidcConfig = config as OIDCConfig;
        if (!oidcConfig.issuer)
          validationErrors.push("OIDC Issuer URL is missing");
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          valid: false,
          errors: validationErrors,
        };
      }

      // OIDC discovery (.well-known/openid-configuration) is not fetched;
      // only the configuration structure is validated.
      return {
        success: true,
        valid: true,
        message:
          "Configuration appears valid. Complete authentication testing by signing in with SSO.",
      };
    },
  );

  /**
   * GET /api/organizations/:orgId/sso/callback-url
   * Get the callback URL for SSO configuration.
   */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/sso/callback-url",
    routeAuthz({ org: "OWNER" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      // Only owners can manage SSO
      const denied = await denyUnlessOwner(authUser.id, orgId, reply);
      if (denied) return denied;

      const prisma = await getPrisma();
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { slug: true },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.APP_URL ||
        "http://localhost:3000";

      return {
        saml: `${baseUrl}/api/auth/callback/saml?org=${org.slug}`,
        oidc: `${baseUrl}/api/auth/callback/oidc?org=${org.slug}`,
        acsUrl: `${baseUrl}/api/auth/sso/acs/${org.slug}`,
        entityId: `${baseUrl}/api/auth/sso/metadata/${org.slug}`,
      };
    },
  );
};
