/**
 * Threat Model AI Settings Routes
 *
 * GET/PATCH AI settings via threat model ID, GET AI status, GET provider models.
 */
import type { FastifyPluginAsync } from "fastify";
import { AISettings, parseAISettings } from "../../../types/settings.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { canManageOrganizationAI, guardAISettingsUpdate } from "../helpers.js";
import {
  loadModelOrganization,
  maskStoredAISettings,
  encryptKeyForUpdate,
  saveAISettings,
  isAIConfigured,
} from "./ai-settings-shared.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });

export const modelAiSettingsRoutes: FastifyPluginAsync = async (server) => {
  /** Get AI settings for a threat model (via project -> organization) */
  server.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai-settings",
    MODEL_VIEW,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { modelId } = request.params;

      const org = await loadModelOrganization(authUser.id, modelId);
      if (!org) {
        return sendNotFound(reply, "Model or organization");
      }

      const settings: AISettings = parseAISettings(org.aiSettings);
      await maskStoredAISettings(org.id, settings);

      return sendSuccess(reply, settings);
    },
  );

  /** Update AI settings for a threat model (via project -> organization) */
  server.patch<{ Params: { modelId: string }; Body: Partial<AISettings> }>(
    "/api/threat-models/:modelId/ai-settings",
    routeAuthz({ model: "manage" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { modelId } = request.params;
      const updates = request.body;

      const org = await loadModelOrganization(authUser.id, modelId);
      if (!org) {
        return sendNotFound(reply, "Model or organization");
      }

      // This route writes the org-wide settings, so it needs the same role.
      if (!(await canManageOrganizationAI(authUser.id, org.id))) {
        return sendForbidden(
          reply,
          "Only org owners and admins can change AI settings",
        );
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

      if (updates.apiKey?.includes("••••")) {
        delete updates.apiKey;
      }

      // Encrypt a newly supplied key, or a legacy plaintext one already in
      // storage — this route used to write keys in the clear, so a PATCH that
      // supplies no key is the only chance to migrate what it left behind.
      const encryptedApiKey = await encryptKeyForUpdate(
        org.id,
        updates,
        currentSettings.encryptedApiKey,
        updates.apiKey ?? currentSettings.apiKey,
      );

      return sendSuccess(
        reply,
        await saveAISettings(org.id, currentSettings, updates, encryptedApiKey),
      );
    },
  );

  /** Get AI status for a threat model */
  server.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai-status",
    MODEL_VIEW,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { modelId } = request.params;

      const org = await loadModelOrganization(authUser.id, modelId);
      if (!org) {
        return sendNotFound(reply, "Model or organization");
      }

      const settings: AISettings = parseAISettings(org.aiSettings);
      const isConfigured = isAIConfigured(settings);

      return sendSuccess(reply, {
        enabled: settings.enabled,
        configured: isConfigured,
        provider: settings.provider,
        features: settings.features,
      });
    },
  );

  /** Get available models for a provider (LM Studio, Ollama) */
  server.get<{ Params: { provider: string } }>(
    "/api/ai/providers/:provider/models",
    routeAuthz({
      handler:
        "any signed-in user; lists models from the server's env-configured LM Studio/Ollama, no tenant data",
    }),
    async (request, reply) => {
      const { provider } = request.params;

      if (provider === "lmstudio") {
        const baseUrl =
          process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
        try {
          const response = await fetch(`${baseUrl}/models`, {
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) {
            return reply
              .status(503)
              .send({ error: "LM Studio not available", models: [] });
          }
          const data = (await response.json()) as {
            data?: Array<{ id: string }>;
          };
          const models =
            data.data?.map((m) => ({
              value: m.id,
              label: m.id,
            })) || [];
          return sendSuccess(reply, {
            provider: "lmstudio",
            models,
            available: true,
          });
        } catch {
          return sendSuccess(reply, {
            provider: "lmstudio",
            models: [],
            available: false,
          });
        }
      }

      if (provider === "ollama") {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        try {
          const response = await fetch(`${baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) {
            return reply
              .status(503)
              .send({ error: "Ollama not available", models: [] });
          }
          const data = (await response.json()) as {
            models?: Array<{ name: string }>;
          };
          const models =
            data.models?.map((m) => ({
              value: m.name,
              label: m.name,
            })) || [];
          return sendSuccess(reply, {
            provider: "ollama",
            models,
            available: true,
          });
        } catch {
          return sendSuccess(reply, {
            provider: "ollama",
            models: [],
            available: false,
          });
        }
      }

      return sendBadRequest(
        reply,
        "Provider does not support dynamic model listing",
      );
    },
  );
};
