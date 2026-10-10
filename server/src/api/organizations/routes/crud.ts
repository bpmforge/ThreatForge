/**
 * Organization CRUD Routes
 *
 * GET list, POST create, GET by id, DELETE.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendNoContent,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import {
  generateUniqueSlug,
  isMemberOfOrganization,
  getUserRole,
  CreateOrganizationSchema,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_OWNER = routeAuthz({ org: "OWNER" });

const AUTHENTICATED = routeAuthz("authenticated");

export const crudRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/organizations
   * List organizations the current user is a member of
   */
  fastify.get("/api/organizations", AUTHENTICATED, async (request, reply) => {
    const user = getAuthUser(request);
    const prisma = await getPrisma();

    // Only return organizations the user is a member of
    const orgs = await prisma.organization.findMany({
      where: {
        memberships: {
          some: { userId: user.id, status: "ACTIVE" },
        },
      },
      include: {
        memberships: {
          select: { role: true, userId: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const data = orgs.map((org) => {
      // Find the current user's role in this org
      const userMembership = org.memberships.find((m) => m.userId === user.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        type: org.type,
        isPersonal: org.isPersonal,
        memberCount: org.memberships.length,
        role: userMembership?.role || "VIEWER",
        createdAt: org.createdAt.toISOString(),
      };
    });
    return sendSuccess(reply, data);
  });

  /**
   * POST /api/organizations
   * Create a new organization (TEAM or ENTERPRISE type)
   */
  fastify.post("/api/organizations", AUTHENTICATED, async (request, reply) => {
    const user = getAuthUser(request);
    const prisma = await getPrisma();

    const parseResult = CreateOrganizationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return sendBadRequest(reply, "Validation failed", {
        details: parseResult.error.flatten(),
      });
    }

    const { name, description, type } = parseResult.data;

    // Generate unique slug
    const slug = await generateUniqueSlug(name);

    // Create organization with owner membership in transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          description,
          type,
          isPersonal: false,
          ownerId: user.id,
        },
      });

      // Add creator as owner
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "OWNER",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          scope: "ORGANIZATION",
          action: "CREATE",
          resourceType: "ORGANIZATION",
          resourceId: org.id,
          resourceName: name,
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: org.id,
          metadata: JSON.stringify({ type, slug }),
        },
      });

      return org;
    });

    return sendCreated(reply, {
      id: result.id,
      name: result.name,
      slug: result.slug,
      description: result.description,
      type: result.type,
      isPersonal: result.isPersonal,
      createdAt: result.createdAt.toISOString(),
    });
  });

  /**
   * GET /api/organizations/:id
   * Get organization with full details
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/organizations/:id",
    ORG_VIEWER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // Check membership
      const isMember = await isMemberOfOrganization(user.id, id);
      if (!isMember) {
        return sendNotFound(reply, "Organization");
      }

      const org = await prisma.organization.findUnique({
        where: { id },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
        },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      // Get user's role for this org
      const userRole = await getUserRole(user.id, id);

      return sendSuccess(reply, {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        type: org.type,
        isPersonal: org.isPersonal,
        ownerId: org.ownerId,
        allowGuestAccess: org.allowGuestAccess,
        guestDefaultRole: org.guestDefaultRole,
        allowGuestExport: org.allowGuestExport,
        settings: org.settings ? JSON.parse(org.settings) : {},
        currentUserRole: userRole,
        memberships: org.memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          user: m.user,
          invitedAt: m.invitedAt?.toISOString(),
          acceptedAt: m.acceptedAt?.toISOString(),
          createdAt: m.createdAt.toISOString(),
        })),
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      });
    },
  );

  /**
   * DELETE /api/organizations/:id
   * Soft-delete an organization (requires OWNER role)
   * Personal organizations cannot be deleted
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/organizations/:id",
    ORG_OWNER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // Check role - must be OWNER to delete
      const role = await getUserRole(user.id, id);
      if (role !== "OWNER") {
        return sendForbidden(
          reply,
          "Only the organization owner can delete it",
        );
      }

      // Get organization
      const org = await prisma.organization.findUnique({
        where: { id },
        select: { id: true, name: true, isPersonal: true, deletedAt: true },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      // Cannot delete personal organizations
      if (org.isPersonal) {
        return sendBadRequest(
          reply,
          "Personal organizations cannot be deleted",
        );
      }

      // Cannot delete already deleted org
      if (org.deletedAt) {
        return sendBadRequest(reply, "Organization is already deleted");
      }

      // Soft delete with audit log
      await prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            scope: "ORGANIZATION",
            action: "DELETE",
            resourceType: "ORGANIZATION",
            resourceId: id,
            resourceName: org.name,
            userId: user.id,
            userEmail: user.email || "unknown",
            organizationId: id,
            metadata: JSON.stringify({ softDelete: true }),
          },
        });
      });

      return sendNoContent(reply);
    },
  );

  // NOTE: Member management routes (POST/PATCH/DELETE /members) are in members.ts
  // NOTE: Audit log route (GET /api/organizations/:id/audit) is in audit.ts
};
