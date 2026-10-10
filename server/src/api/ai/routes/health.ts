/**
 * AI API - Health and availability routes.
 */
import { aiOrgForRequest } from "../ai-org.js";
import { canAccessThreatModel } from "../../threat-models/helpers.js";
import type { FastifyPluginAsync } from "fastify";
import type { AuthUser } from "../helpers.js";
import {
  getAIServiceForModel,
  getPrisma,
  AIProviderManager,
  AISettings,
  parseAISettings,
  sendSuccess,
  sendNotFound,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const MODEL_VIEW = routeAuthz({ model: "view" });
const AI_ORG = routeAuthz({
  handler:
    "ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org)",
});

export const healthRoutes: FastifyPluginAsync = async (server) => {
  /** GET /api/threat-models/:modelId/ai/available - Check if AI is available */
  server.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai/available",
    MODEL_VIEW,
    async (request, reply) => {
      // Authenticated is not authorised — verify this caller may reach
      // THIS model before touching it.
      const s1User = request.authUser as { id: string } | undefined;
      if (!s1User) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      if (!(await canAccessThreatModel(s1User.id, request.params.modelId))) {
        return reply.status(403).send({ error: "Access denied" });
      }
      const aiService = await getAIServiceForModel(request.params.modelId);
      if (!aiService) {
        return { available: false, reason: "AI not configured" };
      }

      const available = await aiService.isAvailable();
      return {
        available,
        reason: available ? undefined : "Provider not reachable",
      };
    },
  );

  /** GET /api/organizations/:orgId/ai/providers/health - Org-scoped provider health */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/ai/providers/health",
    ORG_VIEWER,
    async (request, reply) => {
      const authUser = request.authUser as AuthUser | undefined;
      if (!authUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const { orgId } = request.params;
      const prisma = await getPrisma();

      const membership = await prisma.membership.findFirst({
        where: { userId: authUser.id, organizationId: orgId, status: "ACTIVE" },
      });
      if (!membership) {
        return sendNotFound(reply, "Organization");
      }

      const providerManager = new AIProviderManager(orgId);
      const healthResults = await providerManager.checkAllHealth();

      return sendSuccess(reply, { providers: healthResults });
    },
  );

  /** GET /api/ai/providers/health - Global provider health */
  server.get("/api/ai/providers/health", AI_ORG, async (request, reply) => {
    const authUser = request.authUser as AuthUser | undefined;
    if (!authUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const aiOrg = await aiOrgForRequest(authUser.id, request);

    if (!aiOrg) {
      return sendSuccess(reply, { providers: [] });
    }

    const providerManager = new AIProviderManager(aiOrg.id);
    const healthResults = await providerManager.checkAllHealth();

    return sendSuccess(reply, { providers: healthResults });
  });

  /** GET /api/threat-models/:modelId/ai/provider-info - Data residency info */
  server.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai/provider-info",
    MODEL_VIEW,
    async (request, reply) => {
      // Authenticated is not authorised — verify this caller may reach
      // THIS model before touching it.
      const s1User = request.authUser as { id: string } | undefined;
      if (!s1User) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      if (!(await canAccessThreatModel(s1User.id, request.params.modelId))) {
        return reply.status(403).send({ error: "Access denied" });
      }
      const { getProviderMeta } = await import("../helpers.js");
      const meta = await getProviderMeta(request.params.modelId);
      if (!meta) {
        return { configured: false };
      }
      return {
        configured: true,
        provider: meta.provider,
        providerName: meta.name,
        isLocal: meta.isLocal,
        dataDestination: meta.destination,
        warning: meta.isLocal
          ? null
          : `Architecture data will be sent to ${meta.destination}. Use Ollama or LM Studio for local-only processing.`,
      };
    },
  );

  /** GET /api/ai/vision-support - Check if provider supports vision */
  server.get("/api/ai/vision-support", AI_ORG, async (request, reply) => {
    const authUser = request.authUser as AuthUser | undefined;
    if (!authUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const aiOrg = await aiOrgForRequest(authUser.id, request);

    if (!aiOrg) {
      return { supportsVision: false, reason: "No organization found" };
    }

    const settings: AISettings = parseAISettings(aiOrg.aiSettings);

    if (!settings.enabled || settings.provider === "none") {
      return { supportsVision: false, reason: "AI not configured" };
    }

    const visionProviders = ["claude", "openai", "gemini", "vertexai"];
    const supportsVision = visionProviders.includes(settings.provider);

    return {
      supportsVision,
      provider: settings.provider,
      reason: supportsVision
        ? undefined
        : `Provider "${settings.provider}" does not support image analysis`,
      supportedProviders: visionProviders,
    };
  });
};
