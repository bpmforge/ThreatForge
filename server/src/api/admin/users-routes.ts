/**
 * Admin Users Routes
 *
 * User management including CRUD, super admin status, and memberships.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../db.js";
import type { MemberRole } from "@prisma/client";
import { getAuthUser, isSuperAdmin, canDemoteSystemAdmin } from "./utils.js";
import {
  sendSuccess,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
} from "../../utils/api-response.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

/** User response shape */
interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: {
    id: string;
    role: MemberRole;
    organizationId: string;
    organizationName: string;
  }[];
}

/** Transform user from DB to response */
function transformUser(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  memberships: {
    id: string;
    role: MemberRole;
    organizationId: string;
    organization: { name: string };
  }[];
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isSuperAdmin: user.isSuperAdmin,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    memberships: user.memberships.map((m) => ({
      id: m.id,
      role: m.role,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
    })),
  };
}

/** Prisma select matching the shape consumed by transformUser. */
const USER_RESPONSE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isSuperAdmin: true,
  lastLoginAt: true,
  createdAt: true,
  memberships: {
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  },
} as const;

const SUPER_ADMIN = routeAuthz("superAdmin");

export const usersRoutes: FastifyPluginAsync = async (server) => {
  /** List users */
  server.get<{
    Querystring: { search?: string; page?: string; limit?: string };
  }>("/api/admin/users", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const prisma = await getPrisma();
    const { search, page = "1", limit = "20" } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = search
      ? {
          OR: [{ name: { contains: search } }, { email: { contains: search } }],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        select: USER_RESPONSE_SELECT,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return sendSuccess(reply, { users: users.map(transformUser), total });
  });

  /** Get single user */
  server.get<{ Params: { userId: string } }>(
    "/api/admin/users/:userId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({
        where: { id: request.params.userId },
        select: USER_RESPONSE_SELECT,
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      return sendSuccess(reply, transformUser(user));
    },
  );

  /** Update user */
  server.patch<{
    Params: { userId: string };
    Body: { name?: string; isSuperAdmin?: boolean };
  }>("/api/admin/users/:userId", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);

    const hasAccess = await isSuperAdmin(authUser.id);
    if (!hasAccess) {
      return sendForbidden(reply, "Admin access required");
    }

    const prisma = await getPrisma();
    const { userId } = request.params;
    const { name, isSuperAdmin: newSuperAdminStatus } = request.body;

    // Super admin status changes require super admin
    if (newSuperAdminStatus !== undefined) {
      const isCurrentUserSuperAdmin = await isSuperAdmin(authUser.id);
      if (!isCurrentUserSuperAdmin) {
        return sendForbidden(
          reply,
          "Super admin access required to modify super admin status",
        );
      }
      if (userId === authUser.id && !newSuperAdminStatus) {
        return sendBadRequest(reply, "Cannot demote yourself from super admin");
      }
      if (!newSuperAdminStatus) {
        const demoteCheck = await canDemoteSystemAdmin(userId);
        if (!demoteCheck.allowed) {
          return sendBadRequest(
            reply,
            demoteCheck.reason || "Cannot demote admin",
          );
        }
      }
    }

    const updateData: { name?: string; isSuperAdmin?: boolean } = {};
    if (name !== undefined) updateData.name = name;
    if (newSuperAdminStatus !== undefined)
      updateData.isSuperAdmin = newSuperAdminStatus;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: USER_RESPONSE_SELECT,
    });

    return sendSuccess(reply, transformUser(user));
  });

  /** Delete user */
  server.delete<{ Params: { userId: string } }>(
    "/api/admin/users/:userId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { userId } = request.params;

      if (userId === authUser.id) {
        return sendBadRequest(reply, "Cannot delete yourself");
      }

      const demoteCheck = await canDemoteSystemAdmin(userId);
      if (!demoteCheck.allowed) {
        return sendBadRequest(
          reply,
          demoteCheck.reason || "Cannot demote admin",
        );
      }

      await prisma.user.delete({ where: { id: userId } });
      return sendSuccess(reply, { success: true });
    },
  );

  /** Promote or demote super admin status */
  server.post<{ Params: { userId: string }; Body: { isSuperAdmin: boolean } }>(
    "/api/admin/users/:userId/super-admin",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const isCurrentUserSuperAdmin = await isSuperAdmin(authUser.id);
      if (!isCurrentUserSuperAdmin) {
        return sendForbidden(reply, "Super admin access required");
      }

      const prisma = await getPrisma();
      const { userId } = request.params;
      const { isSuperAdmin: newStatus } = request.body;

      if (userId === authUser.id && !newStatus) {
        return sendBadRequest(reply, "Cannot demote yourself from super admin");
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return sendNotFound(reply, "User");
      }

      if (!newStatus) {
        const demoteCheck = await canDemoteSystemAdmin(userId);
        if (!demoteCheck.allowed) {
          return sendBadRequest(
            reply,
            demoteCheck.reason || "Cannot demote admin",
          );
        }
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isSuperAdmin: newStatus },
        select: { id: true, email: true, name: true, isSuperAdmin: true },
      });

      return sendSuccess(reply, updated);
    },
  );
};
