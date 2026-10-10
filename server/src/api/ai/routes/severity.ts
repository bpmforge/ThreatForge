/**
 * AI API - Severity calculation route.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  aiServiceForModelEditor,
  sanitizeObject,
  sendSuccess,
  sendBadRequest,
  sendInternalError,
} from "../helpers.js";
import { aiGuarded } from "../guards.js";

const MODEL_EDIT = aiGuarded({ model: "edit" });

export const severityRoutes: FastifyPluginAsync = async (server) => {
  /** POST /api/threat-models/:modelId/ai/severity-calculate */
  server.post<{
    Params: { modelId: string };
    Body: {
      threat: { title: string; description: string; category: string };
      context?: {
        componentType?: string;
        dataClassification?: string;
        exposureLevel?: "internal" | "external" | "public";
        existingControls?: string[];
      };
    };
  }>(
    "/api/threat-models/:modelId/ai/severity-calculate",
    MODEL_EDIT,
    async (request, reply) => {
      const aiService = await aiServiceForModelEditor(
        request,
        reply,
        request.params.modelId,
      );
      if (!aiService) return reply;

      const { threat, context } = request.body;
      if (!threat?.title || !threat?.description || !threat?.category) {
        return sendBadRequest(
          reply,
          "Threat title, description, and category are required",
        );
      }

      const sanitizedThreat = sanitizeObject(threat, [
        "title",
        "description",
        "category",
      ]);

      try {
        const result = await aiService.calculateSeverity(
          sanitizedThreat as {
            title: string;
            description: string;
            category: string;
          },
          context,
        );
        return sendSuccess(reply, { success: true, ...result });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AI request failed";
        return sendInternalError(reply, message);
      }
    },
  );
};
