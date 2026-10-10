/**
 * Organization Settings Routes
 *
 * PATCH update organization settings, POST transfer ownership.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import {
  getUserRole,
  UpdateOrganizationSchema,
  TransferOwnershipSchema,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_OWNER = routeAuthz({ org: "OWNER" });

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * PATCH /api/organizations/:id
   * Update organization settings (requires OWNER or ADMIN role)
   */
  fastify.patch<{ Params: { id: string } }>(
    "/api/organizations/:id",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // Check role - must be OWNER or ADMIN
      const role = await getUserRole(user.id, id);
      if (!role || (role !== "OWNER" && role !== "ADMIN")) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      const parseResult = UpdateOrganizationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parseResult.error.flatten(),
        });
      }

      const {
        name,
        description,
        settings,
        allowGuestAccess,
        guestDefaultRole,
        allowGuestExport,
        threatMethodology,
      } = parseResult.data;

      // Check if this is a personal org - some fields cannot be changed
      const existingOrg = await prisma.organization.findUnique({
        where: { id },
        select: { isPersonal: true, name: true, settings: true },
      });

      if (!existingOrg) {
        return sendNotFound(reply, "Organization");
      }

      // Personal orgs have restrictions
      if (existingOrg.isPersonal && name && name !== existingOrg.name) {
        return sendBadRequest(reply, "Cannot rename personal organization");
      }

      let existingBranding: unknown;
      try {
        existingBranding = (
          JSON.parse(existingOrg.settings || "{}") as { branding?: unknown }
        ).branding;
      } catch {
        // corrupt stored settings — nothing to preserve
      }

      const updated = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.update({
          where: { id },
          data: {
            ...(name && !existingOrg.isPersonal && { name }),
            ...(description !== undefined && { description }),
            ...(settings && {
              // branding is owned by PUT /branding; a generic settings write must not wipe it
              settings: JSON.stringify({
                ...settings,
                ...(existingBranding ? { branding: existingBranding } : {}),
              }),
            }),
            ...(allowGuestAccess !== undefined && { allowGuestAccess }),
            ...(guestDefaultRole && { guestDefaultRole }),
            ...(allowGuestExport !== undefined && { allowGuestExport }),
            ...(threatMethodology && { threatMethodology }),
          },
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
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            scope: "ORGANIZATION",
            action: "UPDATE",
            resourceType: "ORGANIZATION",
            resourceId: id,
            resourceName: org.name,
            userId: user.id,
            userEmail: user.email || "unknown",
            organizationId: id,
            changes: JSON.stringify({
              ...(name && { name: { old: existingOrg.name, new: name } }),
              ...(description !== undefined && {
                description: { new: description },
              }),
              ...(allowGuestAccess !== undefined && {
                allowGuestAccess: { new: allowGuestAccess },
              }),
              ...(guestDefaultRole && {
                guestDefaultRole: { new: guestDefaultRole },
              }),
              ...(allowGuestExport !== undefined && {
                allowGuestExport: { new: allowGuestExport },
              }),
              ...(threatMethodology && {
                threatMethodology: { new: threatMethodology },
              }),
            }),
          },
        });

        return org;
      });

      return sendSuccess(reply, {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        type: updated.type,
        isPersonal: updated.isPersonal,
        allowGuestAccess: updated.allowGuestAccess,
        guestDefaultRole: updated.guestDefaultRole,
        allowGuestExport: updated.allowGuestExport,
        threatMethodology: updated.threatMethodology,
        settings: updated.settings ? JSON.parse(updated.settings) : {},
        memberships: updated.memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          user: m.user,
          createdAt: m.createdAt.toISOString(),
        })),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    },
  );

  /**
   * POST /api/organizations/:id/transfer-ownership
   * Transfer ownership to another member (requires OWNER role)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/organizations/:id/transfer-ownership",
    ORG_OWNER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // Check role - must be OWNER to transfer
      const role = await getUserRole(user.id, id);
      if (role !== "OWNER") {
        return sendForbidden(
          reply,
          "Only the organization owner can transfer ownership",
        );
      }

      const parseResult = TransferOwnershipSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parseResult.error.flatten(),
        });
      }

      const { newOwnerId } = parseResult.data;

      // Cannot transfer to yourself
      if (newOwnerId === user.id) {
        return sendBadRequest(reply, "You are already the owner");
      }

      // Check new owner is a member
      const newOwnerMembership = await prisma.membership.findFirst({
        where: { userId: newOwnerId, organizationId: id, status: "ACTIVE" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (!newOwnerMembership) {
        return sendBadRequest(
          reply,
          "New owner must be a member of the organization",
        );
      }

      // Get organization
      const org = await prisma.organization.findUnique({
        where: { id },
        select: { id: true, name: true, isPersonal: true },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      // Cannot transfer personal org ownership
      if (org.isPersonal) {
        return sendBadRequest(
          reply,
          "Cannot transfer ownership of a personal organization",
        );
      }

      // Transfer ownership in transaction
      await prisma.$transaction(async (tx) => {
        // Demote current owner to ADMIN
        await tx.membership.update({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: id,
            },
          },
          data: { role: "ADMIN" },
        });

        // Promote new owner
        await tx.membership.update({
          where: {
            userId_organizationId: {
              userId: newOwnerId,
              organizationId: id,
            },
          },
          data: { role: "OWNER" },
        });

        // Update organization ownerId
        await tx.organization.update({
          where: { id },
          data: { ownerId: newOwnerId },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            scope: "ORGANIZATION",
            action: "OWNERSHIP_TRANSFER",
            resourceType: "ORGANIZATION",
            resourceId: id,
            resourceName: org.name,
            userId: user.id,
            userEmail: user.email || "unknown",
            organizationId: id,
            changes: JSON.stringify({
              ownerId: { old: user.id, new: newOwnerId },
            }),
            metadata: JSON.stringify({
              previousOwner: user.id,
              newOwner: newOwnerId,
              newOwnerEmail: newOwnerMembership.user.email,
            }),
          },
        });
      });

      return sendSuccess(reply, {
        success: true,
        message: `Ownership transferred to ${newOwnerMembership.user.name || newOwnerMembership.user.email}`,
        newOwnerId,
      });
    },
  );
};
