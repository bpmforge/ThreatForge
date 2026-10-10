/**
 * Pipeline API - Modular Entry Point
 *
 * AI prompt pipeline CRUD, stage management, and execution.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import type { MemberRole } from "@prisma/client";
import { requireOrgRole } from "../../services/access-control/access-control-service.js";
import {
  getAuthUser,
  getPrisma,
  sendForbidden,
  sendNotFound,
} from "./helpers.js";
import { crudRoutes } from "./routes/crud.js";
import { stageRoutes } from "./routes/stages.js";
import { executionRoutes } from "./routes/execution.js";

type PipelineParams = {
  orgId?: string;
  pipelineId?: string;
  stageId?: string;
  executionId?: string;
};

/** Reading needs membership, running needs EDITOR, changing pipelines needs ADMIN. */
function minimumRole(method: string, routeUrl: string | undefined): MemberRole {
  if (method === "GET") return "VIEWER";
  if (routeUrl?.endsWith("/execute")) return "EDITOR";
  return "ADMIN";
}

export const pipelineRoutes: FastifyPluginAsync = async (fastify) => {
  // Every org-scoped pipeline route: the caller must hold the role for :orgId,
  // and each id in the URL must belong to that org (built-in pipelines are
  // shared and readable/runnable by every org). Registered before the route
  // plugins so it covers all of them.
  fastify.addHook("preHandler", async (request, reply) => {
    const { orgId, pipelineId, stageId, executionId } =
      request.params as PipelineParams;
    if (!orgId) return;

    const role = await requireOrgRole(
      getAuthUser(request).id,
      orgId,
      minimumRole(request.method, request.routeOptions.url),
    );
    if (!role.allowed) {
      return sendForbidden(reply, role.error ?? "Forbidden");
    }

    const prisma = await getPrisma();
    if (pipelineId) {
      const pipeline = await prisma.promptPipeline.findUnique({
        where: { id: pipelineId },
        select: { organizationId: true, isBuiltIn: true },
      });
      if (
        !pipeline ||
        (!pipeline.isBuiltIn && pipeline.organizationId !== orgId)
      ) {
        return sendNotFound(reply, "Pipeline");
      }
    }
    if (stageId) {
      const stage = await prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: { pipelineId: true },
      });
      if (!stage || stage.pipelineId !== pipelineId) {
        return sendNotFound(reply, "Stage");
      }
    }
    if (executionId) {
      const execution = await prisma.pipelineExecution.findUnique({
        where: { id: executionId },
        select: { organizationId: true },
      });
      if (!execution || execution.organizationId !== orgId) {
        return sendNotFound(reply, "Execution");
      }
    }
  });

  await fastify.register(crudRoutes);
  await fastify.register(stageRoutes);
  await fastify.register(executionRoutes);
};

// Re-export helpers
export * from "./helpers.js";
