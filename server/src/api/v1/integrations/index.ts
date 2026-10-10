/**
 * Integrations API (v1)
 *
 * Third-party integration management (JIRA, GitHub, Slack, etc.)
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import { getAuthUser, checkOrganizationAccess, logAudit } from "../helpers.js";
import {
  encryptValue,
  decryptValue,
} from "../../../services/encryption/encryption-service.js";
import { jiraRoutes } from "./jira.js";
import { githubRoutes } from "./github.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendConflict,
  sendNoContent,
  sendInternalError,
} from "../../../utils/api-response.js";

const IntegrationTypeEnum = z.enum([
  "JIRA",
  "GITHUB_ISSUES",
  "AZURE_DEVOPS",
  "LINEAR",
  "ASANA",
  "SLACK",
  "TEAMS",
  "CUSTOM_WEBHOOK",
]);

const CreateIntegrationSchema = z.object({
  type: IntegrationTypeEnum,
  name: z.string().min(1).max(200),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

/** Config keys that hold credentials. projectKey/owner/repo/baseUrl are not matched. */
const CREDENTIAL_KEY =
  /token|secret|password|passwd|credential|private|webhook|signing|api[_-]?key/i;

/** Copy of a stored config without credential-shaped keys, at any depth. */
function redactCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCredentials);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !CREDENTIAL_KEY.test(key))
      .map(([key, v]) => [key, redactCredentials(v)]),
  );
}

