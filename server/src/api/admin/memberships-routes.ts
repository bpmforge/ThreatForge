/**
 * Admin Membership Routes
 *
 * User-organization membership management.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../db.js";
import type { MemberRole } from "@prisma/client";
import { getAuthUser, isSuperAdmin, SUPER_ADMIN } from "./utils.js";
import {
  sendSuccess,
  sendCreated,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
} from "../../utils/api-response.js";

export const membershipsRoutes: FastifyPluginAsync = async (server) => {
  /** Add user to organization */
  server.post<{
    Params: { userId: string };
    Body: { organizationId: string; role: MemberRole };
  }>(
    "/api/admin/users/:userId/memberships",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { userId } = request.params;
      const { organizationId, role } = request.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return sendNotFound(reply, "User");
      }

      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      // nosemgrep: tf-membership-query-missing-status -- super-admin: any existing row (any status) blocks a duplicate
      const existing = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      });
      if (existing) {
        return sendBadRequest(
          reply,
          "User is already a member of this organization",
        );
      }

      const membership = await prisma.membership.create({
        data: { userId, organizationId, role },
        include: { organization: { select: { name: true } } },
      });

      return sendCreated(reply, {
        id: membership.id,
        role: membership.role,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
      });
    },
  );

  /** Update user membership role */
  server.patch<{
    Params: { userId: string; membershipId: string };
    Body: { role: MemberRole };
  }>(
    "/api/admin/users/:userId/memberships/:membershipId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { userId, membershipId } = request.params;
      const { role } = request.body;

      // nosemgrep: tf-membership-query-missing-status -- super-admin manages memberships of every status
      const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
        include: { organization: { select: { name: true } } },
      });

      if (!membership || membership.userId !== userId) {
        return sendNotFound(reply, "Membership");
      }

      const updated = await prisma.membership.update({
        where: { id: membershipId },
        data: { role },
        include: { organization: { select: { name: true } } },
      });

      return sendSuccess(reply, {
        id: updated.id,
        role: updated.role,
        organizationId: updated.organizationId,
        organizationName: updated.organization.name,
      });
    },
  );

  /** Remove user from organization */
  server.delete<{
    Params: { userId: string; membershipId: string };
  }>(
    "/api/admin/users/:userId/memberships/:membershipId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { userId, membershipId } = request.params;

      // nosemgrep: tf-membership-query-missing-status -- super-admin manages memberships of every status
      const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
      });

      if (!membership || membership.userId !== userId) {
        return sendNotFound(reply, "Membership");
      }

      await prisma.membership.delete({ where: { id: membershipId } });
      return sendSuccess(reply, { success: true });
    },
  );
};
