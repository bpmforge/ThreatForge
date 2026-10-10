/**
 * JIRA Integration - Status & Webhook Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import { getAuthUser, checkOrganizationAccess } from "../../../helpers.js";
import type { JiraConfig, JiraCredentials } from "../schemas.js";
import { jiraRequest } from "../helpers.js";
import { JIRA_INTEGRATION, loadIntegration } from "../../route-helpers.js";
import {
  sendBadRequest,
  sendForbidden,
} from "../../../../../utils/api-response.js";

export const statusRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /status/:issueKey - Get JIRA issue status
   */
  server.get<{ Params: { orgId: string; issueKey: string } }>(
    "/status/:issueKey",
    {
      schema: { tags: ["JIRA Integration"], summary: "Get JIRA issue status" },
      config: { authz: { org: "VIEWER" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, issueKey } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) return sendForbidden(reply, "Access denied");

      const loaded = await loadIntegration<JiraConfig, JiraCredentials>(
        prisma,
        reply,
        orgId,
        JIRA_INTEGRATION,
        { activeOnly: true },
      );
      if (loaded.denied) return loaded.denied;
      const { config, credentials } = loaded;

      const result = await jiraRequest(
        config,
        credentials,
        "GET",
        `/issue/${issueKey}?fields=status,resolution,assignee,updated,priority`,
      );

      if (!result.ok)
        return sendBadRequest(reply, result.error ?? "Unknown error");

      const issueData = result.data as {
        key: string;
        fields: {
          status: {
            name: string;
            statusCategory: { key: string; name: string };
          };
          resolution: { name: string } | null;
          assignee: { displayName: string; emailAddress: string } | null;
          updated: string;
          priority: { name: string } | null;
        };
      };

      return {
        issueKey: issueData.key,
        status: issueData.fields.status.name,
        statusCategory: issueData.fields.status.statusCategory.name,
        resolution: issueData.fields.resolution?.name ?? null,
        assignee: issueData.fields.assignee?.displayName ?? null,
        assigneeEmail: issueData.fields.assignee?.emailAddress ?? null,
        priority: issueData.fields.priority?.name ?? null,
        updatedAt: issueData.fields.updated,
        url: `${config.baseUrl}/browse/${issueKey}`,
      };
    },
  );
};
