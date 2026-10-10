/**
 * Component Templates API - Library CRUD Routes
 *
 * List, get, create, update, delete template libraries. Import/export.
 */
import type { FastifyPluginAsync } from "fastify";
import type { ComponentTemplateLibrary, ComponentType } from "@prisma/client";
import {
  getPrisma,
  getAuthUser,
  isMemberOfOrganization,
  isOrgAdmin,
  CreateLibrarySchema,
  UpdateLibrarySchema,
  ImportLibrarySchema,
  sendCreated,
  sendNoContent,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { serializeTemplate } from "./templates.js";

/** A library is visible to an org when org-owned, public, or default. */
function isLibraryVisibleToOrg(
  library: ComponentTemplateLibrary,
  orgId: string,
) {
  return (
    library.organizationId === orgId || library.isPublic || library.isDefault
  );
}

export const libraryRoutes: FastifyPluginAsync = async (fastify) => {
  /** GET /api/organizations/:orgId/component-templates - List libraries */
  fastify.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/component-templates",
    routeAuthz({ org: "VIEWER" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isMemberOfOrganization(user.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();

      // Get org libraries + public libraries + default libraries
      const libraries = await prisma.componentTemplateLibrary.findMany({
        where: {
          OR: [
            { organizationId: orgId },
            { isPublic: true },
            { isDefault: true },
          ],
        },
        include: {
          _count: {
            select: { templates: true },
          },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });

      return libraries.map((lib) => ({
        ...lib,
        isOwned: lib.organizationId === orgId,
        templateCount: lib._count.templates,
      }));
    },
  );

  /** GET /api/organizations/:orgId/component-templates/:libraryId - Get single library */
  fastify.get<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/component-templates/:libraryId",
    routeAuthz({ org: "VIEWER" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isMemberOfOrganization(user.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();
      const library = await prisma.componentTemplateLibrary.findUnique({
        where: { id: libraryId },
        include: {
          templates: {
            orderBy: { name: "asc" },
          },
        },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Check access: org owned, public, or default
      if (!isLibraryVisibleToOrg(library, orgId)) {
        return sendNotFound(reply, "Library");
      }

      return {
        ...library,
        isOwned: library.organizationId === orgId,
        templates: library.templates.map(serializeTemplate),
      };
    },
  );

  /** POST /api/organizations/:orgId/component-templates - Create library */
  fastify.post<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/component-templates",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const parsed = CreateLibrarySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const prisma = await getPrisma();
      const library = await prisma.componentTemplateLibrary.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          isPublic: parsed.data.isPublic || false,
          organizationId: orgId,
        },
      });

      return sendCreated(reply, library);
    },
  );

  /** PATCH /api/organizations/:orgId/component-templates/:libraryId - Update library */
  fastify.patch<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/component-templates/:libraryId",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const parsed = UpdateLibrarySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const prisma = await getPrisma();
      const existing = await prisma.componentTemplateLibrary.findUnique({
        where: { id: libraryId },
      });
      if (!existing || existing.organizationId !== orgId) {
        return sendNotFound(reply, "Library");
      }

      if (existing.isDefault) {
        return sendForbidden(reply, "Cannot modify default library");
      }

      const library = await prisma.componentTemplateLibrary.update({
        where: { id: libraryId },
        data: parsed.data,
      });

      return library;
    },
  );

  /** DELETE /api/organizations/:orgId/component-templates/:libraryId - Delete library */
  fastify.delete<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/component-templates/:libraryId",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const existing = await prisma.componentTemplateLibrary.findUnique({
        where: { id: libraryId },
      });
      if (!existing || existing.organizationId !== orgId) {
        return sendNotFound(reply, "Library");
      }

      if (existing.isDefault) {
        return sendForbidden(reply, "Cannot delete default library");
      }

      await prisma.componentTemplateLibrary.delete({
        where: { id: libraryId },
      });
      return sendNoContent(reply);
    },
  );

  /** POST /api/organizations/:orgId/component-templates/import - Import library */
  fastify.post<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/component-templates/import",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const parsed = ImportLibrarySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const prisma = await getPrisma();

      // Create library with templates in a transaction
      const library = await prisma.$transaction(async (tx) => {
        const lib = await tx.componentTemplateLibrary.create({
          data: {
            name: parsed.data.name,
            description: parsed.data.description,
            organizationId: orgId,
          },
        });

        await tx.componentTemplate.createMany({
          data: parsed.data.templates.map((t) => ({
            name: t.name,
            description: t.description,
            componentType: t.componentType as ComponentType,
            icon: t.icon,
            color: t.color,
            defaultProperties: JSON.stringify(t.defaultProperties || {}),
            suggestedThreats: JSON.stringify(t.suggestedThreats || []),
            tags: JSON.stringify(t.tags || []),
            libraryId: lib.id,
          })),
        });

        return tx.componentTemplateLibrary.findUnique({
          where: { id: lib.id },
          include: { templates: true },
        });
      });

      return sendCreated(reply, {
        ...library,
        templates: library?.templates.map(serializeTemplate),
      });
    },
  );

  /** GET /api/organizations/:orgId/component-templates/:libraryId/export - Export library */
  fastify.get<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/component-templates/:libraryId/export",
    routeAuthz({ org: "VIEWER" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isMemberOfOrganization(user.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();
      const library = await prisma.componentTemplateLibrary.findUnique({
        where: { id: libraryId },
        include: { templates: true },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Check access
      if (!isLibraryVisibleToOrg(library, orgId)) {
        return sendNotFound(reply, "Library");
      }

      // Return in import format
      return {
        name: library.name,
        description: library.description,
        templates: library.templates.map((t) => ({
          name: t.name,
          description: t.description,
          componentType: t.componentType,
          icon: t.icon,
          color: t.color,
          defaultProperties: JSON.parse(t.defaultProperties),
          suggestedThreats: JSON.parse(t.suggestedThreats),
          tags: JSON.parse(t.tags),
        })),
      };
    },
  );
};
