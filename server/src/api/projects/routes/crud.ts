/**
 * Project CRUD Routes
 *
 * GET list, POST create, GET by id, PATCH update, DELETE.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  checkProjectAccess,
  checkOrganizationAccess,
} from "../../../services/access-control/access-control-service.js";
import { CREATOR_ROLES } from "../../threat-models/helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendList,
  sendNoContent,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendValidationError,
  parsePagination,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { logAudit } from "../../../services/audit.js";
import {
  canAccessProject,
  authorizeProject,
  CreateProjectSchema,
  UpdateProjectSchema,
} from "../helpers.js";
import { requireScopes } from "../../../middleware/auth.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const OWN_ORGS_ONLY = routeAuthz({
  handler: "lists projects of the caller's ACTIVE memberships",
});
const PROJECT_MEMBER = routeAuthz({
  handler: "checkProjectAccess: ACTIVE member (any role) of the project's org",
});

export const crudRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/projects
   * List projects the user has access to through organization membership
   * Supports pagination via page/limit query params
   */
  fastify.get<{
    Querystring: {
      search?: string;
      status?: string;
      organizationId?: string;
      sortBy?: string;
      sortOrder?: string;
      page?: string;
      limit?: string;
    };
  }>("/api/projects", OWN_ORGS_ONLY, async (request, reply) => {
    const user = getAuthUser(request);
    const prisma = await getPrisma();
    const {
      search,
      status,
      organizationId,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = request.query;

    // Parse pagination using standardized helper
    const { page, limit, skip } = parsePagination(request.query);

    // Build where clause - always filter by organization membership
    const where: Record<string, unknown> = {
      organization: {
        memberships: {
          some: { userId: user.id, status: "ACTIVE" },
        },
      },
    };

    if (search) {
      where.name = { contains: search };
    }
    if (status && (status === "ACTIVE" || status === "ARCHIVED")) {
      where.status = status;
    }
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const orderBy: Record<string, string> = {};
    if (sortBy === "name" || sortBy === "createdAt" || sortBy === "updatedAt") {
      orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { threatModels: true },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    const data = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      organizationId: p.organizationId,
      createdById: p.createdById,
      createdBy: p.createdBy,
      threatModelCount: p._count.threatModels,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return sendList(reply, data, { page, limit, total });
  });

  /**
   * GET /api/projects/:id
   * Get project with full details including threat statistics
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/projects/:id",
    PROJECT_MEMBER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // Check access
      const hasAccess = await canAccessProject(user.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Project", id);
      }

      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          projectMembers: true,
          threatModels: {
            select: {
              id: true,
              name: true,
              version: true,
              updatedAt: true,
              _count: {
                select: { threats: true },
              },
            },
            orderBy: { updatedAt: "desc" },
          },
          _count: {
            select: { threatModels: true },
          },
        },
      });

      if (!project) {
        return sendNotFound(reply, "Project", id);
      }

      // Fetch user details for project members
      const memberUserIds = project.projectMembers.map((pm) => pm.userId);
      const memberUsers = await prisma.user.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, name: true, email: true, avatarUrl: true },
      });
      const userMap = new Map(memberUsers.map((u) => [u.id, u]));

      // Calculate aggregate threat statistics for the project
      const threatStats = await prisma.threat.groupBy({
        by: ["status"],
        where: {
          threatModel: {
            projectId: id,
          },
        },
        _count: true,
      });

      // Calculate totals from grouped stats
      // ThreatStatus values: OPEN, MITIGATED, ACCEPTED, NOT_APPLICABLE
      let totalThreats = 0;
      let openThreats = 0;
      let mitigatedThreats = 0;

      for (const stat of threatStats) {
        totalThreats += stat._count;
        if (stat.status === "OPEN") {
          openThreats += stat._count;
        } else if (stat.status === "MITIGATED") {
          mitigatedThreats += stat._count;
        }
        // ACCEPTED and NOT_APPLICABLE are neither open nor mitigated
      }

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        organizationId: project.organizationId,
        createdById: project.createdById,
        organization: project.organization,
        createdBy: project.createdBy,
        projectMembers: project.projectMembers.map((pm) => ({
          id: pm.id,
          userId: pm.userId,
          role: pm.role,
          user: userMap.get(pm.userId) || null,
        })),
        threatModels: project.threatModels.map((tm) => ({
          id: tm.id,
          name: tm.name,
          version: tm.version,
          updatedAt: tm.updatedAt.toISOString(),
          threatCount: tm._count.threats,
        })),
        threatModelCount: project._count.threatModels,
        // Project-level threat statistics
        stats: {
          totalThreats,
          openThreats,
          mitigatedThreats,
        },
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      };
    },
  );

  /**
   * POST /api/projects
   * Create a new project (requires membership in the target organization)
   */
  fastify.post(
    "/api/projects",
    {
      config: { authz: { org: "EDITOR" } },
      preHandler: requireScopes(["write:projects"]),
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const parseResult = CreateProjectSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      const { name, description } = parseResult.data;
      let { organizationId } = parseResult.data;

      // No organizationId: pick an org where the caller can create (EDITOR+),
      // never one where they only view.
      if (!organizationId) {
        const memberships = await prisma.membership.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          select: { organizationId: true, role: true },
        });

        if (memberships.length === 0) {
          return sendBadRequest(reply, "User has no organization membership");
        }

        const creatable = memberships.find((m) =>
          (CREATOR_ROLES as string[]).includes(m.role),
        );
        if (!creatable) {
          return sendForbidden(
            reply,
            "Creating projects requires EDITOR or above in the organization",
          );
        }
        organizationId = creatable.organizationId;
      }

      const orgAccess = await checkOrganizationAccess(user.id, organizationId);
      if (!orgAccess.hasAccess) {
        return sendForbidden(reply, "Access denied to organization");
      }
      if (!orgAccess.permissions.includes("edit")) {
        return sendForbidden(
          reply,
          "Creating projects requires EDITOR or above in the organization",
        );
      }

      const project = await prisma.project.create({
        data: {
          name,
          description,
          organizationId,
          createdById: user.id,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          projectMembers: true,
          threatModels: {
            select: { id: true, name: true, version: true, updatedAt: true },
          },
        },
      });

      // Add creator as owner
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      logAudit({
        action: "CREATE",
        resourceType: "PROJECT",
        resourceId: project.id,
        resourceName: project.name,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId: project.organizationId,
      }).catch(() => {});

      return sendCreated(reply, {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        organizationId: project.organizationId,
        createdById: project.createdById,
        organization: project.organization,
        createdBy: project.createdBy,
        projectMembers: project.projectMembers,
        threatModels: [],
        threatModelCount: 0,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      });
    },
  );

  /**
   * PATCH /api/projects/:id
   * Update project
   */
  fastify.patch<{ Params: { id: string } }>(
    "/api/projects/:id",
    {
      config: { authz: { handler: "org role with edit on the project" } },
      preHandler: requireScopes(["write:projects"]),
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await authorizeProject(reply, user.id, id, "edit"))) return reply;

      const parseResult = UpdateProjectSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      const { name, description, status } = parseResult.data;

      const updated = await prisma.project.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(status && { status }),
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          projectMembers: true,
          threatModels: {
            select: { id: true, name: true, version: true, updatedAt: true },
          },
          _count: {
            select: { threatModels: true },
          },
        },
      });

      return sendSuccess(reply, {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        organizationId: updated.organizationId,
        createdById: updated.createdById,
        organization: updated.organization,
        createdBy: updated.createdBy,
        projectMembers: updated.projectMembers,
        threatModels: updated.threatModels.map((tm) => ({
          ...tm,
          updatedAt: tm.updatedAt.toISOString(),
        })),
        threatModelCount: updated._count.threatModels,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    },
  );

  /**
   * DELETE /api/projects/:id
   * Delete project (requires ADMIN or OWNER role in the organization)
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/projects/:id",
    {
      config: {
        authz: {
          handler:
            "checkProjectAccess: ACTIVE ADMIN/OWNER of the project's org ('delete' permission)",
        },
      },
      preHandler: requireScopes(["write:projects"]),
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // Check access and get org info
      const accessCheck = await checkProjectAccess(user.id, id);
      if (!accessCheck.hasAccess) {
        return sendNotFound(reply, "Project", id);
      }

      // Require ADMIN or OWNER role to delete projects
      if (!accessCheck.permissions.includes("delete")) {
        return sendForbidden(
          reply,
          `${accessCheck.role} role does not have permission to delete projects`,
        );
      }

      await prisma.project.delete({ where: { id } });

      return sendNoContent(reply);
    },
  );
};
