/**
 * AI API - Suggestion routes (suggest-threats, suggest-mitigations, auto-suggest).
 */
import { replyIfOverSpendCap } from "../../../services/ai/spend-guard.js";
import {
  canEditThreatModel,
  authorizeModelAction,
} from "../../threat-models/helpers.js";
import type { FastifyPluginAsync } from "fastify";
import type { AuthUser } from "../helpers.js";
import type { AISuggestedThreat } from "../../../types/ai.js";
import {
  getPrisma,
  getAIServiceForModel,
  aiServiceForModelEditor,
  buildThreatModelContext,
  sanitizeObject,
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendInternalError,
} from "../helpers.js";
import { parseClaim } from "../../../services/citation/citation-parser.js";
import { previewVerifyClaims } from "../../../services/citation/preview-verifier.js";
import logger from "../../../utils/logger.js";
import type { AIProviderClient } from "../../../types/ai.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { aiGuarded } from "../guards.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });
const AI_MODEL_EDIT = aiGuarded({ model: "edit" });

/**
 * If the LLM didn't embed inline citation tags in the description but DID
 * populate the schema's `references: [...]` array and/or
 * `targetComponentId`, synthesise the equivalent tags server-side. This
 * makes the verifier robust against LLMs that follow the JSON schema
 * (where "references" is an explicit slot) but drop the inline-tag prose
 * instruction.
 */
