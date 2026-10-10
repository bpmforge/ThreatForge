/**
 * Custom Roles - Mutation routes (create, update, delete).
 */
import type { FastifyPluginAsync } from "fastify";
import type { CreateRoleBody, UpdateRoleBody } from "../helpers.js";
import {
  getPrisma,
  getAuthUser,
  checkOrganizationAccess,
  logAudit,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const mutationRoutes: FastifyPluginAsync = async (server) => {
  /** POST /api/organizations/:orgId/roles - Create a new custom role. */
  server.post<{ Params: { orgId: string }; Body: CreateRoleBody }>(
    "/api/organizations/:orgId/roles",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { name, description, color, permissions } = request.body;

      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (
        !access.hasAccess ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(
          reply,
          "Only admins and owners can create custom roles",
        );
      }

      if (!name?.trim()) {
        return sendBadRequest(reply, "Role name is required");
      }

      if (!permissions || permissions.length === 0) {
        return sendBadRequest(reply, "At least one permission is required");
      }

      const prisma = await getPrisma();

      const existing = await prisma.customRole.findFirst({
        where: { organizationId: orgId, name: name.trim() },
      });
      if (existing) {
        return sendBadRequest(reply, "A role with this name already exists");
      }

      const role = await prisma.customRole.create({
        data: {
          organizationId: orgId,
          name: name.trim(),
          description: description?.trim() || null,
          color: color || null,
          permissions: JSON.stringify(permissions),
          createdById: authUser.id,
        },
      });

      await logAudit({
        action: "CREATE",
        scope: "ORGANIZATION",
        resourceType: "SYSTEM_SETTINGS",
        resourceId: role.id,
        resourceName: `Custom Role: ${role.name}`,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: { permissions },
      });

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions,
        isSystem: false,
        memberCount: 0,
        createdAt: role.createdAt,
      };
    },
  );

  /** PATCH /api/organizations/:orgId/roles/:roleId - Update a custom role. */
  server.patch<{
    Params: { orgId: string; roleId: string };
    Body: UpdateRoleBody;
  }>(
    "/api/organizations/:orgId/roles/:roleId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, roleId } = request.params;
      const { name, description, color, permissions } = request.body;

      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (
        !access.hasAccess ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(
          reply,
          "Only admins and owners can update custom roles",
        );
      }

      const prisma = await getPrisma();

      const role = await prisma.customRole.findFirst({
        where: { id: roleId, organizationId: orgId },
      });

      if (!role) {
        return sendNotFound(reply, "Role");
      }

      if (role.isSystem) {
        return sendBadRequest(reply, "System roles cannot be modified");
      }

      if (name && name.trim() !== role.name) {
        const existing = await prisma.customRole.findFirst({
          where: {
            organizationId: orgId,
            name: name.trim(),
            id: { not: roleId },
          },
        });
        if (existing) {
          return sendBadRequest(reply, "A role with this name already exists");
        }
      }

      const updatedRole = await prisma.customRole.update({
        where: { id: roleId },
        data: {
          name: name?.trim() || role.name,
          description:
            description !== undefined
              ? description?.trim() || null
              : role.description,
          color: color !== undefined ? color || null : role.color,
          permissions: permissions
            ? JSON.stringify(permissions)
            : role.permissions,
        },
        include: {
          _count: {
            select: { memberships: true },
          },
        },
      });

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      if (name) {
        changes.name = { old: role.name, new: name.trim() };
      }
      if (permissions) {
        changes.permissions = {
          old: JSON.parse(role.permissions),
          new: permissions,
        };
      }

      await logAudit({
        action: "UPDATE",
        scope: "ORGANIZATION",
        resourceType: "SYSTEM_SETTINGS",
        resourceId: roleId,
        resourceName: `Custom Role: ${updatedRole.name}`,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        changes: Object.keys(changes).length > 0 ? changes : undefined,
      });

      return {
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        color: updatedRole.color,
        permissions: JSON.parse(updatedRole.permissions),
        isSystem: updatedRole.isSystem,
        memberCount: updatedRole._count.memberships,
        updatedAt: updatedRole.updatedAt,
      };
    },
  );

  /** DELETE /api/organizations/:orgId/roles/:roleId - Delete a custom role. */
  server.delete<{ Params: { orgId: string; roleId: string } }>(
    "/api/organizations/:orgId/roles/:roleId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, roleId } = request.params;

      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (
        !access.hasAccess ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(
          reply,
          "Only admins and owners can delete custom roles",
        );
      }

      const prisma = await getPrisma();

      const role = await prisma.customRole.findFirst({
        where: { id: roleId, organizationId: orgId },
        include: {
          _count: {
            select: { memberships: true },
          },
        },
      });

      if (!role) {
        return sendNotFound(reply, "Role");
      }

      if (role.isSystem) {
        return sendBadRequest(reply, "System roles cannot be deleted");
      }

      if (role._count.memberships > 0) {
        return sendBadRequest(
          reply,
          `Cannot delete role with ${role._count.memberships} assigned member(s). Reassign members first.`,
        );
      }

      await prisma.customRole.delete({ where: { id: roleId } });

      await logAudit({
        action: "DELETE",
        scope: "ORGANIZATION",
        resourceType: "SYSTEM_SETTINGS",
        resourceId: roleId,
        resourceName: `Custom Role: ${role.name}`,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
      });

      return { success: true };
    },
  );
};
