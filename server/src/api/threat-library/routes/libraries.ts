/**
 * Threat Library API - Library CRUD Routes
 *
 * Org-scoped and convenience (auto-detect org) library operations.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { ThreatLibrary } from "@prisma/client";
import type { z } from "zod";
import { getPrisma } from "../../../db.js";
import {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendNoContent,
} from "../../../utils/api-response.js";
import {
  getAuthUser,
  isMemberOfOrganization,
  isOrgAdmin,
  getUserOrganizationIds,
  getUserSingleOrganization,
} from "../helpers.js";
import { CreateLibrarySchema, UpdateLibrarySchema } from "../schemas.js";
import { serializeThreatTemplate } from "./templates.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_MEMBER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });
const LIST_OWN_ORGS = routeAuthz({
  handler:
    "caller must hold an ACTIVE membership in at least one org (403 otherwise); lists libraries of the caller's ACTIVE orgs plus public and default libraries",
});
const LIBRARY_READ = routeAuthz({
  handler:
    "library must belong to one of the caller's ACTIVE orgs, or be public or default (404 otherwise)",
});
const CREATE_IN_SOLE_ORG = routeAuthz({
  handler:
    "caller must have exactly one ACTIVE org and be ADMIN or OWNER of it (isActiveOrgAdmin)",
});
const LIBRARY_ORG_ADMIN = routeAuthz({
  handler:
    "ACTIVE ADMIN or OWNER of the library's organization (isActiveOrgAdmin on library.organizationId); default libraries refused",
});

/** Validate the body and create a library owned by `orgId`. */
async function createLibrary(
  reply: FastifyReply,
  body: unknown,
  orgId: string,
) {
  const parsed = CreateLibrarySchema.safeParse(body);
  if (!parsed.success) {
    return sendBadRequest(reply, "Validation failed");
  }

  const prisma = await getPrisma();
  const library = await prisma.threatLibrary.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isPublic: parsed.data.isPublic || false,
      organizationId: orgId,
    },
  });

  return sendCreated(reply, library);
}

/** Update an existing library unless it is a default library. */
async function updateLibrary(
  reply: FastifyReply,
  existing: ThreatLibrary,
  data: z.infer<typeof UpdateLibrarySchema>,
) {
  if (existing.isDefault) {
    return sendForbidden(reply, "Cannot modify default library");
  }

  const prisma = await getPrisma();
  return prisma.threatLibrary.update({
    where: { id: existing.id },
    data,
  });
}

/** Delete an existing library unless it is a default library. */
async function deleteLibrary(reply: FastifyReply, existing: ThreatLibrary) {
  if (existing.isDefault) {
    return sendForbidden(reply, "Cannot delete default library");
  }

  const prisma = await getPrisma();
  await prisma.threatLibrary.delete({ where: { id: existing.id } });
  return sendNoContent(reply);
}

