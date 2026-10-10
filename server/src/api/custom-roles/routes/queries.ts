/**
 * Custom Roles - Query routes (list, get by id).
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  getAuthUser,
  checkOrganizationAccess,
  sendForbidden,
  sendNotFound,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_MEMBER = routeAuthz({ org: "VIEWER" });

export const queryRoutes: FastifyPluginAsync = async (server) => {
  /** GET /api/organizations/:orgId/roles - List all custom roles. */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/roles",
    ORG_MEMBER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (!access.hasAccess) {
        return sendForbidden(reply, "Access denied");
      }

      const prisma = await getPrisma();
      const roles = await prisma.customRole.findMany({
        where: { organizationId: orgId },
        include: {
          _count: {
            select: { memberships: true },
          },
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      });

      return roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: JSON.parse(role.permissions),
        isSystem: role.isSystem,
        memberCount: role._count.memberships,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      }));
    },
  );

  /** GET /api/organizations/:orgId/roles/:roleId - Get a specific role. */
  server.get<{ Params: { orgId: string; roleId: string } }>(
    "/api/organizations/:orgId/roles/:roleId",
    ORG_MEMBER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, roleId } = request.params;

      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (!access.hasAccess) {
        return sendForbidden(reply, "Access denied");
      }

      const prisma = await getPrisma();
      const role = await prisma.customRole.findFirst({
        where: { id: roleId, organizationId: orgId },
        include: {
          memberships: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });

      if (!role) {
        return sendNotFound(reply, "Role");
      }

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: JSON.parse(role.permissions),
        isSystem: role.isSystem,
        members: role.memberships.map((m) => ({
          membershipId: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
        })),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      };
    },
  );
};
