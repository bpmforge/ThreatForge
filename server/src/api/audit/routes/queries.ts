/**
 * Audit API - Query Routes
 *
 * GET endpoints: list logs, stats, export, AI usage.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  queryAuditLogs,
  getOrganizationAIUsage,
} from "../../../services/audit.js";
import {
  checkOrganizationAccess,
  checkThreatModelAccess,
} from "../../../services/access-control/access-control-service.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendUnauthorized,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });
const MODEL_VIEW = routeAuthz({ model: "view" });

// Query schemas
const AuditLogQuerySchema = z.object({
  action: z
    .enum([
      "CREATE",
      "UPDATE",
      "DELETE",
      "VIEW",
      "EXPORT",
      "SHARE",
      "LOGIN",
      "LOGOUT",
      "INVITE",
      "ACCEPT_INVITE",
      "DECLINE_INVITE",
      "SUSPEND",
      "UNSUSPEND",
      "IMPERSONATE",
      "OWNERSHIP_TRANSFER",
    ])
    .optional(),
  resourceType: z
    .enum([
      "THREAT_MODEL",
      "PROJECT",
      "ORGANIZATION",
      "THREAT",
      "MITIGATION",
      "USER",
      "SYSTEM_SETTINGS",
      "DFD",
      "SEQUENCE_DIAGRAM",
      "THREAT_LIBRARY",
      "COMPONENT_TEMPLATE",
    ])
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const queryRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/organizations/:organizationId/audit
   * Get audit logs for an organization.
   * Requires OWNER or ADMIN role.
   */
  server.get<{
    Params: { organizationId: string };
    Querystring: z.infer<typeof AuditLogQuerySchema>;
  }>(
    "/api/organizations/:organizationId/audit",
    {
      ...ORG_ADMIN,
      schema: {
        description: "Get audit logs for an organization",
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
            action: { type: "string" },
            resourceType: { type: "string" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            limit: { type: "number", minimum: 1, maximum: 100 },
            offset: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Querystring: z.infer<typeof AuditLogQuerySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply, "Unauthorized");
      }

      const { organizationId } = request.params;

      // Check access - must be OWNER or ADMIN
      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access.hasAccess) {
        return sendNotFound(reply, "Organization");
      }

      if (!access.permissions.includes("manage")) {
        return sendForbidden(
          reply,
          "Only owners and admins can view audit logs",
        );
      }

      // Parse and validate query params
      const queryResult = AuditLogQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        return sendBadRequest(reply, "Invalid query parameters");
      }

      const { action, resourceType, startDate, endDate, limit, offset } =
        queryResult.data;

      const result = await queryAuditLogs({
        organizationId,
        action,
        resourceType,
        startDate,
        endDate,
        limit,
        offset,
      });

      return sendSuccess(reply, {
        logs: result.logs.map((log) => ({
          id: log.id,
          scope: log.scope,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          resourceName: log.resourceName,
          changes: log.changes,
          metadata: log.metadata,
          userId: log.userId,
          userEmail: log.userEmail,
          createdAt: log.createdAt.toISOString(),
        })),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  /**
   * GET /api/threat-models/:threatModelId/audit
   * Get audit logs for a specific threat model.
   * Any member with access can view.
   */
  server.get<{
    Params: { threatModelId: string };
    Querystring: z.infer<typeof AuditLogQuerySchema>;
  }>(
    "/api/threat-models/:threatModelId/audit",
    {
      ...MODEL_VIEW,
      schema: {
        description: "Get audit logs for a threat model",
        tags: ["Audit"],
        params: {
          type: "object",
          properties: {
            threatModelId: { type: "string" },
          },
          required: ["threatModelId"],
        },
        querystring: {
          type: "object",
          properties: {
            action: { type: "string" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            limit: { type: "number", minimum: 1, maximum: 100 },
            offset: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { threatModelId: string };
        Querystring: z.infer<typeof AuditLogQuerySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply, "Unauthorized");
      }

      const { threatModelId } = request.params;

      // Check access to threat model
      const access = await checkThreatModelAccess(user.id, threatModelId);
      if (!access.hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      // Parse query params
      const queryResult = AuditLogQuerySchema.safeParse(request.query);
      const { action, startDate, endDate, limit, offset } = queryResult.success
        ? queryResult.data
        : { limit: 50, offset: 0 };

      const result = await queryAuditLogs({
        modelId: threatModelId,
        scope: "MODEL",
        action,
        startDate,
        endDate,
        limit,
        offset,
      });

      return sendSuccess(reply, {
        logs: result.logs.map((log) => ({
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          resourceName: log.resourceName,
          changes: log.changes,
          metadata: log.metadata,
          userId: log.userId,
          userEmail: log.userEmail,
          createdAt: log.createdAt.toISOString(),
        })),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  );

  /**
   * GET /api/organizations/:organizationId/ai-usage
   * Get AI usage summary for an organization.
   * Requires OWNER or ADMIN role.
   */
  server.get<{
    Params: { organizationId: string };
    Querystring: { startDate?: string; endDate?: string };
  }>(
    "/api/organizations/:organizationId/ai-usage",
    {
      ...ORG_ADMIN,
      schema: {
        description: "Get AI usage summary for an organization",
        tags: ["Audit", "AI"],
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
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Querystring: { startDate?: string; endDate?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply, "Unauthorized");
      }

      const { organizationId } = request.params;
      const { startDate, endDate } = request.query;

      // Check access - must be OWNER or ADMIN
      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access.hasAccess) {
        return sendNotFound(reply, "Organization");
      }

      if (!access.permissions.includes("manage")) {
        return sendForbidden(reply, "Only owners and admins can view AI usage");
      }

      const result = await getOrganizationAIUsage(
        organizationId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      );

      return sendSuccess(reply, result);
    },
  );

  /**
   * GET /api/organizations/:organizationId/audit/stats
   * Get audit log statistics for dashboard.
   */
  server.get<{
    Params: { organizationId: string };
    Querystring: { days?: number };
  }>(
    "/api/organizations/:organizationId/audit/stats",
    {
      ...ORG_ADMIN,
      schema: {
        description: "Get audit log statistics",
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
            days: { type: "number", default: 30 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Querystring: { days?: number };
      }>,
      reply: FastifyReply,
    ) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply, "Unauthorized");
      }

      const { organizationId } = request.params;
      const days = request.query.days || 30;

      // Check access
      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access.hasAccess) {
        return sendNotFound(reply, "Organization");
      }

      if (!access.permissions.includes("manage")) {
        return sendForbidden(
          reply,
          "Only owners and admins can view audit stats",
        );
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await queryAuditLogs({
        organizationId,
        startDate,
        limit: 1000,
      });

      return sendSuccess(reply, result);
    },
  );
};
