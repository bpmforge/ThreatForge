/**
 * Setup initialization route
 *
 * Create the super admin and primary organization.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import bcrypt from "bcryptjs";
import type { MemberRole, AIProviderType } from "@prisma/client";
import { validatePassword } from "../../../services/password-validation.js";
import { getSetupRateLimit } from "../../../middleware/rate-limit.js";
import { logAudit } from "../../../services/audit.js";
import {
  encryptValue,
  getKeyConfig,
} from "../../../services/encryption/index.js";
import {
  sendCreated,
  sendBadRequest,
  sendUnauthorized,
} from "../../../utils/api-response.js";
import {
  validateEmail,
  validateSlug,
  hasValidSetupToken,
  type CompleteSetupRequest,
} from "../index.js";

class SetupAlreadyClaimedError extends Error {}

export const setupInitializeRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/setup/initialize
   * Initialize the system with super admin and primary organization.
   * This is the main endpoint called by the setup wizard.
   * PUBLIC - no authentication required (only works if setup not complete).
   * Rate limited: 5 attempts per 15 minutes.
   */
  server.post<{ Body: CompleteSetupRequest }>(
    "/api/setup/initialize",
    {
      config: {
        ...getSetupRateLimit().config,
        authz: {
          public:
            "first-run only: refused once setupComplete; X-Setup-Token required in production when configured",
        },
      },
    },
    async (request, reply) => {
      if (!hasValidSetupToken(request)) {
        await logAudit({
          action: "SECURITY_BLOCK",
          resourceType: "SYSTEM_SETTINGS",
          resourceId: "default",
          resourceName: "System Setup",
          scope: "SYSTEM",
          userId: "system",
          userEmail: "system@localhost",
          metadata: { ip: request.ip, reason: "invalid_setup_token" },
        });
        return sendUnauthorized(
          reply,
          "Enter the setup token from the server log to finish setup.",
        );
      }

      const prisma = await getPrisma();
      const { admin, organization, ai, auth, security } = request.body;

      // Check if setup is already complete
      const settings = await prisma.systemSettings.findUnique({
        where: { id: "default" },
        select: { setupComplete: true },
      });

      if (settings?.setupComplete) {
        await logAudit({
          action: "SECURITY_BLOCK",
          resourceType: "SYSTEM_SETTINGS",
          resourceId: "default",
          resourceName: "System Setup",
          scope: "SYSTEM",
          userId: "system",
          userEmail: "system@localhost",
          metadata: { ip: request.ip, reason: "setup_already_complete" },
        });
        return sendBadRequest(reply, "Setup already complete");
      }

      // Check if any super admin already exists
      const existingSuperAdmin = await prisma.user.findFirst({
        where: { isSuperAdmin: true },
      });

      if (existingSuperAdmin) {
        await logAudit({
          action: "SECURITY_BLOCK",
          resourceType: "SYSTEM_SETTINGS",
          resourceId: "default",
          resourceName: "System Setup",
          scope: "SYSTEM",
          userId: "system",
          userEmail: "system@localhost",
          metadata: { ip: request.ip, reason: "super_admin_exists" },
        });
        return sendBadRequest(reply, "A super admin has already been created");
      }

      // Validate admin data
      if (!admin.name || admin.name.length < 2) {
        return sendBadRequest(reply, "Name must be at least 2 characters");
      }

      if (!validateEmail(admin.email)) {
        return sendBadRequest(reply, "Please provide a valid email address");
      }

      const passwordValidation = await validatePassword(admin.password);
      if (!passwordValidation.valid) {
        return sendBadRequest(reply, passwordValidation.errors.join(". "));
      }

      // Validate organization data
      if (!organization.name || organization.name.length < 2) {
        return sendBadRequest(
          reply,
          "Organization name must be at least 2 characters",
        );
      }

      if (!validateSlug(organization.slug)) {
        return sendBadRequest(
          reply,
          "Slug must be lowercase, contain only letters, numbers, and hyphens, and be 2-50 characters",
        );
      }

      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email: admin.email },
      });

      if (existingUser) {
        return sendBadRequest(reply, "A user with this email already exists");
      }

      // Check if slug is already taken
      const existingOrg = await prisma.organization.findUnique({
        where: { slug: organization.slug },
      });

      if (existingOrg) {
        return sendBadRequest(
          reply,
          "An organization with this slug already exists",
        );
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(admin.password, 12);

      // Create super admin, organization, and update settings in a transaction
      const result = await prisma
        .$transaction(async (tx) => {
          // Claim setup first. The conditional update locks the settings row,
          // so of two concurrent requests only one gets count 1.
          await tx.systemSettings.upsert({
            where: { id: "default" },
            create: { id: "default" },
            update: {},
          });
          const claimed = await tx.systemSettings.updateMany({
            where: { id: "default", setupComplete: false },
            data: { setupComplete: true },
          });
          if (claimed.count !== 1) throw new SetupAlreadyClaimedError();

          // Create the super admin user
          const superAdmin = await tx.user.create({
            data: {
              email: admin.email,
              name: admin.name,
              passwordHash,
              isSuperAdmin: true,
              emailVerified: new Date(), // Super admin is pre-verified
            },
          });

          // Create the primary organization
          const org = await tx.organization.create({
            data: {
              name: organization.name,
              slug: organization.slug,
              // Store AI settings if provided (API key encrypted)
              aiSettings: ai
                ? JSON.stringify({
                    enabled: ai.enabled,
                    provider: ai.provider,
                    apiKey: ai.apiKey
                      ? "[encrypted-at-provider-level]"
                      : undefined,
                    baseUrl: ai.baseUrl,
                    model: ai.model,
                  })
                : undefined,
            },
          });

          // Create membership for super admin as owner
          await tx.membership.create({
            data: {
              userId: superAdmin.id,
              organizationId: org.id,
              role: "OWNER" as MemberRole,
            },
          });

          // Update or create system settings
          await tx.systemSettings.upsert({
            where: { id: "default" },
            create: {
              id: "default",
              setupComplete: true,
              setupCompletedAt: new Date(),
              setupCompletedById: superAdmin.id,
              // Auth settings
              allowSignups: auth?.allowSignups ?? true,
              requireEmailVerification: auth?.requireEmailVerification ?? true,
              sessionTimeoutHours:
                auth?.sessionTimeoutHours ??
                security?.sessionTimeoutHours ??
                24,
              // AI settings
              enableAI: ai?.enabled ?? true,
              aiProvider: ai?.provider ?? "anthropic",
              // Security settings
              ipAllowlistEnabled: security?.ipAllowlistEnabled ?? false,
              ipAllowlist: security?.ipAllowlist
                ? JSON.stringify(security.ipAllowlist)
                : null,
              auditRetentionDays: security?.auditRetentionDays ?? 90,
            },
            update: {
              setupComplete: true,
              setupCompletedAt: new Date(),
              setupCompletedById: superAdmin.id,
              // Auth settings
              allowSignups: auth?.allowSignups ?? true,
              requireEmailVerification: auth?.requireEmailVerification ?? true,
              sessionTimeoutHours:
                auth?.sessionTimeoutHours ??
                security?.sessionTimeoutHours ??
                24,
              // AI settings
              enableAI: ai?.enabled ?? true,
              aiProvider: ai?.provider ?? "anthropic",
              // Security settings
              ipAllowlistEnabled: security?.ipAllowlistEnabled ?? false,
              ipAllowlist: security?.ipAllowlist
                ? JSON.stringify(security.ipAllowlist)
                : null,
              auditRetentionDays: security?.auditRetentionDays ?? 90,
            },
          });

          // Create audit log entry
          await tx.auditLog.create({
            data: {
              action: "CREATE",
              resourceType: "SYSTEM_SETTINGS",
              resourceId: "default",
              resourceName: "System Setup",
              userId: superAdmin.id,
              userEmail: superAdmin.email,
              organizationId: org.id,
              metadata: JSON.stringify({
                action: "initial_setup",
                ip: request.ip,
              }),
            },
          });

          return { superAdmin, org };
        })
        .catch((err: unknown) => {
          if (err instanceof SetupAlreadyClaimedError) return null;
          throw err;
        });
      if (!result) return sendBadRequest(reply, "Setup already complete");

      // Create AI provider with encrypted key (outside transaction -- encryption may need org to exist)
      if (ai?.enabled && ai?.apiKey && ai.provider !== "none") {
        try {
          const prisma = await getPrisma();
          const keyConfig = await getKeyConfig(result.org.id);
          const encryptedKey = await encryptValue(
            ai.apiKey,
            keyConfig ?? undefined,
          );
          await prisma.aIProvider.create({
            data: {
              name: `${ai.provider} (setup)`,
              type: ai.provider.toUpperCase() as AIProviderType,
              authType: "API_KEY",
              encryptedApiKey: encryptedKey,
              baseUrl: ai.baseUrl,
              model: ai.model,
              isDefault: true,
              priority: 1,
              organizationId: result.org.id,
              createdById: result.superAdmin.id,
            },
          });
          server.log.info(
            { orgId: result.org.id, provider: ai.provider },
            "AI provider created with encrypted key",
          );
        } catch (aiErr) {
          server.log.warn(
            { error: aiErr },
            "Failed to create AI provider during setup -- can be configured later",
          );
        }
      }

      server.log.info(
        { userId: result.superAdmin.id, orgId: result.org.id },
        "System setup completed successfully",
      );

      return sendCreated(reply, {
        success: true,
        message: "Setup completed successfully",
        user: {
          id: result.superAdmin.id,
          email: result.superAdmin.email,
          name: result.superAdmin.name,
        },
        organization: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
        },
      });
    },
  );
};
