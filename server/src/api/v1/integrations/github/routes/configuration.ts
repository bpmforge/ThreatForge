/**
 * GitHub Integration - Configuration Routes
 */
import { routeAuthz } from "../../../../../middleware/authz-policy.js";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  logAudit,
} from "../../../helpers.js";
import {
  GitHubConfigSchema,
  GitHubCredentialsSchema,
  type GitHubConfig,
  type GitHubCredentials,
} from "../schemas.js";
import { githubRequest } from "../helpers.js";
import {
  GITHUB_INTEGRATION,
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

  /** POST /configure - Configure GitHub integration */
  server.post<{
    Params: { orgId: string };
    Body: z.infer<typeof GitHubConfigSchema> & {
      credentials: z.infer<typeof GitHubCredentialsSchema>;
    };
  }>("/configure", routeAuthz({ org: "ADMIN" }), async (request, reply) => {
    const user = getAuthUser(request);
    const { orgId } = request.params;
    const { credentials, ...config } = request.body;

    const access = await checkOrganizationAccess(user.id, orgId);
    if (!access || !access.role || !["OWNER", "ADMIN"].includes(access.role)) {
      return sendForbidden(reply, "Admin access required");
    }

    const validatedConfig = GitHubConfigSchema.parse(config);
    const validatedCredentials = GitHubCredentialsSchema.parse(credentials);

    const testResult = await githubRequest(
      validatedConfig,
      validatedCredentials,
      "GET",
      `/repos/${validatedConfig.owner}/${validatedConfig.repo}`,
    );

    if (!testResult.ok) {
      return sendBadRequest(reply, "Failed to connect to GitHub", {
        details: testResult.error,
      });
    }

    const saved = await saveIntegration(prisma, reply, {
      orgId,
      userId: user.id,
      type: "GITHUB_ISSUES",
      name: `GitHub - ${validatedConfig.owner}/${validatedConfig.repo}`,
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
      metadata: { type: "github_integration", action: "configure" },
    });

    return {
      id: integration.id,
      status: integration.status,
      repo: `${validatedConfig.owner}/${validatedConfig.repo}`,
      message: "GitHub integration configured successfully",
    };
  });

  /** POST /test - Test GitHub connection */
  server.post<{ Params: { orgId: string } }>(
    "/test",
    routeAuthz({ org: "VIEWER" }),
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
      const { integration, config, credentials } = loaded;

      const result = await githubRequest(
        config,
        credentials,
        "GET",
        `/repos/${config.owner}/${config.repo}`,
      );

      await recordConnectionTest(prisma, integration.id, result);

      if (result.ok) {
        const repoData = result.data as { full_name: string; private: boolean };
        return {
          success: true,
          repo: repoData.full_name,
          private: repoData.private,
          message: "Connection successful",
        };
      } else {
        return sendBadRequest(reply, result.error ?? "Unknown error");
      }
    },
  );
};
