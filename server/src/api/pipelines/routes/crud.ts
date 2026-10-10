/**
 * Pipelines API - Pipeline CRUD Routes
 *
 * List, get, create, update, delete pipelines.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  getPipelineById,
  getPipelines,
  clearPipelineCache,
  sendNotFound,
  sendForbidden,
  type PipelineStageInput,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });
const AUTHENTICATED = routeAuthz("authenticated");

export const crudRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/organizations/:orgId/pipelines
   * List all pipelines (built-in + org-specific)
   */
  fastify.get<{
    Params: { orgId: string };
  }>("/api/organizations/:orgId/pipelines", ORG_VIEWER, async (request) => {
    const { orgId } = request.params;
    const pipelines = await getPipelines(orgId);

    return {
      pipelines: pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        isSequential: p.isSequential,
        stopOnError: p.stopOnError,
        timeout: p.timeout,
        stageCount: p.stages.length,
        tags: JSON.parse(p.tags || "[]"),
        isBuiltIn: p.isBuiltIn,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  });

  /**
   * GET /api/organizations/:orgId/pipelines/:pipelineId
   * Get pipeline details with stages
   */
  fastify.get<{
    Params: { orgId: string; pipelineId: string };
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId",
    ORG_VIEWER,
    async (request, reply) => {
      const { pipelineId } = request.params;
      const pipeline = await getPipelineById(pipelineId);

      if (!pipeline) {
        return sendNotFound(reply, "Pipeline");
      }

      return {
        pipeline: {
          ...pipeline,
          tags: JSON.parse(pipeline.tags || "[]"),
          stages: pipeline.stages.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            order: s.order,
            promptTemplateId: s.promptTemplateId,
            inputMapping: JSON.parse(s.inputMapping || "{}"),
            outputFields: JSON.parse(s.outputFields || "[]"),
            dependsOn: JSON.parse(s.dependsOn || "[]"),
            optional: s.optional,
            retryCount: s.retryCount,
            timeoutMs: s.timeoutMs,
            condition: s.condition ? JSON.parse(s.condition) : null,
          })),
        },
      };
    },
  );

  /**
   * POST /api/organizations/:orgId/pipelines
   * Create a new pipeline
   */
  fastify.post<{
    Params: { orgId: string };
    Body: {
      name: string;
      description?: string;
      isSequential?: boolean;
      stopOnError?: boolean;
      timeout?: number;
      tags?: string[];
      stages?: PipelineStageInput[];
    };
  }>("/api/organizations/:orgId/pipelines", ORG_ADMIN, async (request) => {
    const { orgId } = request.params;
    const {
      name,
      description,
      isSequential,
      stopOnError,
      timeout,
      tags,
      stages,
    } = request.body;
    const userId = request.authUser?.id;

    const prisma = await getPrisma();

    const pipeline = await prisma.promptPipeline.create({
      data: {
        name,
        description,
        isSequential: isSequential ?? true,
        stopOnError: stopOnError ?? true,
        timeout: timeout ?? 300000,
        tags: JSON.stringify(tags || []),
        organizationId: orgId,
        createdBy: userId,
        stages: stages
          ? {
              create: stages.map((s) => ({
                name: s.name,
                description: s.description,
                order: s.order,
                promptTemplateId: s.promptTemplateId,
                inputMapping: JSON.stringify(s.inputMapping || {}),
                outputFields: JSON.stringify(s.outputFields || []),
                dependsOn: JSON.stringify(s.dependsOn || []),
                optional: s.optional ?? false,
                retryCount: s.retryCount ?? 0,
                timeoutMs: s.timeoutMs,
                condition: s.condition ? JSON.stringify(s.condition) : null,
              })),
            }
          : undefined,
      },
      include: { stages: true },
    });

    clearPipelineCache();

    return { pipeline };
  });

  /**
   * PUT /api/organizations/:orgId/pipelines/:pipelineId
   * Update a pipeline
   */
  fastify.patch<{
    Params: { orgId: string; pipelineId: string };
    Body: {
      name?: string;
      description?: string;
      isSequential?: boolean;
      stopOnError?: boolean;
      timeout?: number;
      tags?: string[];
      isActive?: boolean;
    };
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId",
    ORG_ADMIN,
    async (request, reply) => {
      const { pipelineId } = request.params;
      const {
        name,
        description,
        isSequential,
        stopOnError,
        timeout,
        tags,
        isActive,
      } = request.body;

      const prisma = await getPrisma();

      // Check if exists and not built-in
      const existing = await prisma.promptPipeline.findUnique({
        where: { id: pipelineId },
      });

      if (!existing) {
        return sendNotFound(reply, "Pipeline");
      }

      if (existing.isBuiltIn) {
        return sendForbidden(reply, "Cannot modify built-in pipeline");
      }

      const pipeline = await prisma.promptPipeline.update({
        where: { id: pipelineId },
        data: {
          name,
          description,
          isSequential,
          stopOnError,
          timeout,
          tags: tags ? JSON.stringify(tags) : undefined,
          isActive,
        },
        include: { stages: true },
      });

      clearPipelineCache();

      return { pipeline };
    },
  );

  /**
   * DELETE /api/organizations/:orgId/pipelines/:pipelineId
   * Delete a pipeline
   */
  fastify.delete<{
    Params: { orgId: string; pipelineId: string };
  }>(
    "/api/organizations/:orgId/pipelines/:pipelineId",
    ORG_ADMIN,
    async (request, reply) => {
      const { pipelineId } = request.params;

      const prisma = await getPrisma();

      const existing = await prisma.promptPipeline.findUnique({
        where: { id: pipelineId },
      });

      if (!existing) {
        return sendNotFound(reply, "Pipeline");
      }

      if (existing.isBuiltIn) {
        return sendForbidden(reply, "Cannot delete built-in pipeline");
      }

      await prisma.promptPipeline.delete({
        where: { id: pipelineId },
      });

      clearPipelineCache();

      return { success: true };
    },
  );

  /**
   * GET /api/pipelines/builtin
   * Get built-in pipelines (no auth required for discovery)
   */
  fastify.get("/api/pipelines/builtin", AUTHENTICATED, async () => {
    const prisma = await getPrisma();

    const pipelines = await prisma.promptPipeline.findMany({
      where: { isBuiltIn: true, isActive: true },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    return {
      pipelines: pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        stageCount: p.stages.length,
        tags: JSON.parse(p.tags || "[]"),
      })),
    };
  });
};
