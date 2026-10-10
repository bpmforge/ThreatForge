/**
 * Usage & Quotas API
 *
 * Endpoints for viewing organization usage and quota information.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { getPrisma } from "../db.js";
import { checkOrganizationAccess } from "../services/access-control/access-control-service.js";
import { sendSuccess, sendNotFound } from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });

/**
 * Shared preamble for the usage endpoints: require an authenticated member of
 * the organization and load it with its member/project counts. Sends the
 * error response and returns null when any step fails.
 */
async function loadOrgForUsage(
  request: FastifyRequest<{ Params: { organizationId: string } }>,
  reply: FastifyReply,
) {
  const user = getAuthUser(request);

  const { organizationId } = request.params;

  // Check access (any member can view usage)
  const access = await checkOrganizationAccess(user.id, organizationId);
  if (!access.hasAccess) {
    sendNotFound(reply, "Organization");
    return null;
  }

  const prisma = await getPrisma();

  // Fetch organization with counts
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: {
        select: {
          memberships: true,
          projects: true,
        },
      },
    },
  });

  if (!org) {
    sendNotFound(reply, "Organization");
    return null;
  }

  return { prisma, org };
}

export const usageRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/organizations/:organizationId/usage
   * Get organization usage statistics and quota information
   */
  server.get<{ Params: { organizationId: string } }>(
    "/api/organizations/:organizationId/usage",
    {
      schema: {
        description: "Get organization usage and quota information",
        tags: ["Organizations"],
        params: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
          },
          required: ["organizationId"],
        },
      },
      config: { authz: { org: "VIEWER" } },
    },
    async (
      request: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const loaded = await loadOrgForUsage(request, reply);
      if (!loaded) return reply;
      const { prisma, org } = loaded;
      const { organizationId } = request.params;

      // Count total threat models across all projects
      const modelCount = await prisma.threatModel.count({
        where: {
          project: {
            organizationId,
          },
        },
      });

      // Get AI usage across all providers for this org
      const aiProviders = await prisma.aIProvider.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          type: true,
          totalRequests: true,
          totalTokens: true,
          totalInputTokens: true,
          totalOutputTokens: true,
          estimatedCost: true,
          usageResetAt: true,
        },
      });

      // Aggregate AI usage
      const aiUsage = aiProviders.reduce(
        (acc, provider) => ({
          totalRequests: acc.totalRequests + provider.totalRequests,
          totalTokens: acc.totalTokens + provider.totalTokens,
          totalInputTokens: acc.totalInputTokens + provider.totalInputTokens,
          totalOutputTokens: acc.totalOutputTokens + provider.totalOutputTokens,
          estimatedCost: acc.estimatedCost + provider.estimatedCost,
        }),
        {
          totalRequests: 0,
          totalTokens: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
        },
      );

      // Calculate usage percentages
      const memberUsage = org.maxMembers
        ? {
            current: org._count.memberships,
            limit: org.maxMembers,
            percentage: Math.round(
              (org._count.memberships / org.maxMembers) * 100,
            ),
          }
        : {
            current: org._count.memberships,
            limit: null,
            percentage: null,
          };

      const projectUsage = org.maxProjects
        ? {
            current: org._count.projects,
            limit: org.maxProjects,
            percentage: Math.round(
              (org._count.projects / org.maxProjects) * 100,
            ),
          }
        : {
            current: org._count.projects,
            limit: null,
            percentage: null,
          };

      return sendSuccess(reply, {
        organization: {
          id: org.id,
          name: org.name,
          plan: org.type, // Use org type as plan
        },
        quotas: {
          members: memberUsage,
          projects: projectUsage,
          modelsPerProject: org.maxModelsPerProject,
        },
        usage: {
          totalMembers: org._count.memberships,
          totalProjects: org._count.projects,
          totalModels: modelCount,
        },
        ai: {
          providers: aiProviders.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            requests: p.totalRequests,
            tokens: p.totalTokens,
            inputTokens: p.totalInputTokens,
            outputTokens: p.totalOutputTokens,
            estimatedCost: p.estimatedCost,
            resetAt: p.usageResetAt,
          })),
          totals: {
            requests: aiUsage.totalRequests,
            tokens: aiUsage.totalTokens,
            inputTokens: aiUsage.totalInputTokens,
            outputTokens: aiUsage.totalOutputTokens,
            estimatedCost: aiUsage.estimatedCost,
          },
        },
      });
    },
  );

  /**
   * GET /api/organizations/:organizationId/usage/summary
   * Get a compact usage summary (for sidebar/header display)
   */
  server.get<{ Params: { organizationId: string } }>(
    "/api/organizations/:organizationId/usage/summary",
    ORG_VIEWER,
    async (
      request: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const loaded = await loadOrgForUsage(request, reply);
      if (!loaded) return reply;
      const { org } = loaded;

      // Check if any limits are approaching (>80%)
      const warnings: string[] = [];

      if (org.maxMembers) {
        const memberPercentage =
          (org._count.memberships / org.maxMembers) * 100;
        if (memberPercentage >= 80) {
          warnings.push(
            memberPercentage >= 100
              ? "Member limit reached"
              : `${Math.round(memberPercentage)}% of member limit used`,
          );
        }
      }

      if (org.maxProjects) {
        const projectPercentage = (org._count.projects / org.maxProjects) * 100;
        if (projectPercentage >= 80) {
          warnings.push(
            projectPercentage >= 100
              ? "Project limit reached"
              : `${Math.round(projectPercentage)}% of project limit used`,
          );
        }
      }

      return sendSuccess(reply, {
        plan: org.type,
        members: {
          current: org._count.memberships,
          limit: org.maxMembers,
        },
        projects: {
          current: org._count.projects,
          limit: org.maxProjects,
        },
        warnings,
      });
    },
  );
};
