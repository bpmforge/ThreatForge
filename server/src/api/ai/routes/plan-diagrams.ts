/**
 * POST /api/threat-models/:modelId/ai/plan-diagrams
 *
 * Cross-doc Diagram Planner with Challenge-Defend.
 *
 * Loads all current (supersededAt: null) documents for the threat model,
 * passes them to the diagram planner, and returns the defend result:
 * retained plans (with verified citations) and retracted plans (phantom).
 *
 * This endpoint is additive — it does not modify the DB or trigger extraction.
 * Callers pass retained plans to prose-extractor to fire extraction per section.
 */
import { canEditThreatModel } from "../../threat-models/helpers.js";
import type { FastifyPluginAsync } from "fastify";
import { aiGuarded } from "../guards.js";
import { getPrisma } from "../../../db.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { createAIClient } from "../../../services/ai/client-factory.js";
import { planDiagrams } from "../../../services/ai/sequence-extraction/diagram-planner.js";
import { sendSuccess, sendBadRequest, sendNotFound } from "../helpers.js";
import type { AISettings } from "../../../types/settings.js";

export const planDiagramsRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai/plan-diagrams",
    aiGuarded({ model: "edit" }),
    async (request, reply) => {
      getAuthUser(request);
      // Authenticated is not authorised — verify this caller may reach
      // THIS model before touching it.
      const s1User = request.authUser as { id: string } | undefined;
      if (!s1User) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      if (!(await canEditThreatModel(s1User.id, request.params.modelId))) {
        return reply.status(403).send({ error: "Access denied" });
      }
      const prisma = await getPrisma();
      const { modelId } = request.params;

      // Verify model exists and load org AI settings
      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        include: {
          project: {
            include: {
              organization: { select: { id: true, aiSettings: true } },
            },
          },
        },
      });

      if (!model?.project?.organization) {
        return sendNotFound(reply, "Threat model");
      }

      // Load current (non-superseded) documents
      const documents = await prisma.document.findMany({
        where: { threatModelId: modelId, supersededAt: null },
        select: { id: true, name: true, content: true },
      });

      if (documents.length === 0) {
        return sendBadRequest(
          reply,
          "No documents found. Upload at least one document before planning diagrams.",
        );
      }

      const settings: AISettings = model.project.organization.aiSettings
        ? JSON.parse(model.project.organization.aiSettings)
        : null;

      if (!settings?.enabled) {
        return sendBadRequest(reply, "AI not configured");
      }

      const client = createAIClient(settings, model.project.organizationId);
      if (!client) {
        return sendBadRequest(reply, "Could not create AI client");
      }

      const sourceDocs = documents.map((d) => ({
        name: d.name,
        content: d.content,
      }));

      const result = await planDiagrams(client, sourceDocs);

      return sendSuccess(reply, {
        documentsUsed: documents.map((d) => ({ id: d.id, name: d.name })),
        totalPlanned: result.planned.length,
        retained: result.retained,
        retracted: result.retracted,
        retainedCount: result.retained.length,
        retractedCount: result.retracted.length,
      });
    },
  );
};
