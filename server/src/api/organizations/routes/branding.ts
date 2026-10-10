/**
 * Organization Branding Routes
 *
 * GET /api/organizations/:id/branding — any member: logo + brand colours
 * PUT /api/organizations/:id/branding — OWNER/ADMIN: set brand colours
 *
 * The logo itself is managed by POST/DELETE /api/organizations/:orgId/logo.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { logAudit } from "../../../services/audit.js";
import {
  HEX_COLOR_RE,
  resolveBranding,
} from "../../../services/reports/branding.js";
import { getUserRole } from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

const BrandingSchema = z.object({
  primaryColor: z.string().regex(HEX_COLOR_RE).nullable().optional(),
  accentColor: z.string().regex(HEX_COLOR_RE).nullable().optional(),
});

export const brandingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    "/api/organizations/:id/branding",
    ORG_VIEWER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      if (!(await getUserRole(user.id, id))) {
        return sendForbidden(reply, "Organization access required");
      }
      const prisma = await getPrisma();
      const org = await prisma.organization.findUnique({
        where: { id },
        select: { logoUrl: true, settings: true },
      });
      if (!org) return sendNotFound(reply, "Organization");
      return sendSuccess(reply, resolveBranding(org) ?? {});
    },
  );

  fastify.put<{ Params: { id: string } }>(
    "/api/organizations/:id/branding",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      const role = await getUserRole(user.id, id);
      if (role !== "OWNER" && role !== "ADMIN") {
        return sendForbidden(reply, "Insufficient permissions");
      }

      const parsed = BrandingSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Colours must be #rrggbb hex values", {
          details: parsed.error.flatten(),
        });
      }

      const prisma = await getPrisma();
      const org = await prisma.organization.findUnique({
        where: { id },
        select: { logoUrl: true, settings: true },
      });
      if (!org) return sendNotFound(reply, "Organization");

      let settings: Record<string, unknown> = {};
      try {
        settings = JSON.parse(org.settings || "{}") as Record<string, unknown>;
      } catch {
        // corrupt settings JSON — start fresh rather than fail the save
      }
      const next: Record<string, unknown> = {
        ...((settings.branding as Record<string, unknown> | undefined) ?? {}),
        ...parsed.data,
      };
      for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
      settings.branding = next;

      const updated = await prisma.organization.update({
        where: { id },
        data: { settings: JSON.stringify(settings) },
        select: { logoUrl: true, settings: true },
      });

      await logAudit({
        action: "UPDATE",
        scope: "ORGANIZATION",
        resourceType: "ORGANIZATION",
        resourceId: id,
        organizationId: id,
        userId: user.id,
        userEmail: user.email || "unknown",
        metadata: { field: "branding" },
      });

      return sendSuccess(reply, resolveBranding(updated) ?? {});
    },
  );
};
