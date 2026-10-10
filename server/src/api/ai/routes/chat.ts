/**
 * AI API - Chat routes (standard chat and streaming SSE).
 */
import type { FastifyPluginAsync } from "fastify";
import type { AIMessage } from "../helpers.js";
import {
  getAIServiceForModel,
  buildThreatModelContext,
  getPrisma,
  AIProviderManager,
  StreamingHandler,
  sanitizeMessage,
  sanitizeMessages,
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendInternalError,
} from "../helpers.js";
import { canAccessThreatModel } from "../../threat-models/helpers.js";
import { aiGuarded } from "../guards.js";

export const chatRoutes: FastifyPluginAsync = async (server) => {
  /** POST /api/threat-models/:modelId/ai/chat */
  server.post<{
    Params: { modelId: string };
    Body: { message: string; history?: AIMessage[] };
  }>(
    "/api/threat-models/:modelId/ai/chat",
    aiGuarded({ model: "view" }),
    async (request, reply) => {
      const userId = request.authUser?.id ?? null;
      if (!userId) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      if (!(await canAccessThreatModel(userId, request.params.modelId))) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const aiService = await getAIServiceForModel(request.params.modelId);
      if (!aiService) {
        return sendBadRequest(reply, "AI not configured for this model");
      }

      const context = await buildThreatModelContext(request.params.modelId);
      const { message, history = [] } = request.body;

      // Sanitize user message and history to prevent prompt injection
      const sanitizedMessage = sanitizeMessage(message);
      const sanitizedHistory = sanitizeMessages(
        history as { content: string; role: string }[],
      );

      try {
        const response = await aiService.chat(
          sanitizedMessage,
          sanitizedHistory as AIMessage[],
          context || undefined,
        );
        return sendSuccess(reply, {
          message: response.content,
          usage: response.usage,
        });
      } catch (err) {
        // Log full error server-side; return a generic message to the client so
        // internal details (stack traces, provider errors) are not leaked.
        request.log.error({ err }, "AI chat request failed");
        return sendInternalError(reply, "AI request failed");
      }
    },
  );

  /** GET /api/ai/stream/:modelId/chat - Streaming chat via SSE */
  server.get<{
    Params: { modelId: string };
    Querystring: { message: string; history?: string };
  }>(
    "/api/ai/stream/:modelId/chat",
    aiGuarded({ model: "view" }),
    async (request, reply) => {
      const { modelId } = request.params;
      const { message, history: historyJson } = request.query;

      if (!message) {
        return sendBadRequest(reply, "Message is required");
      }

      const userId = request.authUser?.id ?? null;
      if (!userId) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      if (!(await canAccessThreatModel(userId, modelId))) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Get org from model
      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        include: { project: { select: { organizationId: true } } },
      });

      if (!model?.project?.organizationId) {
        return sendNotFound(reply, "Model");
      }

      const orgId = model.project.organizationId;

      // Parse history
      let history: Array<{ role: string; content: string }> = [];
      if (historyJson) {
        try {
          history = JSON.parse(historyJson);
        } catch {
          // parse fallback — intentionally silent, chat proceeds without history
        }
      }

      // Sanitize inputs
      const sanitizedMessage = sanitizeMessage(message);
      const sanitizedHistory = history.map((h) => ({
        role: h.role,
        content: sanitizeMessage(h.content),
      }));

      // Set up SSE
      const providerManager = new AIProviderManager(orgId);
      const streamHandler = new StreamingHandler(providerManager);

      streamHandler.createSSEResponse(reply);
      await streamHandler.streamChat(
        modelId,
        sanitizedMessage,
        sanitizedHistory,
        reply,
      );

      // End response
      reply.raw.end();
    },
  );
};
