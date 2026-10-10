/**
 * Admin Organizations Routes
 *
 * Organization management including CRUD and member management.
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

export const organizationsRoutes: FastifyPluginAsync = async (server) => {
  /** List organizations */
  server.get<{
    Querystring: { search?: string; page?: string; limit?: string };
  }>("/api/admin/organizations", SUPER_ADMIN, async (request, reply) => {
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
      ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }] }
      : {};

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { memberships: true, projects: true } },
          memberships: {
            where: { role: "OWNER" },
            take: 1,
            select: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.count({ where }),
    ]);

    // Count threat models per org
    const modelCountByOrg = await countModelsByOrg(
      prisma,
      organizations.map((o) => o.id),
    );

    return sendSuccess(reply, {
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        memberCount: o._count.memberships,
        projectCount: o._count.projects,
        modelCount: modelCountByOrg.get(o.id) || 0,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        owner: o.memberships[0]?.user ?? null,
      })),
      total,
    });
  });

  /** Get single organization with members */
  server.get<{ Params: { orgId: string } }>(
    "/api/admin/organizations/:orgId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { orgId } = request.params;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          memberships: {
            select: {
              id: true,
              role: true,
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { projects: true } },
        },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      const modelCount = await prisma.threatModel.count({
        where: { project: { organizationId: orgId } },
      });

      return sendSuccess(reply, {
        id: org.id,
        name: org.name,
        slug: org.slug,
        memberCount: org.memberships.length,
        projectCount: org._count.projects,
        modelCount,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
        members: org.memberships.map((m) => ({
          id: m.id,
          role: m.role,
          userId: m.user.id,
          userName: m.user.name,
          userEmail: m.user.email,
        })),
      });
    },
  );

  /** Update organization */
  server.patch<{ Params: { orgId: string }; Body: { name?: string } }>(
    "/api/admin/organizations/:orgId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { orgId } = request.params;
      const { name } = request.body;

      const org = await prisma.organization.update({
        where: { id: orgId },
        data: { name },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { memberships: true, projects: true } },
        },
      });

      return sendSuccess(reply, {
        id: org.id,
        name: org.name,
        slug: org.slug,
        memberCount: org._count.memberships,
        projectCount: org._count.projects,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      });
    },
  );

  /** Delete organization */
  server.delete<{ Params: { orgId: string } }>(
    "/api/admin/organizations/:orgId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { orgId } = request.params;

      await prisma.organization.delete({ where: { id: orgId } });
      return sendSuccess(reply, { success: true });
    },
  );

  /** Add member to organization */
  server.post<{
    Params: { orgId: string };
    Body: { userId: string; role: MemberRole };
  }>(
    "/api/admin/organizations/:orgId/members",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { orgId } = request.params;
      const { userId, role } = request.body;

      const [user, org] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.organization.findUnique({ where: { id: orgId } }),
      ]);

      if (!user) return sendNotFound(reply, "User");
      if (!org) return sendNotFound(reply, "Organization");

      // nosemgrep: tf-membership-query-missing-status -- super-admin: any existing row (any status) blocks a duplicate
      const existing = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
      });
      if (existing) {
        return sendBadRequest(reply, "User is already a member");
      }

      const membership = await prisma.membership.create({
        data: { userId, organizationId: orgId, role },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return sendCreated(reply, {
        id: membership.id,
        role: membership.role,
        userId: membership.user.id,
        userName: membership.user.name,
        userEmail: membership.user.email,
      });
    },
  );

  /** Update member role */
  server.patch<{
    Params: { orgId: string; memberId: string };
    Body: { role: MemberRole };
  }>(
    "/api/admin/organizations/:orgId/members/:memberId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { orgId, memberId } = request.params;
      const { role } = request.body;

      // nosemgrep: tf-membership-query-missing-status -- super-admin manages memberships of every status
      const membership = await prisma.membership.findFirst({
        where: { id: memberId, organizationId: orgId },
      });

      if (!membership) {
        return sendNotFound(reply, "Member");
      }

      const updated = await prisma.membership.update({
        where: { id: memberId },
        data: { role },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return sendSuccess(reply, {
        id: updated.id,
        role: updated.role,
        userId: updated.user.id,
        userName: updated.user.name,
        userEmail: updated.user.email,
      });
    },
  );

  /** Remove member from organization */
  server.delete<{ Params: { orgId: string; memberId: string } }>(
    "/api/admin/organizations/:orgId/members/:memberId",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const { orgId, memberId } = request.params;

      // nosemgrep: tf-membership-query-missing-status -- super-admin manages memberships of every status
      const membership = await prisma.membership.findFirst({
        where: { id: memberId, organizationId: orgId },
      });

      if (!membership) {
        return sendNotFound(reply, "Member");
      }

      await prisma.membership.delete({ where: { id: memberId } });
      return sendSuccess(reply, { success: true });
    },
  );
};

/** Count threat models by organization */
async function countModelsByOrg(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  orgIds: string[],
): Promise<Map<string, number>> {
  const modelCounts = await prisma.threatModel.groupBy({
    by: ["projectId"],
    where: { project: { organizationId: { in: orgIds } } },
    _count: true,
  });

  const projects = await prisma.project.findMany({
    where: { organizationId: { in: orgIds } },
    select: { id: true, organizationId: true },
  });
  const projectToOrg = new Map(projects.map((p) => [p.id, p.organizationId]));

  const result = new Map<string, number>();
  modelCounts.forEach((mc) => {
    const orgId = projectToOrg.get(mc.projectId);
    if (orgId) {
      result.set(orgId, (result.get(orgId) || 0) + mc._count);
    }
  });
  return result;
}
