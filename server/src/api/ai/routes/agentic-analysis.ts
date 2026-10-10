/**
 * AI API — Agentic Multi-Framework Analysis Route
 *
 * POST /api/threat-models/:modelId/ai/agentic-analysis
 *
 * Runs parallel threat analysis across STRIDE, PASTA, Kill Chain, MITRE ATT&CK,
 * supply chain, and ML-specific agents. Consolidates and verifies until confident.
 *
 * POST /api/ai/extract-agentic
 *
 * Multi-document agentic extraction with confidence loop.
 */
import { aiOrgForRequest } from "../ai-org.js";
import { replyIfOverSpendCap } from "../../../services/ai/spend-guard.js";
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  buildThreatModelContext,
  sendSuccess,
  sendBadRequest,
  sendNotFound,
} from "../helpers.js";
import { startModelAnalysisJob } from "../analysis-job.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { authorizeModelAction } from "../../threat-models/helpers.js";
import { createAIClient } from "../../../services/ai/client-factory.js";
import {
  runExtractionAgent,
  mergeMultiDocExtractions,
  type ExtractionResult,
} from "../../../services/ai/extraction-agent.js";
import type { AISettings } from "../../../types/settings.js";
import { dispatchAiJob } from "../../../jobs/start-suggest-threats-job.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

/**
 * S1 + review of #237: these routes queue jobs that write threats or
 * mitigations into the model and spend its org's AI budget, so they need
 * edit, not just access.
 */
const MODEL_EDIT = routeAuthz({ model: "edit" });
const FIRST_ACTIVE_ORG = routeAuthz({
  handler:
    "ACTIVE member of the requested organizationId (else the caller's default, else oldest ACTIVE org); that org's AI settings are used",
});

