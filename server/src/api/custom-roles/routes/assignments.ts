/**
 * Custom Roles - Assignment routes (assign/remove role from members).
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  getAuthUser,
  checkOrganizationAccess,
  logAudit,
  sendForbidden,
  sendNotFound,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const assignmentRoutes: FastifyPluginAsync = async (server) => {
  /** POST /api/organizations/:orgId/roles/:roleId/assign - Assign role to member. */
  server.post<{
    Params: { orgId: string; roleId: string };
    Body: { membershipId: string };
  }>(
    "/api/organizations/:orgId/roles/:roleId/assign",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, roleId } = request.params;
      const { membershipId } = request.body;

      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (
        !access.hasAccess ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(
          reply,
          "Only admins and owners can assign custom roles",
        );
      }

      const prisma = await getPrisma();

      // Verify role exists
      const role = await prisma.customRole.findFirst({
        where: { id: roleId, organizationId: orgId },
      });
      if (!role) {
        return sendNotFound(reply, "Role");
      }

      // Verify membership exists in this org
      // nosemgrep: tf-membership-query-missing-status -- target membership, any status; the caller's ACTIVE admin role is checked above
      const membership = await prisma.membership.findFirst({
        where: { id: membershipId, organizationId: orgId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      if (!membership) {
        return sendNotFound(reply, "Membership");
      }

      await prisma.membership.update({
        where: { id: membershipId },
        data: { customRoleId: roleId },
      });

      await logAudit({
        action: "UPDATE",
        scope: "ORGANIZATION",
        resourceType: "USER",
        resourceId: membership.userId,
        resourceName: membership.user.name || membership.user.email,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: { customRole: role.name },
      });

      return { success: true, role: role.name };
    },
  );

  /** DELETE /api/organizations/:orgId/roles/:roleId/assign/:membershipId - Remove role from member. */
  server.delete<{
    Params: { orgId: string; roleId: string; membershipId: string };
  }>(
    "/api/organizations/:orgId/roles/:roleId/assign/:membershipId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, membershipId } = request.params;

      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (
        !access.hasAccess ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(
          reply,
          "Only admins and owners can unassign custom roles",
        );
      }

      const prisma = await getPrisma();

      // nosemgrep: tf-membership-query-missing-status -- target membership, any status; the caller's ACTIVE admin role is checked above
      const membership = await prisma.membership.findFirst({
        where: { id: membershipId, organizationId: orgId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      if (!membership) {
        return sendNotFound(reply, "Membership");
      }

      await prisma.membership.update({
        where: { id: membershipId },
        data: { customRoleId: null },
      });

      await logAudit({
        action: "UPDATE",
        scope: "ORGANIZATION",
        resourceType: "USER",
        resourceId: membership.userId,
        resourceName: membership.user.name || membership.user.email,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: { customRoleRemoved: true },
      });

      return { success: true };
    },
  );
};
