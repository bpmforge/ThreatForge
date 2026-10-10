/**
 * Organization AI Settings Routes
 *
 * GET/PATCH org AI settings, GET org AI status.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { AISettings, parseAISettings } from "../../../types/settings.js";
import { getBYOKConfig } from "../../../services/encryption/index.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import {
  canAccessOrganization,
  canManageOrganizationAI,
  guardAISettingsUpdate,
} from "../helpers.js";
import {
  loadOrgAISettings,
  maskStoredAISettings,
  encryptKeyForUpdate,
  saveAISettings,
  isAIConfigured,
} from "./ai-settings-shared.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const aiSettingsRoutes: FastifyPluginAsync = async (server) => {
  /** Get organization AI settings */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/ai-settings",
    ORG_VIEWER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const settings = await loadOrgAISettings(authUser.id, orgId);
      if (!settings) {
        return sendNotFound(reply, "Organization");
      }

      await maskStoredAISettings(orgId, settings);

      return sendSuccess(reply, settings);
    },
  );

  /** Update organization AI settings */
  server.patch<{ Params: { orgId: string }; Body: Partial<AISettings> }>(
    "/api/organizations/:orgId/ai-settings",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { orgId } = request.params;
      const updates = request.body;

      const hasAccess = await canAccessOrganization(authUser.id, orgId);
      if (!hasAccess) {
        return sendNotFound(reply, "Organization");
      }
      if (!(await canManageOrganizationAI(authUser.id, orgId))) {
        return sendForbidden(
          reply,
          "Only org owners and admins can change AI settings",
        );
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { aiSettings: true },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      const currentSettings: AISettings = parseAISettings(org.aiSettings);
      delete updates.encryptedApiKey;
      const invalid = await guardAISettingsUpdate(
        currentSettings,
        updates,
        authUser.id,
      );
      if (invalid) {
        return sendBadRequest(reply, invalid);
      }

      // Don't overwrite API key if masked value is sent back
      if (updates.apiKey?.includes("••••")) {
        delete updates.apiKey;
      }

      // Encrypt API key if a new one is provided
      const encryptedApiKey = await encryptKeyForUpdate(
        orgId,
        updates,
        currentSettings.encryptedApiKey,
        updates.apiKey,
      );

      return sendSuccess(
        reply,
        await saveAISettings(orgId, currentSettings, updates, encryptedApiKey),
      );
    },
  );

  /** Check if AI is available for an organization */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/ai-status",
    ORG_VIEWER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const settings = await loadOrgAISettings(authUser.id, orgId);
      if (!settings) {
        return sendNotFound(reply, "Organization");
      }

      const isConfigured = isAIConfigured(settings);

      const byokConfig = await getBYOKConfig(orgId);

      return sendSuccess(reply, {
        enabled: settings.enabled,
        configured: isConfigured,
        provider: settings.provider,
        features: settings.features,
        encryption: {
          byokEnabled: byokConfig.enabled,
          keyVersion: byokConfig.activeKeyVersion,
        },
      });
    },
  );
};
