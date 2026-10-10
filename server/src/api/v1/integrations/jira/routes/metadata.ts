/**
 * JIRA Integration - Metadata Routes (Projects, Issue Types)
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

export const metadataRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /projects - List JIRA projects
   */
  server.get<{ Params: { orgId: string } }>(
    "/projects",
    {
      schema: { tags: ["JIRA Integration"], summary: "List JIRA projects" },
      config: { authz: { org: "VIEWER" } },
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
      const { config, credentials } = loaded;

      const result = await jiraRequest(
        config,
        credentials,
        "GET",
        "/project/search",
      );

      if (!result.ok) {
        return sendBadRequest(reply, result.error ?? "Unknown error");
      }

      const data = result.data as {
        values: Array<{ id: string; key: string; name: string }>;
      };
      return {
        data: data.values.map((p) => ({ id: p.id, key: p.key, name: p.name })),
      };
    },
  );

  /**
   * GET /issue-types - List issue types for configured project
   */
  server.get<{ Params: { orgId: string } }>(
    "/issue-types",
    {
      schema: { tags: ["JIRA Integration"], summary: "List JIRA issue types" },
      config: { authz: { org: "VIEWER" } },
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
      const { config, credentials } = loaded;

      const result = await jiraRequest(
        config,
        credentials,
        "GET",
        `/project/${config.projectKey}`,
      );

      if (!result.ok) {
        return sendBadRequest(reply, result.error ?? "Unknown error");
      }

      const data = result.data as {
        issueTypes: Array<{ id: string; name: string; subtask: boolean }>;
      };
      return {
        data: data.issueTypes
          .filter((t) => !t.subtask)
          .map((t) => ({ id: t.id, name: t.name })),
      };
    },
  );
};
