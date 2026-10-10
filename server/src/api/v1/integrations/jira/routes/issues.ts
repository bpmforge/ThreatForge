/**
 * JIRA Integration - Issue Creation Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  canUseOrgCredentials,
} from "../../../helpers.js";
import { routeAuthz } from "../../../../../middleware/authz-policy.js";
import {
  CreateIssueSchema,
  type JiraConfig,
  type JiraCredentials,
} from "../schemas.js";
import { jiraRequest } from "../helpers.js";
import {
  JIRA_INTEGRATION,
  loadIntegration,
  recordFailedPush,
  recordPushedIssue,
  resolveIssueTarget,
} from "../../route-helpers.js";
import {
  sendCreated,
  sendBadRequest,
  sendForbidden,
} from "../../../../../utils/api-response.js";

export const issueRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /issues - Create a JIRA issue
   */
  server.post<{ Params: { orgId: string }; Body: unknown }>(
    "/issues",
    {
      ...routeAuthz({ org: "EDITOR" }),
      schema: { tags: ["JIRA Integration"], summary: "Create JIRA issue" },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;
      const body = CreateIssueSchema.parse(request.body);

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!canUseOrgCredentials(access)) {
        return sendForbidden(reply, "Editor role or higher required");
      }

      const loaded = await loadIntegration<JiraConfig, JiraCredentials>(
        prisma,
        reply,
        orgId,
        JIRA_INTEGRATION,
        { activeOnly: true },
      );
      if (loaded.denied) return loaded.denied;
      const { integration, config, credentials } = loaded;

      // Build issue fields
      const fields: Record<string, unknown> = {
        project: { key: config.projectKey },
        summary: body.summary,
        issuetype: { id: body.issueType || config.issueTypeIdThreat },
      };

      if (body.description) {
        fields.description = {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: body.description }],
            },
          ],
        };
      }

      if (body.priority && config.priorityMapping) {
        const priorityId = config.priorityMapping[body.priority];
        if (priorityId) fields.priority = { id: priorityId };
      }

      if (body.labels) fields.labels = body.labels;
      if (body.customFields) Object.assign(fields, body.customFields);

      const result = await jiraRequest(config, credentials, "POST", "/issue", {
        fields,
      });

      if (!result.ok) {
        await recordFailedPush(prisma, integration.id, result.error);
        return sendBadRequest(reply, "Failed to create JIRA issue", {
          details: result.error,
        });
      }

      const issueData = result.data as {
        id: string;
        key: string;
        self: string;
      };

      await recordPushedIssue(prisma, integration.id, {
        ...resolveIssueTarget(body),
        externalId: issueData.id,
        externalKey: issueData.key,
        externalUrl: `${config.baseUrl}/browse/${issueData.key}`,
        syncDirection: config.syncDirection || "PUSH_ONLY",
      });

      return sendCreated(reply, {
        id: issueData.id,
        key: issueData.key,
        url: `${config.baseUrl}/browse/${issueData.key}`,
        message: "JIRA issue created successfully",
      });
    },
  );
};
