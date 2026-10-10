/**
 * Reporting Dashboards Handlers
 *
 * Organization, project, and trend dashboard endpoints.
 */

import type { FastifyReply, FastifyRequest, FastifySchema } from "fastify";
import {
  getOrganizationDashboard,
  getProjectDashboard,
} from "../services/reporting/index.js";
import type { ReportPeriod } from "../services/reporting/types.js";
import { getPrisma } from "../db.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
} from "../utils/api-response.js";

const VALID_PERIODS: ReportPeriod[] = ["7d", "30d", "90d", "1y", "all"];

export const organizationDashboardSchema: FastifySchema = {
  description: "Get organization dashboard",
  tags: ["Reporting"],
  params: {
    type: "object",
    properties: {
      orgId: { type: "string", description: "Organization ID" },
    },
    required: ["orgId"],
  },
  querystring: {
    type: "object",
    properties: {
      period: {
        type: "string",
        description: "Report period (7d, 30d, 90d, 1y, all)",
      },
    },
  },
};

export async function getOrganizationDashboardHandler(
  request: FastifyRequest<{
    Params: { orgId: string };
    Querystring: { period?: string };
  }>,
  reply: FastifyReply,
) {
  const { orgId } = request.params;
  const { period = "30d" } = request.query;
  const user = request.authUser!;

  // Validate period
  if (!VALID_PERIODS.includes(period as ReportPeriod)) {
    return sendBadRequest(
      reply,
      `Invalid period. Valid values: ${VALID_PERIODS.join(", ")}`,
    );
  }

  // Verify user has access to this organization
  const prisma = await getPrisma();
  const membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      organizationId: orgId,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    return sendForbidden(reply, "Access denied to this organization");
  }

  try {
    const dashboard = await getOrganizationDashboard(
      orgId,
      period as ReportPeriod,
    );
    return sendSuccess(reply, dashboard);
  } catch (error) {
    request.log.error(
      { error, orgId },
      "Failed to generate organization dashboard",
    );
    throw error;
  }
}

export const projectDashboardSchema: FastifySchema = {
  description: "Get project dashboard",
  tags: ["Reporting"],
  params: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project ID" },
    },
    required: ["projectId"],
  },
  querystring: {
    type: "object",
    properties: {
      period: { type: "string" },
    },
  },
};

export async function getProjectDashboardHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Querystring: { period?: string };
  }>,
  reply: FastifyReply,
) {
  const { projectId } = request.params;
  const { period = "30d" } = request.query;
  const user = request.authUser!;

  if (!VALID_PERIODS.includes(period as ReportPeriod)) {
    return sendBadRequest(reply, "Invalid period");
  }

  // Verify access
  const prisma = await getPrisma();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      organization: {
        include: {
          memberships: {
            where: { userId: user.id, status: "ACTIVE" },
          },
        },
      },
    },
  });

  if (!project) {
    return sendNotFound(reply, "Project");
  }

  if (project.organization.memberships.length === 0) {
    return sendForbidden(reply, "Access denied");
  }

  const dashboard = await getProjectDashboard(
    projectId,
    period as ReportPeriod,
  );
  return sendSuccess(reply, dashboard);
}

export const trendsSchema: FastifySchema = {
  description: "Get trend data for charts",
  tags: ["Reporting"],
  params: {
    type: "object",
    properties: {
      orgId: { type: "string" },
    },
    required: ["orgId"],
  },
  querystring: {
    type: "object",
    properties: {
      period: { type: "string" },
    },
  },
};

export async function getTrendsHandler(
  request: FastifyRequest<{
    Params: { orgId: string };
    Querystring: { period?: string };
  }>,
  reply: FastifyReply,
) {
  const { orgId } = request.params;
  const { period = "30d" } = request.query;
  const user = request.authUser!;

  if (!VALID_PERIODS.includes(period as ReportPeriod)) {
    return sendBadRequest(reply, "Invalid period");
  }

  // Verify access
  const prisma = await getPrisma();
  const membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      organizationId: orgId,
      status: "ACTIVE",
    },
  });

  if (!membership) {
    return sendForbidden(reply, "Access denied");
  }

  const dashboard = await getOrganizationDashboard(
    orgId,
    period as ReportPeriod,
  );

  return sendSuccess(reply, {
    period,
    trends: dashboard.trends,
    riskDistribution: dashboard.riskDistribution,
    threatStatus: dashboard.threatStatus,
    mitigationStatus: dashboard.mitigationStatus,
  });
}
