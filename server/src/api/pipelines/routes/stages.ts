/**
 * Pipelines API - Stage Management Routes
 *
 * Add, update, delete pipeline stages.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  clearPipelineCache,
  loadMutablePipeline,
  type PipelineStageInput,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const stageRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/organizations/:orgId/pipelines/:pipelineId/stages
   * Add a stage to a pipeline
   */
  fastify.post<{
    Params: { orgId: string; pipelineId: string };
    Body: PipelineStageInput;
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId/stages",
    ORG_ADMIN,
    async (request, reply) => {
      const { pipelineId } = request.params;
      const body = request.body;

      if (!(await loadMutablePipeline(reply, pipelineId))) return reply;

      const prisma = await getPrisma();

      const stage = await prisma.pipelineStage.create({
        data: {
          pipelineId,
          name: body.name,
          description: body.description,
          order: body.order,
          promptTemplateId: body.promptTemplateId,
          inputMapping: JSON.stringify(body.inputMapping || {}),
          outputFields: JSON.stringify(body.outputFields || []),
          dependsOn: JSON.stringify(body.dependsOn || []),
          optional: body.optional ?? false,
          retryCount: body.retryCount ?? 0,
          timeoutMs: body.timeoutMs,
          condition: body.condition ? JSON.stringify(body.condition) : null,
        },
      });

      clearPipelineCache();

      return { stage };
    },
  );

  /**
   * PUT /api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId
   * Update a stage
   */
  fastify.patch<{
    Params: { orgId: string; pipelineId: string; stageId: string };
    Body: {
      name?: string;
      description?: string;
      order?: number;
      promptTemplateId?: string;
      inputMapping?: Record<string, { source: string; field: string }>;
      outputFields?: string[];
      dependsOn?: string[];
      optional?: boolean;
      retryCount?: number;
      timeoutMs?: number | null;
      condition?: {
        field: string;
        equals?: string;
        contains?: string;
        exists?: boolean;
      } | null;
    };
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId",
    ORG_ADMIN,
    async (request, reply) => {
      const { pipelineId, stageId } = request.params;
      const body = request.body;

      if (!(await loadMutablePipeline(reply, pipelineId))) return reply;

      const prisma = await getPrisma();

      const stage = await prisma.pipelineStage.update({
        where: { id: stageId },
        data: {
          name: body.name,
          description: body.description,
          order: body.order,
          promptTemplateId: body.promptTemplateId,
          inputMapping:
            body.inputMapping !== undefined
              ? JSON.stringify(body.inputMapping)
              : undefined,
          outputFields:
            body.outputFields !== undefined
              ? JSON.stringify(body.outputFields)
              : undefined,
          dependsOn:
            body.dependsOn !== undefined
              ? JSON.stringify(body.dependsOn)
              : undefined,
          optional: body.optional,
          retryCount: body.retryCount,
          timeoutMs: body.timeoutMs,
          condition:
            body.condition !== undefined
              ? body.condition
                ? JSON.stringify(body.condition)
                : null
              : undefined,
        },
      });

      clearPipelineCache();

      return { stage };
    },
  );

  /**
   * DELETE /api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId
   * Delete a stage
   */
  fastify.delete<{
    Params: { orgId: string; pipelineId: string; stageId: string };
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId/stages/:stageId",
    ORG_ADMIN,
    async (request, reply) => {
      const { pipelineId, stageId } = request.params;

      if (!(await loadMutablePipeline(reply, pipelineId))) return reply;

      const prisma = await getPrisma();

      await prisma.pipelineStage.delete({
        where: { id: stageId },
      });

      clearPipelineCache();

      return { success: true };
    },
  );
};
