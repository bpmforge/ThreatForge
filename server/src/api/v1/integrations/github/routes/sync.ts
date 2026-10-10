/**
 * GitHub Integration - Bidirectional Sync Routes
 */
import { routeAuthz } from "../../../../../middleware/authz-policy.js";
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  canUseOrgCredentials,
} from "../../../helpers.js";
import type { GitHubConfig, GitHubCredentials } from "../schemas.js";
import { githubRequest } from "../helpers.js";
import {
  GITHUB_INTEGRATION,
  applyMappingStatus,
  finishBidirectionalSync,
  loadIntegration,
  startBidirectionalSync,
  type MitigationStatusType,
  type ThreatStatusType,
} from "../../route-helpers.js";
import {
  sendBadRequest,
  sendForbidden,
} from "../../../../../utils/api-response.js";

export const syncRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /** POST /sync - Bidirectional sync with GitHub */
  server.post<{ Params: { orgId: string } }>(
    "/sync",
    routeAuthz({ org: "EDITOR" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

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
          const issueNumber = mapping.externalKey?.replace("#", "");
          if (!issueNumber) continue;

          const result = await githubRequest(
            config,
            credentials,
            "GET",
            `/repos/${config.owner}/${config.repo}/issues/${issueNumber}`,
          );

          if (!result.ok) {
            errors.push(
              `Failed to fetch ${mapping.externalKey}: ${result.error}`,
            );
            itemsFailed++;
            continue;
          }

          const issueData = result.data as {
            state: string;
            state_reason: string | null;
          };
          const isClosed = issueData.state === "closed";
          const reason = issueData.state_reason;

          const localThreatStatus: ThreatStatusType = isClosed
            ? reason === "not_planned"
              ? "ACCEPTED"
              : "MITIGATED"
            : "OPEN";

          const mitigationStatus: MitigationStatusType = isClosed
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
        auditType: "github_sync",
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
      };
    },
  );
};
