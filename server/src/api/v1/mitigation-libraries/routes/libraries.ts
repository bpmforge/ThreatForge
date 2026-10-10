/**
 * Mitigation Library CRUD Routes
 *
 * List, create, and delete mitigation libraries for an organization.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  logAudit,
} from "../../helpers.js";
import {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendNoContent,
} from "../../../../utils/api-response.js";
import { CreateLibrarySchema } from "../schemas.js";

export const libraryRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /:orgId/mitigation-libraries
   * List mitigation libraries for an organization
   */
  server.get<{ Params: { orgId: string } }>(
    "/:orgId/mitigation-libraries",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "List mitigation libraries",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply, "Access denied");
      }

      // Get org libraries + public system libraries
      const libraries = await prisma.mitigationLibrary.findMany({
        where: {
          OR: [
            { organizationId: orgId },
            { isPublic: true },
            { isDefault: true },
          ],
        },
        include: {
          _count: { select: { templates: true } },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });

      return {
        data: libraries.map((lib) => ({
          id: lib.id,
          name: lib.name,
          description: lib.description,
          isDefault: lib.isDefault,
          isPublic: lib.isPublic,
          isOwned: lib.organizationId === orgId,
          templateCount: lib._count.templates,
          createdAt: lib.createdAt.toISOString(),
          updatedAt: lib.updatedAt.toISOString(),
        })),
      };
    },
  );

  /**
   * POST /:orgId/mitigation-libraries
   * Create a new mitigation library
   */
  server.post<{
    Params: { orgId: string };
    Body: z.infer<typeof CreateLibrarySchema>;
  }>(
    "/:orgId/mitigation-libraries",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "Create mitigation library",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;
      const body = CreateLibrarySchema.parse(request.body);

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const library = await prisma.mitigationLibrary.create({
        data: {
          organizationId: orgId,
          name: body.name,
          description: body.description,
          isPublic: body.isPublic,
          createdById: user.id,
        },
      });

      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "THREAT_LIBRARY",
        resourceId: library.id,
        resourceName: library.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "mitigation_library" },
      });

      return sendCreated(reply, {
        id: library.id,
        name: library.name,
        description: library.description,
        isDefault: library.isDefault,
        isPublic: library.isPublic,
        createdAt: library.createdAt.toISOString(),
        updatedAt: library.updatedAt.toISOString(),
      });
    },
  );

  /**
   * DELETE /:orgId/mitigation-libraries/:libraryId
   * Delete a mitigation library
   */
  server.delete<{ Params: { orgId: string; libraryId: string } }>(
    "/:orgId/mitigation-libraries/:libraryId",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "Delete mitigation library",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const library = await prisma.mitigationLibrary.findFirst({
        where: { id: libraryId, organizationId: orgId },
      });
      if (!library) {
        return sendNotFound(reply, "Library");
      }
      if (library.isDefault) {
        return sendBadRequest(reply, "Cannot delete default library");
      }

      await prisma.mitigationLibrary.delete({ where: { id: libraryId } });

      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "THREAT_LIBRARY",
        resourceId: libraryId,
        resourceName: library.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "mitigation_library" },
      });

      return sendNoContent(reply);
    },
  );
};
