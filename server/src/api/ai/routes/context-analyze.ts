/**
 * Context-Aware Threat Analysis API
 *
 * POST /api/ai/context-analyze
 *
 * Runs the 5-phase context-aware pipeline on a component.
 * Uses the configured AI provider (any LLM) or falls back to rule-based.
 */
import type { FastifyPluginAsync } from "fastify";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { canEditThreatModel } from "../../threat-models/helpers.js";
import { sendSuccess, sendBadRequest } from "../../../utils/api-response.js";
import {
  runContextAwarePipeline,
  type ComponentContext,
} from "../../../services/threat-generation/context-aware-pipeline.js";
import { getPrisma } from "../../../db.js";
import logger from "../../../utils/logger.js";
import { aiRateLimited } from "../guards.js";
import { replyIfOverSpendCap } from "../../../services/ai/spend-guard.js";

const MODEL_EDIT = aiRateLimited({ model: "edit" });

export const contextAnalyzeRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/ai/context-analyze
   *
   * Analyzes a single component with full security context.
   * Returns context-aware findings with evidence citations.
   */
  server.post<{
    Body: {
      modelId: string;
      component: ComponentContext;
    };
  }>("/api/ai/context-analyze", MODEL_EDIT, async (request, reply) => {
    const user = getAuthUser(request);
    const { modelId, component } = request.body;

    if (!modelId) {
      return sendBadRequest(reply, "modelId is required");
    }
    if (!component?.id || !component?.type) {
      return sendBadRequest(reply, "Component with id and type is required");
    }

    // The model's organization AI provider (and its key) is used below, so
    // the caller must be able to edit that model.
    if (!(await canEditThreatModel(user.id, modelId))) {
      return reply.status(403).send({ error: "Access denied" });
    }

    // Build the AI call function from configured provider
    let aiCall: ((system: string, user: string) => Promise<string>) | undefined;

    try {
      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        select: {
          project: {
            select: {
              organization: {
                select: { id: true, aiSettings: true },
              },
            },
          },
        },
      });

      if (
        model &&
        (await replyIfOverSpendCap(
          reply,
          prisma,
          model.project.organization.id,
        ))
      ) {
        return reply;
      }

      if (model?.project.organization.aiSettings) {
        // Import AIService dynamically to avoid circular deps
        const { AIService } = await import(
          "../../../services/ai/ai-service.js"
        );

        const settings = JSON.parse(
          model.project.organization.aiSettings as string,
        );

        if (settings.enabled) {
          const aiService = new AIService(
            settings,
            model.project.organization.id,
          );

          aiCall = async (systemPrompt: string, userPrompt: string) => {
            const result = await aiService.complete([
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ]);
            return result.content;
          };
        }
      }
    } catch (err) {
      logger.warn(
        { err },
        "Failed to initialize AI provider — falling back to rule-based",
      );
    }

    // Run the pipeline
    const result = await runContextAwarePipeline(component, aiCall);

    logger.info(
      {
        modelId,
        component: component.name,
        findings: result.findings.length,
        ruleThreats: result.ruleBasedThreats.length,
        analysis: result.analysisUsed,
        duration: result.duration,
      },
      "Context-aware analysis complete",
    );

    return sendSuccess(reply, {
      findings: result.findings,
      ruleBasedThreats: result.ruleBasedThreats,
      research: {
        owaspCategories: result.research.owasp.length,
        cweWeaknesses: result.research.cwes.length,
        complianceRequirements: result.research.complianceRequirements.length,
        cveVulnerabilities: result.research.cves.length,
      },
      analysisUsed: result.analysisUsed,
      duration: result.duration,
    });
  });
};
