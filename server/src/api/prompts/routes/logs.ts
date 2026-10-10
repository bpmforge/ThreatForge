/**
 * AI Prompts API - Execution Logs Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, hasOrgAdminAccess } from "../helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const logRoutes: FastifyPluginAsync = async (server) => {
  /** Get execution logs for an organization */
  server.get<{
    Params: { orgId: string };
    Querystring: {
      promptId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    "/api/organizations/:orgId/prompt-logs",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { promptId, status, limit = 50, offset = 0 } = request.query;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const where: Record<string, unknown> = { organizationId: orgId };
      if (promptId) where.promptTemplateId = promptId;
      if (status) where.status = status;

      const [logs, total] = await Promise.all([
        prisma.promptExecutionLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: Math.min(limit, 100),
          skip: offset,
          select: {
            id: true,
            promptTemplateId: true,
            promptTemplateName: true,
            documentTypeName: true,
            userId: true,
            status: true,
            tokensUsed: true,
            durationMs: true,
            model: true,
            provider: true,
            errorMessage: true,
            createdAt: true,
            completedAt: true,
          },
        }),
        prisma.promptExecutionLog.count({ where }),
      ]);

      return sendSuccess(reply, { logs, total, limit, offset });
    },
  );

  /** Get execution log details */
  server.get<{ Params: { orgId: string; logId: string } }>(
    "/api/organizations/:orgId/prompt-logs/:logId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, logId } = request.params;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const log = await prisma.promptExecutionLog.findFirst({
        where: { id: logId, organizationId: orgId },
      });

      if (!log) return sendNotFound(reply, "Log");
      return sendSuccess(reply, { log });
    },
  );

  /** Get prompt execution statistics */
  server.get<{ Params: { orgId: string }; Querystring: { days?: number } }>(
    "/api/organizations/:orgId/prompt-stats",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { days = 30 } = request.query;

      if (!(await hasOrgAdminAccess(authUser.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [
        totalExecutions,
        completedExecutions,
        failedExecutions,
        tokenStats,
      ] = await Promise.all([
        prisma.promptExecutionLog.count({
          where: { organizationId: orgId, createdAt: { gte: since } },
        }),
        prisma.promptExecutionLog.count({
          where: {
            organizationId: orgId,
            status: "COMPLETED",
            createdAt: { gte: since },
          },
        }),
        prisma.promptExecutionLog.count({
          where: {
            organizationId: orgId,
            status: "FAILED",
            createdAt: { gte: since },
          },
        }),
        prisma.promptExecutionLog.aggregate({
          where: {
            organizationId: orgId,
            status: "COMPLETED",
            createdAt: { gte: since },
          },
          _sum: { tokensUsed: true },
          _avg: { durationMs: true, tokensUsed: true },
        }),
      ]);

      const usageByPrompt = await prisma.promptExecutionLog.groupBy({
        by: ["promptTemplateId", "promptTemplateName"],
        where: { organizationId: orgId, createdAt: { gte: since } },
        _count: true,
      });

      return sendSuccess(reply, {
        stats: {
          totalExecutions,
          completedExecutions,
          failedExecutions,
          successRate:
            totalExecutions > 0
              ? Math.round((completedExecutions / totalExecutions) * 100)
              : 0,
          totalTokensUsed: tokenStats._sum.tokensUsed || 0,
          avgDurationMs: Math.round(tokenStats._avg.durationMs || 0),
          avgTokensPerExecution: Math.round(tokenStats._avg.tokensUsed || 0),
        },
        usageByPrompt: usageByPrompt.map((u) => ({
          promptId: u.promptTemplateId,
          promptName: u.promptTemplateName,
          count: u._count,
        })),
        days,
      });
    },
  );
};
