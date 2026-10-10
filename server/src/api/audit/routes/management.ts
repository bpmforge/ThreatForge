/**
 * Audit API - Management Routes
 *
 * Export audit logs for compliance (CSV/JSON).
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { queryAuditLogs } from "../../../services/audit.js";
import { checkOrganizationAccess } from "../../../services/access-control/access-control-service.js";
import {
  sendNotFound,
  sendForbidden,
  sendUnauthorized,
} from "../../../utils/api-response.js";

export const managementRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/organizations/:organizationId/audit/export
   * Export audit logs for compliance (CSV or JSON).
   * Requires OWNER role for export.
   */
  server.get<{
    Params: { organizationId: string };
    Querystring: {
      format?: "csv" | "json";
      startDate?: string;
      endDate?: string;
      action?: string;
      resourceType?: string;
    };
  }>(
    "/api/organizations/:organizationId/audit/export",
    {
      config: { authz: { org: "OWNER" } },
      schema: {
        description: "Export audit logs for compliance",
        tags: ["Audit"],
        params: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
          },
          required: ["organizationId"],
        },
        querystring: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["csv", "json"] },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            action: { type: "string" },
            resourceType: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Querystring: {
          format?: "csv" | "json";
          startDate?: string;
          endDate?: string;
          action?: string;
          resourceType?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply, "Unauthorized");
      }

      const { organizationId } = request.params;
      const {
        format = "json",
        startDate,
        endDate,
        action,
        resourceType,
      } = request.query;

      // Check access - must be OWNER for export (compliance requirement)
      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access.hasAccess) {
        return sendNotFound(reply, "Organization");
      }

      if (access.role !== "OWNER") {
        return sendForbidden(
          reply,
          "Only organization owners can export audit logs",
        );
      }

      // Fetch all logs matching criteria (no pagination for export)
      const result = await queryAuditLogs({
        organizationId,
        action: action as
          | "CREATE"
          | "UPDATE"
          | "DELETE"
          | "VIEW"
          | "EXPORT"
          | "SHARE"
          | "LOGIN"
          | "LOGOUT"
          | "INVITE"
          | "ACCEPT_INVITE"
          | "DECLINE_INVITE"
          | "SUSPEND"
          | "UNSUSPEND"
          | "IMPERSONATE"
          | "OWNERSHIP_TRANSFER"
          | undefined,
        resourceType: resourceType as
          | "THREAT_MODEL"
          | "PROJECT"
          | "ORGANIZATION"
          | "THREAT"
          | "MITIGATION"
          | "USER"
          | "SYSTEM_SETTINGS"
          | "DFD"
          | "SEQUENCE_DIAGRAM"
          | "THREAT_LIBRARY"
          | "COMPONENT_TEMPLATE"
          | undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: 10000, // Max export limit
        offset: 0,
      });

      // Log the export action itself
      const { logAudit } = await import("../../../services/audit.js");
      await logAudit({
        scope: "ORGANIZATION",
        action: "EXPORT",
        resourceType: "ORGANIZATION",
        resourceId: organizationId,
        resourceName: "Audit Logs",
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId,
        metadata: {
          format,
          recordCount: result.total,
          startDate,
          endDate,
        },
      });

      if (format === "csv") {
        // Generate CSV
        const headers = [
          "Timestamp",
          "Action",
          "Resource Type",
          "Resource ID",
          "Resource Name",
          "User Email",
          "Changes",
          "IP Address",
        ];

        const rows = result.logs.map((log) => {
          const metadata =
            typeof log.metadata === "string"
              ? JSON.parse(log.metadata || "{}")
              : log.metadata || {};
          const changes =
            typeof log.changes === "string"
              ? log.changes
              : JSON.stringify(log.changes || {});
          return [
            log.createdAt.toISOString(),
            log.action,
            log.resourceType,
            log.resourceId,
            log.resourceName || "",
            log.userEmail,
            changes.replace(/"/g, '""'), // Escape quotes for CSV
            metadata.ip || "",
          ];
        });

        const csvContent = [
          headers.join(","),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        const filename = `audit-logs-${organizationId}-${new Date().toISOString().split("T")[0]}.csv`;

        return reply
          .header("Content-Type", "text/csv")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(csvContent);
      }

      // JSON format
      const jsonData = {
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        organizationId,
        filters: {
          startDate,
          endDate,
          action,
          resourceType,
        },
        totalRecords: result.total,
        logs: result.logs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt.toISOString(),
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          resourceName: log.resourceName,
          userEmail: log.userEmail,
          userId: log.userId,
          changes:
            typeof log.changes === "string"
              ? JSON.parse(log.changes || "{}")
              : log.changes,
          metadata:
            typeof log.metadata === "string"
              ? JSON.parse(log.metadata || "{}")
              : log.metadata,
        })),
      };

      const filename = `audit-logs-${organizationId}-${new Date().toISOString().split("T")[0]}.json`;

      return reply
        .header("Content-Type", "application/json")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(JSON.stringify(jsonData, null, 2));
    },
  );
};
