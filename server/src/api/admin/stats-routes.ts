/**
 * Admin Stats & Health Routes
 *
 * Dashboard statistics and system health checks.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../db.js";
import { getAuthUser, isSuperAdmin } from "./utils.js";
import { sendSuccess, sendForbidden } from "../../utils/api-response.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

const SUPER_ADMIN = routeAuthz("superAdmin");

export const statsRoutes: FastifyPluginAsync = async (server) => {
  /** Get admin dashboard stats */
  server.get("/api/admin/stats", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const prisma = await getPrisma();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalOrganizations,
      totalProjects,
      totalThreatModels,
      totalThreats,
      activeUsersLast7Days,
      activeUsersToday,
      usersThisMonth,
      projectsThisMonth,
      threatModelsThisMonth,
      modelsCreatedLast7Days,
      threatsIdentifiedLast7Days,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.project.count(),
      prisma.threatModel.count(),
      prisma.threat.count(),
      prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.project.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.threatModel.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.threatModel.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.threat.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ]);

    return sendSuccess(reply, {
      totalUsers,
      totalOrganizations,
      totalProjects,
      totalThreatModels,
      totalThreats,
      activeUsersLast7Days,
      activeUsersToday,
      usersThisMonth,
      projectsThisMonth,
      threatModelsThisMonth,
      modelsCreatedLast7Days,
      threatsIdentifiedLast7Days,
    });
  });

  /** Get system health */
  server.get("/api/admin/health", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const prisma = await getPrisma();
    const startTime = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - startTime;

      return sendSuccess(reply, {
        status: latencyMs < 1000 ? "healthy" : "degraded",
        database: {
          connected: true,
          latencyMs,
        },
        uptime: process.uptime(),
        version: process.env.npm_package_version || "0.1.0",
        lastChecked: new Date().toISOString(),
      });
    } catch {
      return sendSuccess(reply, {
        status: "unhealthy",
        database: {
          connected: false,
          latencyMs: -1,
        },
        uptime: process.uptime(),
        version: process.env.npm_package_version || "0.1.0",
        lastChecked: new Date().toISOString(),
      });
    }
  });
};