export const agenticAnalysisRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/threat-models/:modelId/ai/agentic-analysis
   *
   * Run multi-framework agentic threat analysis.
   *
   * Body:
   * - frameworks?: string[] — which frameworks to use (default: auto-detect)
   * - minConfidence?: number — minimum score to stop (default: 85)
   * - extractionId?: string — ID of a previous extraction result for supply chain/ML analysis
   */
  server.post<{
    Params: { modelId: string };
    Body: {
      frameworks?: string[];
      minConfidence?: number;
    };
  }>(
    "/api/threat-models/:modelId/ai/agentic-analysis",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const body = (request.body || {}) as {
        frameworks?: string[];
        minConfidence?: number;
      };

      return startModelAnalysisJob({
        prisma,
        reply,
        log: request.log,
        userId: user.id,
        modelId,
        analysisName: "agentic analysis",
        input: JSON.stringify({
          modelId,
          mode: "agentic",
          frameworks: body.frameworks,
          minConfidence: body.minConfidence,
        }),
        type: "AGENTIC_ANALYSIS",
        estimatedDuration: "3-10 minutes (multi-framework parallel analysis)",
      });
    },
  );

  /**
   * POST /api/ai/extract-agentic
   *
   * Multi-document agentic extraction with confidence loop.
   * Accepts multiple document texts, runs extraction agent on each,
   * then merges and cross-references.
   *
   * Body:
   * - documents: Array<{ text: string, name: string, type?: string }>
   */
  server.post<{
    Body: {
      documents: Array<{
        text: string;
        name: string;
        type?: string;
      }>;
    };
  }>("/api/ai/extract-agentic", FIRST_ACTIVE_ORG, async (request, reply) => {
    const user = getAuthUser(request);
    const body = request.body;

    if (
      !body?.documents ||
      !Array.isArray(body.documents) ||
      body.documents.length === 0
    ) {
      return sendBadRequest(
        reply,
        "Provide at least one document in the 'documents' array.",
      );
    }

    // Validate total size
    const totalChars = body.documents.reduce(
      (sum, d) => sum + (d.text?.length || 0),
      0,
    );
    if (totalChars > 500000) {
      return sendBadRequest(
        reply,
        "Total document text exceeds 500K character limit.",
      );
    }

    // Get AI settings from user's org

    const aiOrg = await aiOrgForRequest(user.id, request);

    if (!aiOrg) {
      return sendBadRequest(reply, "No organization found");
    }

    const settings: AISettings = aiOrg.aiSettings
      ? JSON.parse(aiOrg.aiSettings)
      : null;

    if (!settings?.enabled) {
      return sendBadRequest(reply, "AI not configured");
    }

    const client = createAIClient(settings, aiOrg.id);
    if (!client) {
      return sendBadRequest(reply, "Could not create AI client");
    }

    // Run extraction agent on each document
    const extractions: Array<{
      extraction: ExtractionResult;
      documentName: string;
    }> = [];

    for (const doc of body.documents) {
      const extraction = await runExtractionAgent(client, doc.text, {
        documentType: doc.type,
      });
      extractions.push({
        extraction,
        documentName: doc.name,
      });
    }

    // Merge all extractions
    let merged: ExtractionResult;
    if (extractions.length === 1) {
      merged = extractions[0].extraction;
    } else {
      merged = mergeMultiDocExtractions(extractions);
    }

    return sendSuccess(reply, {
      extraction: merged,
      documentsProcessed: extractions.length,
      perDocumentResults: extractions.map((e) => ({
        name: e.documentName,
        components: e.extraction.components.length,
        flows: e.extraction.dataFlows.length,
        confidence: e.extraction.confidence,
        passes: e.extraction.passesCompleted,
      })),
    });
  });

  /**
   * POST /api/threat-models/:modelId/ai/micro-analysis
   *
   * Per-component, per-category micro-analysis.
   * Analyzes each component through each STRIDE/PASTA/Kill Chain category
   * individually with reference data injection and confidence loops.
   *
   * Body:
   * - methodologies?: string[] — default: ["stride"]
   * - minConfidence?: number — per-category confidence threshold (0-1, default: 0.7)
   */
  server.post<{
    Params: { modelId: string };
    Body: {
      methodologies?: string[];
      minConfidence?: number;
      fullAnalysis?: boolean;
      force?: boolean;
      componentNodeIds?: string[];
      categories?: string[];
      mitigationsOnly?: boolean;
      // Advanced job option: opt in to loop-until-dry discovery.
      // Only honoured on the agent-chain-v2 path; legacy ignores it.
      discovery?: { mode?: "single" | "until-dry"; maxRounds?: number };
    };
  }>(
    "/api/threat-models/:modelId/ai/micro-analysis",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const body = (request.body || {}) as {
        methodologies?: string[];
        minConfidence?: number;
        fullAnalysis?: boolean;
        force?: boolean;
        componentNodeIds?: string[];
        categories?: string[];
        mitigationsOnly?: boolean;
        discovery?: { mode?: "single" | "until-dry"; maxRounds?: number };
      };

      const context = await buildThreatModelContext(modelId);
      if (!context) {
        return sendNotFound(reply, "Threat model");
      }

      if (context.components.length === 0 && context.connections.length === 0) {
        return sendBadRequest(
          reply,
          "Add components and data flows before running micro-analysis.",
        );
      }

      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        include: { project: { select: { organizationId: true } } },
      });

      if (!model) return sendNotFound(reply, "Threat model");

      const jobInput = JSON.stringify({
        modelId,
        mode: "micro",
        methodologies: body.methodologies,
        minConfidence: body.minConfidence,
        fullAnalysis: body.fullAnalysis ?? false,
        force: body.force ?? false,
        componentNodeIds: body.componentNodeIds,
        categories: body.categories,
        mitigationsOnly: body.mitigationsOnly ?? false,
        // Opt-in loop-until-dry discovery. Only present when the caller
        // sets it; absent → the runner falls back to the pipeline default
        // (mode "single"), i.e. a single discovery pass.
        discovery: body.discovery,
      });

      if (
        await replyIfOverSpendCap(reply, prisma, model.project.organizationId)
      )
        return reply;
      const { createSuggestThreatsJob } = await import(
        "../../../jobs/create-suggest-threats-job.js"
      );
      const enqueueResult = await createSuggestThreatsJob({
        prisma,
        userId: user.id,
        organizationId: model.project.organizationId,
        threatModelId: modelId,
        input: jobInput,
      });
      if (enqueueResult.conflict) {
        return reply.status(409).send({
          error: "Threat analysis already in progress for this model",
          existingJobId: enqueueResult.existingJobId,
        });
      }
      const job = enqueueResult.job!;

      const jobData = {
        type: "SUGGEST_THREATS" as const,
        userId: user.id,
        organizationId: model.project.organizationId,
        threatModelId: modelId,
        input: jobInput,
        dbJobId: job.id,
      };

      await dispatchAiJob(jobData, request.log);

      return reply.status(202).send({
        data: {
          jobId: job.id,
          status: "QUEUED",
          type: "MICRO_ANALYSIS",
          statusUrl: `/api/ai-jobs/${job.id}`,
          estimatedDuration: `${context.components.length * 6 * 3}s (${context.components.length} components × 6 categories)`,
        },
      });
    },
  );

  /**
   * POST /api/threat-models/:modelId/ai/refresh-mitigations
   *
   * Queues a REFRESH_MITIGATIONS job that re-generates mitigations for
   * PENDING threats using the latest uploaded requirements context.
   * Triggered by the UI when mitigationsStaleAt is set (i.e., after a
   * requirements document is imported).
   */
  server.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai/refresh-mitigations",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        include: { project: { select: { organizationId: true } } },
      });
      if (!model) return sendNotFound(reply, "Threat model");

      if (
        await replyIfOverSpendCap(reply, prisma, model.project.organizationId)
      )
        return reply;
      const job = await prisma.aiJob.create({
        data: {
          userId: user.id,
          organizationId: model.project.organizationId,
          type: "REFRESH_MITIGATIONS",
          threatModelId: modelId,
          input: JSON.stringify({ modelId }),
        },
      });

      const jobData = {
        type: "REFRESH_MITIGATIONS" as const,
        userId: user.id,
        organizationId: job.organizationId,
        threatModelId: modelId,
        input: job.input,
        dbJobId: job.id,
      };

      const { enqueueAiJob, runJobInBackground } = await import(
        "../../../jobs/ai-queue.js"
      );

      if (process.env.REDIS_URL) {
        await enqueueAiJob(jobData).catch(() => runJobInBackground(jobData));
      } else {
        runJobInBackground(jobData);
      }

      return reply.status(202).send({
        data: {
          jobId: job.id,
          status: "QUEUED",
          statusUrl: `/api/ai-jobs/${job.id}`,
        },
      });
    },
  );
};
