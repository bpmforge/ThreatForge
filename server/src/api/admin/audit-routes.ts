/**
 * Admin Audit Routes
 *
 * Audit log viewing, export, and purge.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../db.js";
import type { AuditAction, ResourceType } from "@prisma/client";
import { queryAuditLogs, purgeOldAuditLogs } from "../../services/audit.js";
import { getAuthUser, isSuperAdmin } from "./utils.js";
import { sendSuccess, sendForbidden } from "../../utils/api-response.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

const SUPER_ADMIN = routeAuthz("superAdmin");

export const auditRoutes: FastifyPluginAsync = async (server) => {
  /** Get audit logs with filtering */
  server.get<{
    Querystring: {
      resourceType?: ResourceType;
      action?: AuditAction;
      userId?: string;
      organizationId?: string;
      resourceId?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };
  }>("/api/admin/audit", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const {
      page = "1",
      limit = "50",
      startDate,
      endDate,
      ...filters
    } = request.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await queryAuditLogs({
      ...filters,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit),
      offset,
    });

    return sendSuccess(reply, {
      entries: result.logs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        resourceName: log.resourceName,
        changes: log.changes,
        metadata: log.metadata,
        userId: log.userId,
        userEmail: log.userEmail,
        organizationId: log.organizationId,
        createdAt: log.createdAt.toISOString(),
      })),
      total: result.total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  });

  /** Export audit log */
  server.get<{
    Querystring: {
      format?: "csv" | "json";
      resourceType?: ResourceType;
      action?: AuditAction;
      userId?: string;
      organizationId?: string;
      startDate?: string;
      endDate?: string;
    };
  }>("/api/admin/audit/export", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const { format = "json", startDate, endDate, ...filters } = request.query;

    const result = await queryAuditLogs({
      ...filters,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: 10000,
    });

    if (format === "csv") {
      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", "attachment; filename=audit-log.csv");

      const header =
        "timestamp,action,resourceType,resourceId,resourceName,userId,userEmail,changes\n";
      const rows = result.logs
        .map(
          (log) =>
            `${log.createdAt.toISOString()},${log.action},${log.resourceType},${log.resourceId},"${log.resourceName || ""}",${log.userId},"${log.userEmail}","${JSON.stringify(log.changes || {}).replace(/"/g, '""')}"`,
        )
        .join("\n");

      return header + rows;
    }

    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", "attachment; filename=audit-log.json");
    return {
      exportedAt: new Date().toISOString(),
      totalEntries: result.total,
      entries: result.logs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        resourceName: log.resourceName,
        changes: log.changes,
        metadata: log.metadata,
        userId: log.userId,
        userEmail: log.userEmail,
        organizationId: log.organizationId,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  });

  /** Purge old audit logs */
  server.post("/api/admin/audit/purge", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const prisma = await getPrisma();
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });
    const retentionDays = settings?.auditRetentionDays || 90;

    const deletedCount = await purgeOldAuditLogs(retentionDays);

    return sendSuccess(reply, {
      success: true,
      deletedCount,
      retentionDays,
    });
  });
};
