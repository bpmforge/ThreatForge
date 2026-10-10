/**
 * Threat Library API - Import/Export Routes
 *
 * Org-scoped and convenience (auto-detect org) import/export operations.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { getPrisma } from "../../../db.js";
import type {
  StrideCategory,
  Severity,
  ThreatLibrary,
  ThreatTemplate,
} from "@prisma/client";
import {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} from "../../../utils/api-response.js";
import {
  getAuthUser,
  isMemberOfOrganization,
  isOrgAdmin,
  getUserOrganizationIds,
  getUserSingleOrganization,
} from "../helpers.js";
import { ImportLibrarySchema } from "../schemas.js";
import { serializeThreatTemplate } from "./templates.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_MEMBER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });
const SINGLE_ORG_ADMIN = routeAuthz({
  handler:
    "ACTIVE ADMIN/OWNER of the caller's only ACTIVE org (400 when the caller has zero or several)",
});
const LIBRARY_READER = routeAuthz({
  handler:
    "library is public or default, or belongs to an org where the caller is an ACTIVE member",
});

/** Validate the body and create a library with its templates in one transaction. */
async function importLibrary(
  reply: FastifyReply,
  body: unknown,
  orgId: string,
) {
  const parsed = ImportLibrarySchema.safeParse(body);
  if (!parsed.success) {
    return sendBadRequest(reply, "Validation failed");
  }

  const prisma = await getPrisma();

  // Create library with templates in a transaction
  const library = await prisma.$transaction(async (tx) => {
    const lib = await tx.threatLibrary.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        organizationId: orgId,
      },
    });

    await tx.threatTemplate.createMany({
      data: parsed.data.templates.map((t) => ({
        name: t.name,
        description: t.description,
        strideCategory: t.strideCategory as StrideCategory,
        defaultSeverity: (t.defaultSeverity as Severity) || "MEDIUM",
        applicableComponentTypes: JSON.stringify(
          t.applicableComponentTypes || [],
        ),
        suggestedMitigations: JSON.stringify(t.suggestedMitigations || []),
        complianceControls: JSON.stringify(t.complianceControls || {}),
        cweIds: JSON.stringify(t.cweIds || []),
        owaspIds: JSON.stringify(t.owaspIds || []),
        libraryId: lib.id,
      })),
    });

    return tx.threatLibrary.findUnique({
      where: { id: lib.id },
      include: { templates: true },
    });
  });

  return sendCreated(reply, {
    ...library,
    templates: library?.templates.map(serializeThreatTemplate),
  });
}

/** Library in import format. */
function toExportFormat(
  library: ThreatLibrary & { templates: ThreatTemplate[] },
) {
  return {
    name: library.name,
    description: library.description,
    templates: library.templates.map((t) => ({
      name: t.name,
      description: t.description,
      strideCategory: t.strideCategory,
      defaultSeverity: t.defaultSeverity,
      applicableComponentTypes: JSON.parse(t.applicableComponentTypes),
      suggestedMitigations: JSON.parse(t.suggestedMitigations),
      complianceControls: JSON.parse(t.complianceControls),
      cweIds: JSON.parse(t.cweIds),
      owaspIds: JSON.parse(t.owaspIds),
    })),
  };
}

export const importExportRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // Org-scoped routes
  // ===========================================================================

  /** POST /api/organizations/:orgId/threat-libraries/import - Import library */
  fastify.post<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/threat-libraries/import",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      return importLibrary(reply, request.body, orgId);
    },
  );

  /** GET /api/organizations/:orgId/threat-libraries/:libraryId/export - Export library */
  fastify.get<{ Params: { orgId: string; libraryId: string } }>(
    "/api/organizations/:orgId/threat-libraries/:libraryId/export",
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
        include: { templates: true },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Check access
      if (
        library.organizationId !== orgId &&
        !library.isPublic &&
        !library.isDefault
      ) {
        return sendNotFound(reply, "Library");
      }

      // Return in import format
      return toExportFormat(library);
    },
  );

  // ===========================================================================
  // Convenience routes (auto-detect user's organization)
  // ===========================================================================

  /** POST /api/threat-libraries/import - Import library (auto-select org) */
  fastify.post(
    "/api/threat-libraries/import",
    SINGLE_ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const orgId = await getUserSingleOrganization(user.id);

      if (!orgId) {
        return sendBadRequest(
          reply,
          "Cannot auto-select organization. Please use /api/organizations/:orgId/threat-libraries/import",
        );
      }

      if (!(await isOrgAdmin(user.id, orgId))) {
        return sendForbidden(reply, "Admin access required");
      }

      return importLibrary(reply, request.body, orgId);
    },
  );

  /** GET /api/threat-libraries/:libraryId/export - Export library */
  fastify.get<{ Params: { libraryId: string } }>(
    "/api/threat-libraries/:libraryId/export",
    LIBRARY_READER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { libraryId } = request.params;
      const userOrgIds = await getUserOrganizationIds(user.id);

      const prisma = await getPrisma();
      const library = await prisma.threatLibrary.findUnique({
        where: { id: libraryId },
        include: { templates: true },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Check access
      const hasAccess =
        (library.organizationId &&
          userOrgIds.includes(library.organizationId)) ||
        library.isPublic ||
        library.isDefault;

      if (!hasAccess) {
        return sendNotFound(reply, "Library");
      }

      return toExportFormat(library);
    },
  );
};
