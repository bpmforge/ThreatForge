/**
 * Pipelines API - Execution Routes
 *
 * Execute pipelines and query execution history/status.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  executePipeline,
  getExecutionStatus,
  getExecutionHistory,
  AIService,
  getPrisma,
  sendNotFound,
  sendBadRequest,
  sendInternalError,
  sendUnauthorized,
} from "../helpers.js";
import { checkThreatModelAccess } from "../../../services/access-control/access-control-service.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_EDITOR = routeAuthz({ org: "EDITOR" });

export const executionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/organizations/:orgId/pipelines/:pipelineId/execute
   * Execute a pipeline
   */
  fastify.post<{
    Params: { orgId: string; pipelineId: string };
    Body: {
      inputDocument?: string;
      documentId?: string;
      inputMetadata?: Record<string, unknown>;
      threatModelId?: string;
    };
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId/execute",
    ORG_EDITOR,
    async (request, reply) => {
      const { orgId, pipelineId } = request.params;
      const { inputDocument, documentId, inputMetadata, threatModelId } =
        request.body;
      const userId = request.authUser?.id;

      if (!userId) {
        return sendUnauthorized(reply, "Authentication required");
      }

      try {
        const prisma = await getPrisma();

        // The model and document fed to the pipeline must belong to this org.
        const docModelId = documentId
          ? (
              await prisma.document.findUnique({
                where: { id: documentId },
                select: { threatModelId: true },
              })
            )?.threatModelId
          : undefined;
        for (const modelId of [threatModelId, docModelId]) {
          if (!modelId) continue;
          const access = await checkThreatModelAccess(userId, modelId);
          if (!access.hasAccess || access.organizationId !== orgId) {
            return sendNotFound(reply, "Threat model");
          }
        }
        if (documentId && !docModelId) {
          return sendNotFound(reply, "Document");
        }

        // Get AI settings from organization
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { aiSettings: true },
        });

        if (!org?.aiSettings) {
          return sendBadRequest(
            reply,
            "AI not configured for this organization",
          );
        }

        const aiSettings = JSON.parse(org.aiSettings);
        const aiService = new AIService(aiSettings, orgId);

        const result = await executePipeline(
          {
            pipelineId,
            userId,
            organizationId: orgId,
            threatModelId,
            inputDocument,
            documentId,
            inputMetadata,
          },
          aiService,
        );

        return {
          execution: {
            id: result.executionId,
            status: result.status,
            outputs: result.outputs,
            finalResult: result.finalResult,
            totalDurationMs: result.totalDurationMs,
            totalTokensUsed: result.totalTokensUsed,
            stageResults: result.stageResults,
            error: result.error,
          },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Execution failed";
        return sendInternalError(reply, message);
      }
    },
  );

  /**
   * GET /api/organizations/:orgId/pipelines/:pipelineId/executions
   * Get execution history for a pipeline
   */
  fastify.get<{
    Params: { orgId: string; pipelineId: string };
    Querystring: { limit?: string; offset?: string };
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId/executions",
    ORG_VIEWER,
    async (request) => {
      const { orgId, pipelineId } = request.params;
      const limit = parseInt(request.query.limit || "20", 10);
      const offset = parseInt(request.query.offset || "0", 10);

      const { executions, total } = await getExecutionHistory(pipelineId, {
        organizationId: orgId,
        limit,
        offset,
      });

      return {
        executions: executions.map((e) => ({
          id: e.id,
          status: e.status,
          totalDurationMs: e.totalDurationMs,
          totalTokensUsed: e.totalTokensUsed,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
          errorMessage: e.errorMessage,
        })),
        total,
        limit,
        offset,
      };
    },
  );

  /**
   * GET /api/organizations/:orgId/pipeline-executions/:executionId
   * Get execution details with stage results
   */
  fastify.get<{
    Params: { orgId: string; executionId: string };
  }>(
    "/api/organizations/:orgId/pipeline-executions/:executionId",
    ORG_VIEWER,
    async (request, reply) => {
      const { executionId } = request.params;
      const result = await getExecutionStatus(executionId);

      if (!result) {
        return sendNotFound(reply, "Execution");
      }

      return {
        execution: {
          id: result.execution.id,
          pipelineId: result.execution.pipelineId,
          status: result.execution.status,
          currentStageId: result.execution.currentStageId,
          outputs: JSON.parse(result.execution.outputs || "{}"),
          finalResult: result.execution.finalResult
            ? JSON.parse(result.execution.finalResult)
            : null,
          totalDurationMs: result.execution.totalDurationMs,
          totalTokensUsed: result.execution.totalTokensUsed,
          errorMessage: result.execution.errorMessage,
          errorStageId: result.execution.errorStageId,
          startedAt: result.execution.startedAt,
          completedAt: result.execution.completedAt,
        },
        stages: result.stageExecutions.map((s) => ({
          id: s.id,
          stageId: s.stageId,
          order: s.order,
          status: s.status,
          input: s.input ? JSON.parse(s.input) : null,
          output: s.output,
          outputParsed: s.outputParsed ? JSON.parse(s.outputParsed) : null,
          durationMs: s.durationMs,
          tokensUsed: s.tokensUsed,
          retryAttempts: s.retryAttempts,
          errorMessage: s.errorMessage,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        })),
      };
    },
  );
};
