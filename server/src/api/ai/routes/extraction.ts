/**
 * AI API - Architecture extraction routes (document text and diagram image).
 */
import { aiOrgForRequest } from "../ai-org.js";
import { replyIfOverSpendCap } from "../../../services/ai/spend-guard.js";
import type { FastifyPluginAsync } from "fastify";
import type { AuthUser } from "../helpers.js";
import logger from "../../../utils/logger.js";
import {
  getPrisma,
  AIService,
  AISettings,
  parseAISettings,
  decryptValue,
  getKeyConfig,
  sanitizeMessage,
  sendSuccess,
  sendBadRequest,
  sendInternalError,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { aiGuarded } from "../guards.js";

const AI_ORG_POLICY = {
  handler:
    "ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org)",
} as const;
const AI_ORG = routeAuthz(AI_ORG_POLICY);
const AI_ORG_GUARDED = aiGuarded(AI_ORG_POLICY);

export const extractionRoutes: FastifyPluginAsync = async (server) => {
  /** POST /api/ai/extract - Extract architecture from document text */
  server.post<{
    Body: {
      text?: string;
      prompt?: string;
      model?: string;
      existingComponentsSummary?: string;
      documentType?:
        | "srs"
        | "architecture"
        | "adr"
        | "openapi"
        | "terraform"
        | "cloudformation"
        | "threatModel"
        | "generic"
        | "auto";
    };
    Querystring: { async?: string };
  }>("/api/ai/extract", AI_ORG, async (request, reply) => {
    const authUser = request.authUser as AuthUser | undefined;
    if (!authUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const { text, prompt, documentType, existingComponentsSummary } =
      request.body;
    // Accept `text` (new) or `prompt` (legacy) as raw document content
    const documentText = text || prompt;
    if (!documentText || typeof documentText !== "string") {
      return sendBadRequest(reply, "Document text is required");
    }

    if (documentText.length > 100000) {
      return sendBadRequest(
        reply,
        "Document too large. Maximum 100,000 characters.",
      );
    }

    const prisma = await getPrisma();

    const aiOrg = await aiOrgForRequest(authUser.id, request);

    if (!aiOrg) {
      return sendBadRequest(reply, "No organization found");
    }

    // Async mode: enqueue as background job
    const isAsync = request.query.async === "true";
    if (isAsync && process.env.REDIS_URL) {
      const orgId = aiOrg.id;
      if (await replyIfOverSpendCap(reply, prisma, orgId)) return reply;
      const job = await prisma.aiJob.create({
        data: {
          userId: authUser.id,
          organizationId: orgId,
          type: "EXTRACT_DOCUMENT",
          input: JSON.stringify({
            text: documentText,
            documentType: documentType || "auto",
          }),
        },
      });

      const { enqueueAiJob } = await import("../../../jobs/ai-queue.js");
      await enqueueAiJob({
        type: "EXTRACT_DOCUMENT",
        userId: authUser.id,
        organizationId: orgId,
        input: JSON.stringify({
          text: documentText,
          documentType: documentType || "auto",
        }),
        dbJobId: job.id,
      });

      return reply.status(202).send({
        data: {
          jobId: job.id,
          status: "QUEUED",
          type: "EXTRACT_DOCUMENT",
          statusUrl: `/api/ai-jobs/${job.id}`,
        },
      });
    }

    const settings: AISettings = parseAISettings(aiOrg.aiSettings);

    if (!settings.enabled || settings.provider === "none") {
      return sendBadRequest(reply, "AI not configured for your organization");
    }

    if (settings.encryptedApiKey && !settings.apiKey) {
      try {
        const keyConfig = await getKeyConfig(aiOrg.id);
        const decryptedKey = decryptValue(
          settings.encryptedApiKey,
          keyConfig ?? undefined,
        );
        if (decryptedKey) {
          settings.apiKey = decryptedKey;
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to decrypt API key:");
        return sendInternalError(reply, "Failed to configure AI service");
      }
    }

    const aiService = new AIService(settings, aiOrg.id);

    try {
      const sanitizedText = sanitizeMessage(documentText);

      // Multi-step pipeline: 4 sequential focused calls with confidence +
      // challenge-defend loops. Falls back to single-pass on error.
      let result: { content: string; documentType: string };
      try {
        result = await aiService.extractArchitectureMultiStep(sanitizedText, {
          documentType: documentType || "auto",
        });
      } catch (multiStepErr) {
        server.log.warn(
          { err: multiStepErr },
          "Multi-step extraction failed, falling back to single-pass",
        );
        result = await aiService.extractArchitecture(sanitizedText, {
          documentType: documentType || "auto",
          existingComponentsSummary: existingComponentsSummary,
        });
      }

      return sendSuccess(reply, {
        response: result.content,
        documentType: result.documentType,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI extraction failed";
      return sendInternalError(reply, message);
    }
  });

  /** POST /api/ai/extract-diagram - Extract architecture from diagram image */
  server.post<{
    Body: {
      image: string;
      mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    };
  }>("/api/ai/extract-diagram", AI_ORG_GUARDED, async (request, reply) => {
    const authUser = request.authUser as AuthUser | undefined;
    if (!authUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const { image, mimeType } = request.body;
    if (!image || typeof image !== "string") {
      return sendBadRequest(reply, "Image data is required (base64 encoded)");
    }

    if (
      !mimeType ||
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType)
    ) {
      return sendBadRequest(
        reply,
        "Valid mimeType is required (image/png, image/jpeg, image/gif, image/webp)",
      );
    }

    if (image.length > 15 * 1024 * 1024) {
      return sendBadRequest(reply, "Image too large. Maximum size is 10MB.");
    }

    const aiOrg = await aiOrgForRequest(authUser.id, request);

    if (!aiOrg) {
      return sendBadRequest(reply, "No organization found");
    }

    const settings: AISettings = parseAISettings(aiOrg.aiSettings);

    if (!settings.enabled || settings.provider === "none") {
      return sendBadRequest(reply, "AI not configured for your organization");
    }

    const visionProviders = ["claude", "openai", "gemini", "vertexai"];
    if (!visionProviders.includes(settings.provider)) {
      return sendBadRequest(
        reply,
        `Provider "${settings.provider}" does not support image analysis. Use Claude, OpenAI, or Gemini.`,
      );
    }

    if (settings.encryptedApiKey && !settings.apiKey) {
      try {
        const keyConfig = await getKeyConfig(aiOrg.id);
        const decryptedKey = decryptValue(
          settings.encryptedApiKey,
          keyConfig ?? undefined,
        );
        if (decryptedKey) {
          settings.apiKey = decryptedKey;
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to decrypt API key:");
        return sendInternalError(reply, "Failed to configure AI service");
      }
    }

    const aiService = new AIService(settings, aiOrg.id);

    try {
      const response = await aiService.extractDiagram(image, mimeType);

      let parsed = null;
      try {
        const jsonMatch =
          response.match(/```json\s*([\s\S]*?)\s*```/) ||
          response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonContent = jsonMatch[1] || jsonMatch[0];
          parsed = JSON.parse(jsonContent);
        }
      } catch {
        // If parsing fails, still return the raw response
      }

      return sendSuccess(reply, {
        response,
        parsed,
        supportsVision: true,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Diagram extraction failed";
      return sendInternalError(reply, message);
    }
  });
};
