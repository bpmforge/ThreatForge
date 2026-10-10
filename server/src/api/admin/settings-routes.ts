/**
 * Admin Settings Routes
 *
 * System-wide settings management including email configuration.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../db.js";
import {
  encryptValue,
  decryptValue,
} from "../../services/encryption/encryption-service.js";
import { emailService } from "../../services/email/index.js";
import {
  clearNvdApiKeyCache,
  getNvdApiKeySource,
} from "../../services/nvd/nvd-api-key.js";
import {
  getAuthUser,
  isSuperAdmin,
  type SystemSettingsInput,
  type EmailConfigInput,
} from "./utils.js";
import {
  sendSuccess,
  sendForbidden,
  sendBadRequest,
} from "../../utils/api-response.js";
import { validatePrivateHostEntries } from "../../utils/outbound-url.js";
import {
  clearPrivateHostPolicyCache,
  envPrivateHostPolicy,
  parseStoredAllowlist,
} from "../../services/ai/private-host-policy.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

const SUPER_ADMIN = routeAuthz("superAdmin");

export const settingsRoutes: FastifyPluginAsync = async (server) => {
  /** Get system settings */
  server.get("/api/admin/settings", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const prisma = await getPrisma();
    let settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { id: "default" },
      });
    }

    // Parse IP allowlist from JSON string
    let ipAllowlist: string[] = [];
    if (settings.ipAllowlist) {
      try {
        ipAllowlist = JSON.parse(settings.ipAllowlist);
      } catch {
        ipAllowlist = [];
      }
    }

    // Parse and mask email config
    const emailConfigMasked = maskEmailConfig(settings.emailConfig);

    return sendSuccess(reply, {
      allowSignups: settings.allowSignups,
      requireEmailVerification: settings.requireEmailVerification,
      defaultUserRole: settings.defaultUserRole,
      sessionTimeoutHours: settings.sessionTimeoutHours,
      maxLoginAttempts: settings.maxLoginAttempts,
      lockoutDurationMinutes: settings.lockoutDurationMinutes,
      passwordMinLength: settings.passwordMinLength,
      passwordRequireUppercase: settings.passwordRequireUppercase,
      passwordRequireLowercase: settings.passwordRequireLowercase,
      passwordRequireNumbers: settings.passwordRequireNumbers,
      passwordRequireSpecialChars: settings.passwordRequireSpecialChars,
      mfaRequired: settings.mfaRequired,
      maxProjectsPerOrg: settings.maxProjectsPerOrg,
      enableAI: settings.enableAI,
      aiProvider: settings.aiProvider,
      auditRetentionDays: settings.auditRetentionDays,
      samlEnabled: settings.samlEnabled,
      samlJacksonUrl: settings.samlJacksonUrl,
      samlProductId: settings.samlProductId,
      ipAllowlistEnabled: settings.ipAllowlistEnabled,
      ipAllowlist,
      ...aiPrivateHostFields(settings),
      ...(await nvdKeyFields()),
      emailProvider: settings.emailProvider,
      emailFrom: settings.emailFrom,
      emailConfig: emailConfigMasked,
      updatedAt: settings.updatedAt.toISOString(),
    });
  });

  /** Update system settings */
  server.put<{ Body: SystemSettingsInput }>(
    "/api/admin/settings",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const {
        ipAllowlist,
        aiPrivateHostAllowlist,
        emailConfig,
        nvdApiKey,
        ...otherUpdates
      } = request.body;

      // NVD API key: stored encrypted; "" / null removes it; never echoed back
      let nvdApiKeyStored: string | null | undefined;
      if (nvdApiKey !== undefined) {
        const trimmed = typeof nvdApiKey === "string" ? nvdApiKey.trim() : "";
        if (!trimmed) {
          nvdApiKeyStored = null;
        } else if (!/^[A-Za-z0-9-]{16,64}$/.test(trimmed)) {
          return sendBadRequest(reply, "Invalid NVD API key", {
            message: "An NVD API key is letters, digits and dashes (a UUID).",
          });
        } else {
          nvdApiKeyStored = encryptValue(trimmed);
          if (!nvdApiKeyStored) {
            return sendBadRequest(reply, "Could not encrypt the NVD API key");
          }
        }
      }

      // Validate IP allowlist
      let ipAllowlistJson: string | undefined;
      if (ipAllowlist !== undefined) {
        const { validateIpAllowlist, clearIpAllowlistCache } = await import(
          "../../middleware/ip-allowlist.js"
        );
        const errors = validateIpAllowlist(ipAllowlist);
        if (errors.length > 0) {
          return sendBadRequest(reply, "Invalid IP allowlist", {
            message: errors.join("; "),
          });
        }
        ipAllowlistJson = JSON.stringify(ipAllowlist);
        clearIpAllowlistCache();
      }

      // AI private-host allowlist: hostnames, IPs, CIDRs (never link-local)
      let aiAllowlistJson: string | undefined;
      if (aiPrivateHostAllowlist !== undefined) {
        const entries = Array.isArray(aiPrivateHostAllowlist)
          ? aiPrivateHostAllowlist.map((e) => String(e).trim()).filter(Boolean)
          : [];
        const errors = Array.isArray(aiPrivateHostAllowlist)
          ? validatePrivateHostEntries(entries)
          : ["Must be a list of hostnames, IP addresses or CIDRs"];
        if (errors.length > 0) {
          return sendBadRequest(reply, "Invalid AI private-host allowlist", {
            message: errors.join("; "),
          });
        }
        aiAllowlistJson = JSON.stringify(entries);
      }

      // Handle email config encryption
      const emailConfigEncrypted = await encryptEmailConfig(
        emailConfig,
        prisma,
      );

      // Upsert settings
      const settings = await prisma.systemSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          ...otherUpdates,
          ...(ipAllowlistJson !== undefined && {
            ipAllowlist: ipAllowlistJson,
          }),
          ...(aiAllowlistJson !== undefined && {
            aiPrivateHostAllowlist: aiAllowlistJson,
          }),
          ...(emailConfigEncrypted !== undefined && {
            emailConfig: emailConfigEncrypted,
          }),
          ...(nvdApiKeyStored !== undefined && { nvdApiKey: nvdApiKeyStored }),
          updatedById: authUser.id,
        },
        update: {
          ...otherUpdates,
          ...(ipAllowlistJson !== undefined && {
            ipAllowlist: ipAllowlistJson,
          }),
          ...(aiAllowlistJson !== undefined && {
            aiPrivateHostAllowlist: aiAllowlistJson,
          }),
          ...(emailConfigEncrypted !== undefined && {
            emailConfig: emailConfigEncrypted,
          }),
          ...(nvdApiKeyStored !== undefined && { nvdApiKey: nvdApiKeyStored }),
          updatedById: authUser.id,
        },
      });

      // Clear caches
      clearPrivateHostPolicyCache();
      clearNvdApiKeyCache();
      const { clearPasswordPolicyCache } = await import(
        "../../services/password-validation.js"
      );
      clearPasswordPolicyCache();

      // Parse IP allowlist for response
      let parsedAllowlist: string[] = [];
      if (settings.ipAllowlist) {
        try {
          parsedAllowlist = JSON.parse(settings.ipAllowlist);
        } catch {
          parsedAllowlist = [];
        }
      }

      return sendSuccess(reply, {
        allowSignups: settings.allowSignups,
        requireEmailVerification: settings.requireEmailVerification,
        defaultUserRole: settings.defaultUserRole,
        sessionTimeoutHours: settings.sessionTimeoutHours,
        maxProjectsPerOrg: settings.maxProjectsPerOrg,
        enableAI: settings.enableAI,
        aiProvider: settings.aiProvider,
        auditRetentionDays: settings.auditRetentionDays,
        samlEnabled: settings.samlEnabled,
        samlJacksonUrl: settings.samlJacksonUrl,
        samlProductId: settings.samlProductId,
        ipAllowlistEnabled: settings.ipAllowlistEnabled,
        ipAllowlist: parsedAllowlist,
        ...aiPrivateHostFields(settings),
        ...(await nvdKeyFields()),
        emailProvider: settings.emailProvider,
        emailFrom: settings.emailFrom,
        emailConfig: maskEmailConfig(settings.emailConfig),
        updatedAt: settings.updatedAt.toISOString(),
      });
    },
  );

  /** Test email configuration */
  server.post<{ Body: EmailConfigInput }>(
    "/api/admin/email/test",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const result = await emailService.testConnection();
      return sendSuccess(reply, result);
    },
  );

  /** Send test email */
  server.post<{ Body: { to: string } }>(
    "/api/admin/email/send-test",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const { to } = request.body;
      if (!to) {
        return sendBadRequest(reply, "Email address is required");
      }

      const result = await emailService.send({
        to,
        subject: "ThreatForge - Test Email",
        text: "This is a test email from ThreatForge. If you received this, your email configuration is working correctly.",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a;">Test Email</h1>
            <p>This is a test email from <strong>ThreatForge</strong>.</p>
            <p>If you received this, your email configuration is working correctly.</p>
          </div>
        `,
      });

      return sendSuccess(reply, result);
    },
  );
};

/**
 * The AI private-host allowlist as the admin UI shows it: the stored list and
 * switch, plus what the server environment adds (read-only in the UI).
 */
/** Whether an NVD API key is in use and where it comes from; never the key. */
async function nvdKeyFields() {
  const source = await getNvdApiKeySource();
  return { nvdApiKeyConfigured: source !== "none", nvdApiKeySource: source };
}

function aiPrivateHostFields(settings: {
  aiPrivateHostAllowlist: string | null;
  aiAllowAllPrivateHosts: boolean;
}) {
  const env = envPrivateHostPolicy();
  return {
    aiPrivateHostAllowlist: parseStoredAllowlist(
      settings.aiPrivateHostAllowlist,
    ),
    aiAllowAllPrivateHosts: settings.aiAllowAllPrivateHosts,
    aiPrivateHostAllowlistFromEnv: env.entries,
    aiAllowAllPrivateHostsFromEnv: env.allowAll,
  };
}

/** Mask sensitive email config values */
function maskEmailConfig(
  encryptedConfig: string | null,
): Record<string, unknown> | null {
  if (!encryptedConfig) return null;

  try {
    const decrypted = decryptValue(encryptedConfig);
    if (!decrypted) return null;

    const config = JSON.parse(decrypted);
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (key === "apiKey" || key === "pass" || key === "secretAccessKey") {
        masked[key] =
          typeof value === "string" && value.length > 0
            ? value.slice(0, 4) + "••••••••"
            : "";
      } else {
        masked[key] = value;
      }
    }
    return masked;
  } catch {
    return null;
  }
}

/** Encrypt email config, preserving existing if values are masked */
async function encryptEmailConfig(
  emailConfig: Record<string, unknown> | undefined,
  prisma: Awaited<ReturnType<typeof getPrisma>>,
): Promise<string | undefined> {
  if (emailConfig === undefined) return undefined;

  const hasMaskedValues = Object.values(emailConfig).some(
    (v) => typeof v === "string" && v.includes("••••"),
  );

  if (hasMaskedValues) {
    const existing = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { emailConfig: true },
    });
    return existing?.emailConfig ?? undefined;
  }

  const encrypted = encryptValue(JSON.stringify(emailConfig));
  if (encrypted) {
    emailService.clearSettingsCache();
  }
  return encrypted ?? undefined;
}