function augmentWithSchemaCitations(s: AISuggestedThreat): AISuggestedThreat {
  const description = s.description ?? "";
  const hasInlineTag = /\[(?:ref|doc|component):/i.test(description);
  if (hasInlineTag) return s;

  const tags: string[] = [];
  const refs = (s as unknown as { references?: unknown }).references;
  if (Array.isArray(refs)) {
    for (const r of refs) {
      if (typeof r !== "string") continue;
      // Extract "CWE-89" or "A03:2021" from any surrounding prose
      const cwe = r.match(/CWE-\d+/i);
      if (cwe) {
        tags.push(`[ref:${cwe[0].toUpperCase()}]`);
        continue;
      }
      const owasp = r.match(/A\d{2}:\d{4}/);
      if (owasp) {
        tags.push(`[ref:${owasp[0]}]`);
      }
    }
  }
  const componentId = s.targetComponentId;
  if (componentId) {
    tags.push(`[component:${componentId}]`);
  }
  if (tags.length === 0) return s;

  return { ...s, description: `${tags.join(" ")} ${description}` };
}

/**
 * Run preview-mode citation verification on AI suggestions and attach
 * results as a `verification` sidecar on each suggestion. Returns the
 * suggestions unchanged if verification fails (verification must never
 * block the suggest path).
 */
async function attachVerificationPreview(
  threatModelId: string,
  aiService: unknown,
  suggestions: AISuggestedThreat[],
): Promise<AISuggestedThreat[]> {
  if (suggestions.length === 0) return suggestions;

  try {
    const prisma = await getPrisma();
    // Pre-parse: synthesise citation tags from the LLM's `references` array
    // and `targetComponentId` fields BEFORE parsing. Real-world LLMs
    // (qwen3.6, others) consistently put CWEs in the schema's `references`
    // slot rather than inline in description — we let them, and recover
    // the grounding server-side rather than failing verification.
    const augmented = suggestions.map(augmentWithSchemaCitations);
    const parsedClaims = augmented.map((s) => parseClaim(s.description));
    const aiClient = (aiService as unknown as { client: AIProviderClient })
      .client;
    if (!aiClient) return suggestions;

    // Skip the expensive DOCUMENT cross-check when there are no docs,
    // but still run REFERENCE and COMPONENT verification (format + canvas
    // lookups are cheap). Previous behavior short-circuited the whole
    // preview when docCount=0 — that meant CWE/component citations also
    // got no verification signal.
    const docCount = await prisma.document.count({ where: { threatModelId } });
    void docCount;

    const previews = await previewVerifyClaims(
      prisma,
      aiClient,
      threatModelId,
      parsedClaims,
    );

    return augmented.map((s, i) => ({
      ...s,
      description: parsedClaims[i].claim,
      verification: {
        status: previews[i].status,
        citations: previews[i].citations.map((c) => ({
          type: c.type,
          documentName: c.documentName,
          sectionAnchor: c.sectionAnchor,
          pageNumber: c.pageNumber,
          referenceId: c.referenceId,
          componentNodeId: c.componentNodeId,
          requirementId: c.requirementId,
          confidence: c.confidence,
          rationale: c.rationale,
        })),
      },
    }));
  } catch (err) {
    // Preview verification failures must never block the suggest endpoint.
    logger.warn(
      { err, threatModelId, suggestionCount: suggestions.length },
      "verification preview failed — returning suggestions unverified",
    );
    return suggestions;
  }
}

export const suggestionRoutes: FastifyPluginAsync = async (server) => {
  /** POST /api/threat-models/:modelId/ai/suggest-threats */
  server.post<{
    Params: { modelId: string };
    Querystring: { async?: string };
  }>(
    "/api/threat-models/:modelId/ai/suggest-threats",
    MODEL_EDIT,
    async (request, reply) => {
      const { modelId } = request.params;

      // Authenticated is not authorised. The async branch below checked
      // authUser but never checked whether that user may reach THIS model, and
      // the sync branch checked neither.
      const suggestUser = request.authUser as AuthUser | undefined;
      if (!suggestUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      // Queues a job that writes the model / spends its AI budget: edit.
      if (
        !(await authorizeModelAction(reply, suggestUser.id, modelId, "edit"))
      ) {
        return reply;
      }

      // Async mode: enqueue as background job
      const isAsync = request.query.async === "true";
      if (isAsync && process.env.REDIS_URL) {
        const authUser = request.authUser as AuthUser | undefined;
        if (!authUser) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const prisma = await getPrisma();
        // Look up org from model
        const model = await prisma.threatModel.findUnique({
          where: { id: modelId },
          include: { project: { select: { organizationId: true } } },
        });
        if (!model) return sendNotFound(reply, "Threat model");

        const orgId = model.project.organizationId;
        if (await replyIfOverSpendCap(reply, prisma, orgId)) return reply;
        const { createSuggestThreatsJob } = await import(
          "../../../jobs/create-suggest-threats-job.js"
        );
        const enqueueResult = await createSuggestThreatsJob({
          prisma,
          userId: authUser.id,
          organizationId: orgId,
          threatModelId: modelId,
          input: JSON.stringify({ modelId }),
        });
        if (enqueueResult.conflict) {
          return reply.status(409).send({
            error: "Threat analysis already in progress for this model",
            existingJobId: enqueueResult.existingJobId,
          });
        }
        const job = enqueueResult.job!;

        const { enqueueAiJob } = await import("../../../jobs/ai-queue.js");
        await enqueueAiJob({
          type: "SUGGEST_THREATS",
          userId: authUser.id,
          organizationId: orgId,
          threatModelId: modelId,
          input: JSON.stringify({ modelId }),
          dbJobId: job.id,
        });

        return reply.status(202).send({
          data: {
            jobId: job.id,
            status: "QUEUED",
            type: "SUGGEST_THREATS",
            statusUrl: `/api/ai-jobs/${job.id}`,
          },
        });
      }

      const aiService = await getAIServiceForModel(modelId);
      if (!aiService) {
        return sendBadRequest(reply, "AI not configured for this model");
      }

      const context = await buildThreatModelContext(modelId);
      if (!context) {
        return sendNotFound(reply, "Threat model");
      }

      if (context.components.length === 0 && context.connections.length === 0) {
        return sendBadRequest(
          reply,
          "Add components and data flows to your model before running threat analysis. The AI needs architecture context to produce useful results.",
        );
      }

      try {
        const suggestions = await aiService.suggestThreats(context);
        const enriched = await attachVerificationPreview(
          modelId,
          aiService,
          suggestions,
        );
        return sendSuccess(reply, { threats: enriched });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AI request failed";
        return sendInternalError(reply, message);
      }
    },
  );

  /** POST /api/threat-models/:modelId/ai/suggest-mitigations */
  server.post<{
    Params: { modelId: string };
    Body: {
      threatId?: string;
      title: string;
      description: string;
      category: string;
    };
  }>(
    "/api/threat-models/:modelId/ai/suggest-mitigations",
    AI_MODEL_EDIT,
    async (request, reply) => {
      // This handler performed no authorisation at all — it went straight
      // to the model's AI config and context.
      const mitigationUser = request.authUser as AuthUser | undefined;
      if (!mitigationUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      if (
        !(await canEditThreatModel(mitigationUser.id, request.params.modelId))
      ) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const aiService = await getAIServiceForModel(request.params.modelId);
      if (!aiService) {
        return sendBadRequest(reply, "AI not configured for this model");
      }

      const context = await buildThreatModelContext(request.params.modelId);

      // Sanitize user input to prevent prompt injection
      const sanitizedBody = sanitizeObject(request.body, [
        "title",
        "description",
        "category",
      ]);
      const { title, description, category } = sanitizedBody;

      try {
        const suggestions = await aiService.suggestMitigations(
          { title, description, category },
          context || undefined,
        );
        return sendSuccess(reply, { mitigations: suggestions });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AI request failed";
        return sendInternalError(reply, message);
      }
    },
  );

  /** POST /api/threat-models/:modelId/ai/auto-suggest - Component-level proactive suggestions */
  server.post<{
    Params: { modelId: string };
    Body: {
      component: {
        type: string;
        name: string;
        description?: string;
        properties?: Record<string, unknown>;
      };
      connections?: Array<{
        direction: "inbound" | "outbound";
        protocol?: string;
        encrypted?: boolean;
      }>;
    };
  }>(
    "/api/threat-models/:modelId/ai/auto-suggest",
    AI_MODEL_EDIT,
    async (request, reply) => {
      const aiService = await aiServiceForModelEditor(
        request,
        reply,
        request.params.modelId,
      );
      if (!aiService) return reply;

      const { component, connections } = request.body;
      if (!component?.type || !component?.name) {
        return sendBadRequest(reply, "Component type and name are required");
      }

      // Sanitize component data
      const sanitizedComponent = sanitizeObject(component, [
        "type",
        "name",
        "description",
      ]);

      try {
        const suggestions = await aiService.autoSuggestThreats(
          sanitizedComponent as {
            type: string;
            name: string;
            description?: string;
            properties?: Record<string, unknown>;
          },
          connections,
        );
        const enriched = await attachVerificationPreview(
          request.params.modelId,
          aiService,
          suggestions,
        );
        return sendSuccess(reply, { success: true, threats: enriched });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AI request failed";
        return sendInternalError(reply, message);
      }
    },
  );
};