export const integrationRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  // Register provider-specific routes
  await server.register(jiraRoutes, { prefix: "/:orgId/integrations/jira" });
  await server.register(githubRoutes, {
    prefix: "/:orgId/integrations/github",
  });

  /**
   * GET /:orgId/integrations
   * List all integrations for an organization
   */
  server.get<{ Params: { orgId: string } }>(
    "/:orgId/integrations",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Integrations"],
        summary: "List integrations",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply);
      }

      const integrations = await prisma.integration.findMany({
        where: { organizationId: orgId },
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { mappings: true, syncLogs: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return sendSuccess(
        reply,
        integrations.map((i) => ({
          id: i.id,
          type: i.type,
          name: i.name,
          status: i.status,
          lastSyncedAt: i.lastSyncedAt?.toISOString() ?? null,
          lastSyncStatus: i.lastSyncStatus,
          syncErrors: i.syncErrors,
          mappingCount: i._count.mappings,
          syncLogCount: i._count.syncLogs,
          createdBy: i.createdBy,
          createdAt: i.createdAt.toISOString(),
        })),
      );
    },
  );

  /**
   * POST /:orgId/integrations
   * Create a new integration (initial setup)
   */
  server.post<{
    Params: { orgId: string };
    Body: z.infer<typeof CreateIntegrationSchema>;
  }>(
    "/:orgId/integrations",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        tags: ["Integrations"],
        summary: "Create integration",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;
      const body = CreateIntegrationSchema.parse(request.body);

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      // Check if integration type already exists for org
      const existing = await prisma.integration.findFirst({
        where: { organizationId: orgId, type: body.type },
      });
      if (existing) {
        return sendConflict(
          reply,
          `${body.type} integration already exists for this organization`,
        );
      }

      const encryptedConfig = encryptValue(JSON.stringify(body.config));
      if (!encryptedConfig) {
        return sendInternalError(reply, "Failed to encrypt configuration");
      }

      const integration = await prisma.integration.create({
        data: {
          organizationId: orgId,
          type: body.type,
          name: body.name,
          status: "INACTIVE",
          config: encryptedConfig,
          createdById: user.id,
        },
      });

      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "ORGANIZATION",
        resourceId: integration.id,
        resourceName: integration.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "integration", integrationType: body.type },
      });

      return sendCreated(reply, {
        id: integration.id,
        type: integration.type,
        name: integration.name,
        status: integration.status,
        createdAt: integration.createdAt.toISOString(),
      });
    },
  );

  /**
   * GET /:orgId/integrations/:integrationId
   * Get integration details
   */
  server.get<{ Params: { orgId: string; integrationId: string } }>(
    "/:orgId/integrations/:integrationId",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Integrations"],
        summary: "Get integration details",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, integrationId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply);
      }

      const integration = await prisma.integration.findFirst({
        where: { id: integrationId, organizationId: orgId },
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { mappings: true } },
        },
      });

      if (!integration) {
        return sendNotFound(reply, "Integration");
      }

      // Decrypt config (but don't return credentials)
      const decryptedConfig = decryptValue(integration.config);
      const config = redactCredentials(
        decryptedConfig ? JSON.parse(decryptedConfig) : {},
      );

      return sendSuccess(reply, {
        id: integration.id,
        type: integration.type,
        name: integration.name,
        status: integration.status,
        config,
        scopes: JSON.parse(integration.scopes),
        lastSyncedAt: integration.lastSyncedAt?.toISOString() ?? null,
        lastSyncStatus: integration.lastSyncStatus,
        syncErrors: integration.syncErrors,
        consecutiveFailures: integration.consecutiveFailures,
        mappingCount: integration._count.mappings,
        createdBy: integration.createdBy,
        createdAt: integration.createdAt.toISOString(),
        updatedAt: integration.updatedAt.toISOString(),
      });
    },
  );

  /**
   * DELETE /:orgId/integrations/:integrationId
   * Delete an integration
   */
  server.delete<{ Params: { orgId: string; integrationId: string } }>(
    "/:orgId/integrations/:integrationId",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        tags: ["Integrations"],
        summary: "Delete integration",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, integrationId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const integration = await prisma.integration.findFirst({
        where: { id: integrationId, organizationId: orgId },
      });
      if (!integration) {
        return sendNotFound(reply, "Integration");
      }

      // Delete all mappings and sync logs (cascade should handle this)
      await prisma.integration.delete({ where: { id: integrationId } });

      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "ORGANIZATION",
        resourceId: integrationId,
        resourceName: integration.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "integration", integrationType: integration.type },
      });

      return sendNoContent(reply);
    },
  );

  /**
   * GET /:orgId/integrations/:integrationId/mappings
   * List all entity mappings for an integration
   */
  server.get<{
    Params: { orgId: string; integrationId: string };
    Querystring: { localType?: string; limit?: string; offset?: string };
  }>(
    "/:orgId/integrations/:integrationId/mappings",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Integrations"],
        summary: "List integration mappings",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, integrationId } = request.params;
      const { localType, limit = "50", offset = "0" } = request.query;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply);
      }

      const integration = await prisma.integration.findFirst({
        where: { id: integrationId, organizationId: orgId },
        select: { id: true },
      });
      if (!integration) {
        return sendNotFound(reply, "Integration");
      }

      const where: Record<string, unknown> = { integrationId };
      if (localType) {
        where.localType = localType;
      }

      const [mappings, total] = await Promise.all([
        prisma.integrationMapping.findMany({
          where,
          take: parseInt(limit),
          skip: parseInt(offset),
          orderBy: { createdAt: "desc" },
        }),
        prisma.integrationMapping.count({ where }),
      ]);

      return sendSuccess(reply, {
        data: mappings.map((m) => ({
          id: m.id,
          localType: m.localType,
          localId: m.localId,
          externalType: m.externalType,
          externalId: m.externalId,
          externalUrl: m.externalUrl,
          externalKey: m.externalKey,
          syncDirection: m.syncDirection,
          lastSyncedAt: m.lastSyncedAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
        pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
      });
    },
  );

  /**
   * GET /:orgId/integrations/:integrationId/sync-logs
   * Get sync history for an integration
   */
  server.get<{
    Params: { orgId: string; integrationId: string };
    Querystring: { limit?: string };
  }>(
    "/:orgId/integrations/:integrationId/sync-logs",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Integrations"],
        summary: "Get sync logs",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, integrationId } = request.params;
      const { limit = "20" } = request.query;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply);
      }

      const integration = await prisma.integration.findFirst({
        where: { id: integrationId, organizationId: orgId },
        select: { id: true },
      });
      if (!integration) {
        return sendNotFound(reply, "Integration");
      }

      const logs = await prisma.integrationSyncLog.findMany({
        where: { integrationId },
        take: parseInt(limit),
        orderBy: { startedAt: "desc" },
      });

      return sendSuccess(
        reply,
        logs.map((l) => ({
          id: l.id,
          direction: l.direction,
          status: l.status,
          itemsSynced: l.itemsSynced,
          itemsFailed: l.itemsFailed,
          errorMessage: l.errorMessage,
          startedAt: l.startedAt.toISOString(),
          completedAt: l.completedAt?.toISOString() ?? null,
          durationMs: l.completedAt
            ? l.completedAt.getTime() - l.startedAt.getTime()
            : null,
        })),
      );
    },
  );

  /**
   * GET /:orgId/integrations/available
   * List available integration types
   */
  server.get<{ Params: { orgId: string } }>(
    "/:orgId/integrations/available",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Integrations"],
        summary: "List available integration types",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply);
      }

      // Get existing integrations
      const existing = await prisma.integration.findMany({
        where: { organizationId: orgId },
        select: { type: true, status: true },
      });
      const existingMap = new Map<string, string>(
        existing.map((e) => [e.type, e.status]),
      );

      const integrationTypes = [
        {
          type: "JIRA",
          name: "Jira",
          description: "Sync threats and mitigations with Jira issues",
          icon: "jira",
          features: [
            "Create issues from threats",
            "Bidirectional status sync",
            "Custom field mapping",
          ],
          authType: "oauth2",
        },
        {
          type: "GITHUB_ISSUES",
          name: "GitHub Issues",
          description: "Create GitHub issues from threats",
          icon: "github",
          features: ["Create issues", "Link to PRs", "Label mapping"],
          authType: "oauth2",
        },
        {
          type: "SLACK",
          name: "Slack",
          description: "Send notifications to Slack channels",
          icon: "slack",
          features: ["Threat notifications", "Status updates", "Daily digests"],
          authType: "oauth2",
        },
        {
          type: "CUSTOM_WEBHOOK",
          name: "Custom Webhook",
          description: "Send events to any HTTP endpoint",
          icon: "webhook",
          features: ["Custom payloads", "Event filtering", "Retry logic"],
          authType: "api_key",
        },
      ];

      return sendSuccess(
        reply,
        integrationTypes.map((t) => ({
          ...t,
          status: existingMap.get(t.type) ?? null,
          isConfigured: existingMap.has(t.type),
        })),
      );
    },
  );
};
