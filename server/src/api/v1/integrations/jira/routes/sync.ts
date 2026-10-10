/**
 * JIRA Integration - Sync Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  canUseOrgCredentials,
} from "../../../helpers.js";
import type { JiraConfig, JiraCredentials } from "../schemas.js";
import { jiraRequest } from "../helpers.js";
import {
  JIRA_INTEGRATION,
  applyMappingStatus,
  decryptIntegration,
  findOrgThreat,
  finishBidirectionalSync,
  loadIntegration,
  startBidirectionalSync,
  type MitigationStatusType,
  type ThreatStatusType,
} from "../../route-helpers.js";
import {
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendConflict,
} from "../../../../../utils/api-response.js";

export const syncRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /sync/threat/:threatId - Sync threat to JIRA
   */
  server.post<{ Params: { orgId: string; threatId: string } }>(
    "/sync/threat/:threatId",
    {
      schema: { tags: ["JIRA Integration"], summary: "Sync threat to JIRA" },
      config: { authz: { org: "EDITOR" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, threatId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!canUseOrgCredentials(access))
        return sendForbidden(reply, "Editor role or higher required");

      const threat = await findOrgThreat(prisma, threatId, orgId);
      if (!threat) return sendNotFound(reply, "Threat");

      const integration = await prisma.integration.findFirst({
        where: { organizationId: orgId, type: "JIRA", status: "ACTIVE" },
      });

      if (!integration) return sendNotFound(reply, "JIRA integration");

      const existingMapping = await prisma.integrationMapping.findFirst({
        where: {
          integrationId: integration.id,
          localType: "threat",
          localId: threatId,
        },
      });

      if (existingMapping) {
        return sendConflict(reply, "Threat already synced to JIRA", {
          issueKey: existingMapping.externalKey,
          issueUrl: existingMapping.externalUrl,
        });
      }

      const decrypted = decryptIntegration<JiraConfig, JiraCredentials>(
        reply,
        integration,
      );
      if (decrypted.denied) return decrypted.denied;
      const { config, credentials } = decrypted;

      const strideCategories = JSON.parse(threat.strideCategories) as string[];
      const description = `*Threat Model:* ${threat.threatModel.name}\n*Project:* ${threat.threatModel.project.name}\n*STRIDE Categories:* ${strideCategories.join(", ")}\n*Severity:* ${threat.severity}\n*Status:* ${threat.status}\n\nh3. Description\n${threat.description || "No description provided"}`;

      const fields: Record<string, unknown> = {
        project: { key: config.projectKey },
        summary: `[Threat] ${threat.name}`,
        issuetype: { id: config.issueTypeIdThreat || "10001" },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description }],
            },
          ],
        },
        labels: [
          "threat-model",
          "security",
          ...strideCategories.map((s) => s.toLowerCase()),
        ],
      };

      if (config.priorityMapping) {
        const priorityId = config.priorityMapping[threat.severity];
        if (priorityId) fields.priority = { id: priorityId };
      }

      const result = await jiraRequest(config, credentials, "POST", "/issue", {
        fields,
      });

      if (!result.ok) {
        await prisma.integrationSyncLog.create({
          data: {
            integrationId: integration.id,
            direction: "PUSH_ONLY",
            status: "FAILED",
            itemsFailed: 1,
            errorMessage: result.error,
            details: JSON.stringify({ threatId, threatName: threat.name }),
          },
        });
        return sendBadRequest(reply, "Failed to create JIRA issue", {
          details: result.error,
        });
      }

      const issueData = result.data as { id: string; key: string };

      await prisma.integrationMapping.create({
        data: {
          integrationId: integration.id,
          localType: "threat",
          localId: threatId,
          externalType: "issue",
          externalId: issueData.id,
          externalKey: issueData.key,
          externalUrl: `${config.baseUrl}/browse/${issueData.key}`,
          syncDirection: "BIDIRECTIONAL",
          lastSyncedAt: new Date(),
          metadata: JSON.stringify({
            threatName: threat.name,
            severity: threat.severity,
          }),
        },
      });

      await prisma.integrationSyncLog.create({
        data: {
          integrationId: integration.id,
          direction: "PUSH_ONLY",
          status: "COMPLETED",
          itemsSynced: 1,
          completedAt: new Date(),
          details: JSON.stringify({ threatId, issueKey: issueData.key }),
        },
      });

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncedAt: new Date(),
          lastSyncStatus: "Success",
          consecutiveFailures: 0,
        },
      });

      return {
        success: true,
        issueKey: issueData.key,
        issueUrl: `${config.baseUrl}/browse/${issueData.key}`,
        message: "Threat synced to JIRA successfully",
      };
    },
  );

  /**
   * POST /sync/mitigation/:mitigationId - Sync mitigation to JIRA
   */
  server.post<{ Params: { orgId: string; mitigationId: string } }>(
    "/sync/mitigation/:mitigationId",
    {
      schema: {
        tags: ["JIRA Integration"],
        summary: "Sync mitigation to JIRA",
      },
      config: { authz: { org: "EDITOR" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, mitigationId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!canUseOrgCredentials(access))
        return sendForbidden(reply, "Editor role or higher required");

      const mitigation = await prisma.mitigation.findUnique({
        where: { id: mitigationId },
        include: {
          threat: {
            include: {
              threatModel: {
                include: { project: { select: { organizationId: true } } },
              },
            },
          },
        },
      });

      if (
        !mitigation ||
        mitigation.threat.threatModel.project.organizationId !== orgId
      ) {
        return sendNotFound(reply, "Mitigation");
      }

      const integration = await prisma.integration.findFirst({
        where: { organizationId: orgId, type: "JIRA", status: "ACTIVE" },
      });

      if (!integration) return sendNotFound(reply, "JIRA integration");

      const existingMapping = await prisma.integrationMapping.findFirst({
        where: {
          integrationId: integration.id,
          localType: "mitigation",
          localId: mitigationId,
        },
      });

      if (existingMapping) {
        return sendConflict(reply, "Mitigation already synced to JIRA", {
          issueKey: existingMapping.externalKey,
          issueUrl: existingMapping.externalUrl,
        });
      }

      const decrypted = decryptIntegration<JiraConfig, JiraCredentials>(
        reply,
        integration,
      );
      if (decrypted.denied) return decrypted.denied;
      const { config, credentials } = decrypted;

      const threatMapping = await prisma.integrationMapping.findFirst({
        where: {
          integrationId: integration.id,
          localType: "threat",
          localId: mitigation.threatId,
        },
      });

      const description = `*Parent Threat:* ${mitigation.threat.name}${threatMapping ? ` (${threatMapping.externalKey})` : ""}\n*Strategy:* ${mitigation.strategy}\n*Priority:* ${mitigation.priority}\n*Status:* ${mitigation.status}\n\nh3. Mitigation\n${mitigation.description}\n${mitigation.notes ? `\nh3. Notes\n${mitigation.notes}` : ""}`;

      const fields: Record<string, unknown> = {
        project: { key: config.projectKey },
        summary: `[Mitigation] ${mitigation.description.substring(0, 100)}${mitigation.description.length > 100 ? "..." : ""}`,
        issuetype: {
          id:
            config.issueTypeIdMitigation || config.issueTypeIdThreat || "10001",
        },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description }],
            },
          ],
        },
        labels: [
          "threat-model",
          "mitigation",
          mitigation.strategy.toLowerCase(),
        ],
      };

      if (config.priorityMapping) {
        const priorityId = config.priorityMapping[mitigation.priority];
        if (priorityId) fields.priority = { id: priorityId };
      }

      const result = await jiraRequest(config, credentials, "POST", "/issue", {
        fields,
      });

      if (!result.ok) {
        return sendBadRequest(reply, "Failed to create JIRA issue", {
          details: result.error,
        });
      }

      const issueData = result.data as { id: string; key: string };

      if (threatMapping) {
        await jiraRequest(config, credentials, "POST", "/issueLink", {
          type: { name: "Blocks" },
          outwardIssue: { key: threatMapping.externalKey },
          inwardIssue: { key: issueData.key },
        });
      }

      await prisma.integrationMapping.create({
        data: {
          integrationId: integration.id,
          localType: "mitigation",
          localId: mitigationId,
          externalType: "issue",
          externalId: issueData.id,
          externalKey: issueData.key,
          externalUrl: `${config.baseUrl}/browse/${issueData.key}`,
          syncDirection: "BIDIRECTIONAL",
          lastSyncedAt: new Date(),
          metadata: JSON.stringify({
            threatId: mitigation.threatId,
            parentIssueKey: threatMapping?.externalKey,
          }),
        },
      });

      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date(), lastSyncStatus: "Success" },
      });

      return {
        success: true,
        issueKey: issueData.key,
        issueUrl: `${config.baseUrl}/browse/${issueData.key}`,
        linkedToThreat: threatMapping?.externalKey ?? null,
        message: "Mitigation synced to JIRA successfully",
      };
    },
  );

  /**
   * POST /sync - Bidirectional sync
   */
  server.post<{ Params: { orgId: string } }>(
    "/sync",
    {
      schema: {
        tags: ["JIRA Integration"],
        summary: "Bidirectional sync with JIRA",
      },
      config: { authz: { org: "EDITOR" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!canUseOrgCredentials(access))
        return sendForbidden(reply, "Editor role or higher required");

      const loaded = await loadIntegration<JiraConfig, JiraCredentials>(
        prisma,
        reply,
        orgId,
        JIRA_INTEGRATION,
        { activeOnly: true },
      );
      if (loaded.denied) return loaded.denied;
      const { integration, config, credentials } = loaded;

      if (config.syncDirection === "PUSH_ONLY") {
        return sendBadRequest(reply, "Bidirectional sync not enabled");
      }

      const { syncLog, mappings } = await startBidirectionalSync(
        prisma,
        integration.id,
      );

      let itemsSynced = 0;
      let itemsFailed = 0;
      const errors: string[] = [];

      for (const mapping of mappings) {
        try {
          const result = await jiraRequest(
            config,
            credentials,
            "GET",
            `/issue/${mapping.externalKey}?fields=status,resolution`,
          );

          if (!result.ok) {
            errors.push(
              `Failed to fetch ${mapping.externalKey}: ${result.error}`,
            );
            itemsFailed++;
            continue;
          }

          const issueData = result.data as {
            fields: {
              status: { name: string; statusCategory: { key: string } };
              resolution: { name: string } | null;
            };
          };
          const jiraStatus = issueData.fields.status.name;
          const jiraStatusCategory = issueData.fields.status.statusCategory.key;
          const jiraResolution = issueData.fields.resolution?.name ?? null;

          let localThreatStatus: ThreatStatusType =
            jiraStatusCategory === "done"
              ? jiraResolution === "Won't Do"
                ? "ACCEPTED"
                : "MITIGATED"
              : "OPEN";

          if (config.statusMapping && config.statusMapping[jiraStatus]) {
            const mapped = config.statusMapping[jiraStatus];
            if (
              ["OPEN", "MITIGATED", "ACCEPTED", "NOT_APPLICABLE"].includes(
                mapped,
              )
            ) {
              localThreatStatus = mapped as ThreatStatusType;
            }
          }

          const mitigationStatus: MitigationStatusType =
            localThreatStatus === "MITIGATED" ||
            localThreatStatus === "ACCEPTED"
              ? "IMPLEMENTED"
              : "NOT_IMPLEMENTED";
          itemsSynced += await applyMappingStatus(prisma, mapping, {
            threat: localThreatStatus,
            mitigation: mitigationStatus,
          });
        } catch (error) {
          errors.push(
            `Error processing ${mapping.externalKey}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          itemsFailed++;
        }
      }

      const status = await finishBidirectionalSync(prisma, {
        syncLog,
        integration,
        user,
        orgId,
        auditType: "jira_sync",
        itemsSynced,
        itemsFailed,
        errors,
      });

      return {
        success: status !== "FAILED",
        status,
        itemsSynced,
        itemsFailed,
        mappingsProcessed: mappings.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Bidirectional sync ${status.toLowerCase()}: ${itemsSynced} updated, ${itemsFailed} failed`,
      };
    },
  );
};