export const libraryRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // Org-scoped routes
  // ===========================================================================

  /** GET /api/organizations/:orgId/threat-libraries - List libraries */
  fastify.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/threat-libraries",
    ORG_MEMBER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isMemberOfOrganization(user.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();

      // Get org libraries + public libraries + default libraries
      const libraries = await prisma.threatLibrary.findMany({
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

  /** GET /api/organizations/:orgId/threat-libraries/:libraryId - Get single library */
  fastify.get<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/threat-libraries/:libraryId",
    ORG_MEMBER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isMemberOfOrganization(user.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prisma = await getPrisma();
      const library = await prisma.threatLibrary.findUnique({
        where: { id: libraryId },
        include: {
          templates: {
            orderBy: { strideCategory: "asc" },
          },
        },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Check access: org owned, public, or default
      if (
        library.organizationId !== orgId &&
        !library.isPublic &&
        !library.isDefault
      ) {
        return sendNotFound(reply, "Library");
      }

      return {
        ...library,
        isOwned: library.organizationId === orgId,
        templates: library.templates.map(serializeThreatTemplate),
      };
    },
  );

  /** POST /api/organizations/:orgId/threat-libraries - Create library */
  fastify.post<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/threat-libraries",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      return createLibrary(reply, request.body, orgId);
    },
  );

  /** PATCH /api/organizations/:orgId/threat-libraries/:libraryId - Update library */
  fastify.patch<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/threat-libraries/:libraryId",
    ORG_ADMIN,
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
      const existing = await prisma.threatLibrary.findUnique({
        where: { id: libraryId },
      });
      if (!existing || existing.organizationId !== orgId) {
        return sendNotFound(reply, "Library");
      }

      return updateLibrary(reply, existing, parsed.data);
    },
  );

  /** DELETE /api/organizations/:orgId/threat-libraries/:libraryId - Delete library */
  fastify.delete<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/threat-libraries/:libraryId",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const prisma = await getPrisma();
      const existing = await prisma.threatLibrary.findUnique({
        where: { id: libraryId },
      });
      if (!existing || existing.organizationId !== orgId) {
        return sendNotFound(reply, "Library");
      }

      return deleteLibrary(reply, existing);
    },
  );

  // ===========================================================================
  // Convenience routes (auto-detect user's organization)
  // ===========================================================================

  /** GET /api/threat-libraries - List all accessible libraries */
  fastify.get(
    "/api/threat-libraries",
    LIST_OWN_ORGS,
    async (request, reply) => {
      const user = getAuthUser(request);
      const userOrgIds = await getUserOrganizationIds(user.id);

      if (userOrgIds.length === 0) {
        return sendForbidden(reply, "User has no organization membership");
      }

      const prisma = await getPrisma();
      const libraries = await prisma.threatLibrary.findMany({
        where: {
          OR: [
            { organizationId: { in: userOrgIds } },
            { isPublic: true },
            { isDefault: true },
          ],
        },
        include: {
          _count: { select: { templates: true } },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });

      return libraries.map((lib) => ({
        ...lib,
        isOwned: lib.organizationId
          ? userOrgIds.includes(lib.organizationId)
          : false,
        templateCount: lib._count.templates,
      }));
    },
  );

  /** GET /api/threat-libraries/:libraryId - Get single library */
  fastify.get<{ Params: { libraryId: string } }>(
    "/api/threat-libraries/:libraryId",
    LIBRARY_READ,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { libraryId } = request.params;
      const userOrgIds = await getUserOrganizationIds(user.id);

      const prisma = await getPrisma();
      const library = await prisma.threatLibrary.findUnique({
        where: { id: libraryId },
        include: {
          templates: { orderBy: { strideCategory: "asc" } },
        },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Check access: user's org, public, or default
      const hasAccess =
        (library.organizationId &&
          userOrgIds.includes(library.organizationId)) ||
        library.isPublic ||
        library.isDefault;

      if (!hasAccess) {
        return sendNotFound(reply, "Library");
      }

      return {
        ...library,
        isOwned: library.organizationId
          ? userOrgIds.includes(library.organizationId)
          : false,
        templates: library.templates.map(serializeThreatTemplate),
      };
    },
  );

  /** POST /api/threat-libraries - Create library (auto-select org) */
  fastify.post(
    "/api/threat-libraries",
    CREATE_IN_SOLE_ORG,
    async (request, reply) => {
      const user = getAuthUser(request);
      const orgId = await getUserSingleOrganization(user.id);

      if (!orgId) {
        return sendBadRequest(
          reply,
          "Cannot auto-select organization. Please use /api/organizations/:orgId/threat-libraries",
        );
      }

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      return createLibrary(reply, request.body, orgId);
    },
  );

  /** PATCH /api/threat-libraries/:libraryId - Update library */
  fastify.patch<{ Params: { libraryId: string } }>(
    "/api/threat-libraries/:libraryId",
    LIBRARY_ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { libraryId } = request.params;

      const parsed = UpdateLibrarySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const prisma = await getPrisma();
      const existing = await prisma.threatLibrary.findUnique({
        where: { id: libraryId },
      });
      if (!existing || !existing.organizationId) {
        return sendNotFound(reply, "Library");
      }

      if (!(await isOrgAdmin(user.id, existing.organizationId))) {
        return sendForbidden(reply, "Admin access required");
      }

      return updateLibrary(reply, existing, parsed.data);
    },
  );

  /** DELETE /api/threat-libraries/:libraryId - Delete library */
  fastify.delete<{ Params: { libraryId: string } }>(
    "/api/threat-libraries/:libraryId",
    LIBRARY_ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { libraryId } = request.params;

      const prisma = await getPrisma();
      const existing = await prisma.threatLibrary.findUnique({
        where: { id: libraryId },
      });
      if (!existing || !existing.organizationId) {
        return sendNotFound(reply, "Library");
      }

      if (!(await isOrgAdmin(user.id, existing.organizationId))) {
        return sendForbidden(reply, "Admin access required");
      }

      return deleteLibrary(reply, existing);
    },
  );
};
