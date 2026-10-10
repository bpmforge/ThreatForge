/**
 * Marketplace Publish Routes
 *
 * Routes for publishing libraries to the marketplace.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, checkOrganizationAccess, logAudit } from "../helpers.js";
import { PublishLibrarySchema, type PublishLibraryInput } from "./schemas.js";
import {
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendConflict,
} from "../../../utils/api-response.js";

export const publishRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /publish
   * Publish a library to the marketplace
   */
  server.post<{ Body: PublishLibraryInput }>(
    "/publish",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        tags: ["Marketplace"],
        summary: "Publish library to marketplace",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = PublishLibrarySchema.parse(request.body);

      const access = await checkOrganizationAccess(
        user.id,
        body.organizationId,
      );
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      // Verify library exists and belongs to org
      const libraryExists = await verifyLibraryOwnership(prisma, body);

      if (!libraryExists) {
        return sendNotFound(reply, "Library");
      }

      // Check for existing publication
      const existing = await prisma.libraryPublication.findFirst({
        where: {
          sourceOrgId: body.organizationId,
          libraryType: body.libraryType,
          libraryId: body.libraryId,
          targetOrgId: body.targetOrgId ?? null,
          status: { in: ["PENDING", "APPROVED"] },
        },
      });

      if (existing) {
        return sendConflict(reply, "Publication already exists", {
          publicationId: existing.id,
          status: existing.status,
        });
      }

      // Create publication request - auto-approve for public marketplace
      const isAutoApproved = !body.targetOrgId;

      const publication = await prisma.libraryPublication.create({
        data: {
          libraryType: body.libraryType,
          libraryId: body.libraryId,
          sourceOrgId: body.organizationId,
          targetOrgId: body.targetOrgId,
          version: body.version,
          changelog: body.changelog,
          status: isAutoApproved ? "APPROVED" : "PENDING",
          requestedById: user.id,
          approvedById: isAutoApproved ? user.id : undefined,
          approvedAt: isAutoApproved ? new Date() : undefined,
        },
      });

      // Update library public flag if publishing to marketplace
      if (isAutoApproved && !body.targetOrgId) {
        await setLibraryPublic(prisma, body.libraryType, body.libraryId);
      }

      await logAudit({
        scope: "ORGANIZATION",
        action: "SHARE" as const,
        resourceType: "THREAT_LIBRARY",
        resourceId: publication.id,
        resourceName: `${body.libraryType}:${body.libraryId}`,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: body.organizationId,
        metadata: {
          type: "marketplace_publish",
          libraryType: body.libraryType,
          version: body.version,
          isPublic: !body.targetOrgId,
        },
      });

      return sendCreated(reply, {
        id: publication.id,
        status: publication.status,
        version: publication.version,
        message: isAutoApproved
          ? "Library published to marketplace"
          : "Publication request submitted for review",
      });
    },
  );
};

async function verifyLibraryOwnership(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  body: PublishLibraryInput,
): Promise<boolean> {
  switch (body.libraryType) {
    case "THREAT_LIBRARY":
      return !!(await prisma.threatLibrary.findFirst({
        where: { id: body.libraryId, organizationId: body.organizationId },
      }));
    case "MITIGATION_LIBRARY":
      return !!(await prisma.mitigationLibrary.findFirst({
        where: { id: body.libraryId, organizationId: body.organizationId },
      }));
    case "COMPONENT_TEMPLATE_LIBRARY":
      return !!(await prisma.componentTemplateLibrary.findFirst({
        where: { id: body.libraryId, organizationId: body.organizationId },
      }));
    case "MODEL_TEMPLATE":
      return !!(await prisma.modelTemplate.findFirst({
        where: { id: body.libraryId, organizationId: body.organizationId },
      }));
    default:
      return false;
  }
}

async function setLibraryPublic(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  libraryType: string,
  libraryId: string,
): Promise<void> {
  switch (libraryType) {
    case "THREAT_LIBRARY":
      await prisma.threatLibrary.update({
        where: { id: libraryId },
        data: { isPublic: true },
      });
      break;
    case "MITIGATION_LIBRARY":
      await prisma.mitigationLibrary.update({
        where: { id: libraryId },
        data: { isPublic: true },
      });
      break;
    case "COMPONENT_TEMPLATE_LIBRARY":
      await prisma.componentTemplateLibrary.update({
        where: { id: libraryId },
        data: { isPublic: true },
      });
      break;
    case "MODEL_TEMPLATE":
      await prisma.modelTemplate.update({
        where: { id: libraryId },
        data: { isPublic: true },
      });
      break;
  }
}
