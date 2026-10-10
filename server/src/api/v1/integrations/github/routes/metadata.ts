/**
 * GitHub Integration - Metadata Routes (Labels, etc.)
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import { getAuthUser, checkOrganizationAccess } from "../../../helpers.js";
import type { GitHubConfig, GitHubCredentials } from "../schemas.js";
import { githubRequest } from "../helpers.js";
import { GITHUB_INTEGRATION, loadIntegration } from "../../route-helpers.js";
import {
  sendBadRequest,
  sendForbidden,
} from "../../../../../utils/api-response.js";
import { routeAuthz } from "../../../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });

export const metadataRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /** GET /labels - List repository labels */
  server.get<{ Params: { orgId: string } }>(
    "/labels",
    ORG_VIEWER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) return sendForbidden(reply, "Access denied");

      const loaded = await loadIntegration<GitHubConfig, GitHubCredentials>(
        prisma,
        reply,
        orgId,
        GITHUB_INTEGRATION,
      );
      if (loaded.denied) return loaded.denied;
      const { config, credentials } = loaded;

      const result = await githubRequest(
        config,
        credentials,
        "GET",
        `/repos/${config.owner}/${config.repo}/labels`,
      );

      if (!result.ok)
        return sendBadRequest(reply, result.error ?? "Unknown error");

      const labels = result.data as Array<{
        name: string;
        color: string;
        description: string;
      }>;
      return {
        data: labels.map((l) => ({
          name: l.name,
          color: l.color,
          description: l.description,
        })),
      };
    },
  );
};
