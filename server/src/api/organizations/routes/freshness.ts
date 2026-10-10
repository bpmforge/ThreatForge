/**
 * Organization Freshness Routes
 *
 * GET  /api/organizations/:orgId/freshness          — list stale models
 * POST /api/organizations/:orgId/freshness/trigger  — manually run check (admin)
 */
import type { FastifyPluginAsync } from "fastify";
import { findStaleModels } from "../../../services/freshness/freshness-check.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { sendSuccess, sendForbidden } from "../../../utils/api-response.js";
import { isMemberOfOrganization } from "../helpers.js";
import { isActiveOrgAdmin } from "../../../services/access-control/access-control-service.js";

export const freshnessRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/organizations/:orgId/freshness
   * List threat models in the org that haven't been updated recently.
   */
  fastify.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/freshness",
    { config: { authz: { org: "VIEWER" } } },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const canManage = await isMemberOfOrganization(user.id, orgId);
      if (!canManage)
        return sendForbidden(reply, "Organization access required");

      const staleModels = await findStaleModels({ organizationId: orgId });

      return sendSuccess(reply, {
        organizationId: orgId,
        staleCount: staleModels.length,
        models: staleModels.map((m) => ({
          id: m.id,
          name: m.name,
          projectName: m.projectName,
          daysSinceUpdate: m.daysSinceUpdate,
          staleness: m.staleness,
          openThreatCount: m.openThreatCount,
        })),
      });
    },
  );

  /**
   * POST /api/organizations/:orgId/freshness/trigger
   * Manually run the freshness check and send notifications (admin only).
   */
  fastify.post<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/freshness/trigger",
    { config: { authz: { org: "ADMIN" } } },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isActiveOrgAdmin(user.id, orgId)))
        return sendForbidden(reply, "Organization admin access required");

      const { runFreshnessCheck } = await import(
        "../../../jobs/freshness-queue.js"
      );
      const result = await runFreshnessCheck({ organizationId: orgId });

      return sendSuccess(reply, {
        organizationId: orgId,
        notified: result.notified,
        skipped: result.skipped,
      });
    },
  );
};
