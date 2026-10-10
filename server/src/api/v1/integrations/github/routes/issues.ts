/**
 * GitHub Integration - Issue Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  canUseOrgCredentials,
} from "../../../helpers.js";
import {
  CreateIssueSchema,
  type GitHubConfig,
  type GitHubCredentials,
} from "../schemas.js";
import { githubRequest } from "../helpers.js";
import {
  GITHUB_INTEGRATION,
  decryptIntegration,
  findOrgThreat,
  loadIntegration,
  recordFailedPush,
  recordPushedIssue,
  resolveIssueTarget,
} from "../../route-helpers.js";
import {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendConflict,
} from "../../../../../utils/api-response.js";
import { routeAuthz } from "../../../../../middleware/authz-policy.js";

const ORG_EDITOR = routeAuthz({ org: "EDITOR" });

export const issueRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /** POST /issues - Create a GitHub issue */
  server.post<{
    Params: { orgId: string };
    Body: z.infer<typeof CreateIssueSchema>;
  }>("/issues", ORG_EDITOR, async (request, reply) => {
    const user = getAuthUser(request);
    const { orgId } = request.params;
    const body = CreateIssueSchema.parse(request.body);

    const access = await checkOrganizationAccess(user.id, orgId);
    if (!canUseOrgCredentials(access))
      return sendForbidden(reply, "Editor role or higher required");

    const loaded = await loadIntegration<GitHubConfig, GitHubCredentials>(
      prisma,
      reply,
      orgId,
      GITHUB_INTEGRATION,
      { activeOnly: true },
    );
    if (loaded.denied) return loaded.denied;
    const { integration, config, credentials } = loaded;

    const labels = [...(config.defaultLabels || []), ...(body.labels || [])];
    const issuePayload = {
      title: body.title,
      body: body.body || "",
      labels,
      assignees: body.assignees,
      milestone: body.milestone,
    };

    const result = await githubRequest(
      config,
      credentials,
      "POST",
      `/repos/${config.owner}/${config.repo}/issues`,
      issuePayload,
    );

    if (!result.ok) {
      await recordFailedPush(prisma, integration.id, result.error);
      return sendBadRequest(reply, "Failed to create GitHub issue", {
        details: result.error,
      });
    }

    const issueData = result.data as {
      number: number;
      id: number;
      html_url: string;
    };

    await recordPushedIssue(prisma, integration.id, {
      ...resolveIssueTarget(body),
      externalId: String(issueData.id),
      externalKey: `#${issueData.number}`,
      externalUrl: issueData.html_url,
      syncDirection: config.syncDirection || "PUSH_ONLY",
    });

    return sendCreated(reply, {
      number: issueData.number,
      url: issueData.html_url,
      message: "GitHub issue created successfully",
    });
  });

  /** POST /sync/threat/:threatId - Sync a threat to GitHub */
  server.post<{ Params: { orgId: string; threatId: string } }>(
    "/sync/threat/:threatId",
    ORG_EDITOR,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, threatId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!canUseOrgCredentials(access))
        return sendForbidden(reply, "Editor role or higher required");

      const threat = await findOrgThreat(prisma, threatId, orgId);
      if (!threat) return sendNotFound(reply, "Threat");

      const integration = await prisma.integration.findFirst({
        where: {
          organizationId: orgId,
          type: "GITHUB_ISSUES",
          status: "ACTIVE",
        },
      });
      if (!integration) return sendNotFound(reply, "GitHub integration");

      const existingMapping = await prisma.integrationMapping.findFirst({
        where: {
          integrationId: integration.id,
          localType: "threat",
          localId: threatId,
        },
      });
      if (existingMapping) {
        return sendConflict(reply, "Threat already synced to GitHub", {
          issueNumber: existingMapping.externalKey,
          issueUrl: existingMapping.externalUrl,
        });
      }

      const decrypted = decryptIntegration<GitHubConfig, GitHubCredentials>(
        reply,
        integration,
      );
      if (decrypted.denied) return decrypted.denied;
      const { config, credentials } = decrypted;

      const strideCategories = JSON.parse(threat.strideCategories) as string[];
      const labels = [
        ...(config.defaultLabels || []),
        ...strideCategories.map(
          (s) => `${config.threatLabelPrefix}${s.toLowerCase()}`,
        ),
        `severity:${threat.severity.toLowerCase()}`,
      ];

      const body = `## Threat Details\n\n**Model:** ${threat.threatModel.name}\n**Project:** ${threat.threatModel.project.name}\n**STRIDE:** ${strideCategories.join(", ")}\n**Severity:** ${threat.severity}\n**Status:** ${threat.status}\n\n### Description\n${threat.description || "_No description provided_"}\n\n---\n_Created from ThreatForge_`;

      const result = await githubRequest(
        config,
        credentials,
        "POST",
        `/repos/${config.owner}/${config.repo}/issues`,
        {
          title: `[Threat] ${threat.name}`,
          body,
          labels,
        },
      );

      if (!result.ok) {
        return sendBadRequest(reply, "Failed to create GitHub issue", {
          details: result.error,
        });
      }

      const issueData = result.data as {
        number: number;
        id: number;
        html_url: string;
      };

      await prisma.integrationMapping.create({
        data: {
          integrationId: integration.id,
          localType: "threat",
          localId: threatId,
          externalType: "issue",
          externalId: String(issueData.id),
          externalKey: `#${issueData.number}`,
          externalUrl: issueData.html_url,
          syncDirection: "BIDIRECTIONAL",
          lastSyncedAt: new Date(),
          metadata: JSON.stringify({
            threatName: threat.name,
            severity: threat.severity,
          }),
        },
      });

      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date(), lastSyncStatus: "Success" },
      });

      return {
        success: true,
        issueNumber: issueData.number,
        issueUrl: issueData.html_url,
        message: "Threat synced to GitHub successfully",
      };
    },
  );
};
