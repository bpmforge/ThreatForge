/**
 * JIRA Integration - Configuration Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  logAudit,
} from "../../../helpers.js";
import {
  JiraConfigSchema,
  JiraCredentialsSchema,
  type JiraConfig,
  type JiraCredentials,
} from "../schemas.js";
import { jiraRequest } from "../helpers.js";
import {
  JIRA_INTEGRATION,
  loadIntegration,
  recordConnectionTest,
  saveIntegration,
} from "../../route-helpers.js";
import {
  sendBadRequest,
  sendForbidden,
} from "../../../../../utils/api-response.js";

export const configurationRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /configure - Configure JIRA integration
   */
  server.post<{
    Params: { orgId: string };
    Body: JiraConfig & { credentials: JiraCredentials };
  }>(
    "/configure",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        tags: ["JIRA Integration"],
        summary: "Configure JIRA integration",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;
      const { credentials, ...config } = request.body;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const validatedConfig = JiraConfigSchema.parse(config);
      const validatedCredentials = JiraCredentialsSchema.parse(credentials);

      // Test connection
      const testResult = await jiraRequest(
        validatedConfig,
        validatedCredentials,
        "GET",
        "/myself",
      );
      if (!testResult.ok) {
        return sendBadRequest(reply, "Failed to connect to JIRA", {
          details: testResult.error,
        });
      }

      // Encrypt and store
      const saved = await saveIntegration(prisma, reply, {
        orgId,
        userId: user.id,
        type: "JIRA",
        name: `JIRA - ${validatedConfig.projectKey}`,
        config: validatedConfig,
        credentials: validatedCredentials,
      });
      if (saved.denied) return saved.denied;
      const { integration } = saved;

      await logAudit({
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "ORGANIZATION",
        resourceId: integration.id,
        resourceName: integration.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "jira_integration", action: "configure" },
      });

      return {
        id: integration.id,
        status: integration.status,
        projectKey: validatedConfig.projectKey,
        message: "JIRA integration configured successfully",
      };
    },
  );

  /**
   * POST /test - Test JIRA connection
   */
  server.post<{ Params: { orgId: string } }>(
    "/test",
    {
      config: { authz: { org: "VIEWER" } },
      schema: { tags: ["JIRA Integration"], summary: "Test JIRA connection" },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply, "Access denied");
      }

      const loaded = await loadIntegration<JiraConfig, JiraCredentials>(
        prisma,
        reply,
        orgId,
        JIRA_INTEGRATION,
      );
      if (loaded.denied) return loaded.denied;
      const { integration, config, credentials } = loaded;

      const result = await jiraRequest(config, credentials, "GET", "/myself");

      await recordConnectionTest(prisma, integration.id, result);

      if (result.ok) {
        // Identity only: the full /myself body (email, groups, self links)
        // is not something the caller needs back.
        const me = (result.data ?? {}) as {
          accountId?: string;
          displayName?: string;
        };
        return {
          success: true,
          user: { accountId: me.accountId, displayName: me.displayName },
          message: "Connection successful",
        };
      } else {
        return sendBadRequest(reply, result.error ?? "Unknown error");
      }
    },
  );
};
