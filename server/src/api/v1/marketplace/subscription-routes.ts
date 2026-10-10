/**
 * Marketplace Subscription Routes
 *
 * Organization-specific routes for managing library subscriptions.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, checkOrganizationAccess, logAudit } from "../helpers.js";
import { SubscribeBodySchema, type SubscribeInput } from "./schemas.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendConflict,
  sendNoContent,
} from "../../../utils/api-response.js";

export const subscriptionRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /subscriptions
   * List organization's library subscriptions
   */
  server.get<{ Params: { orgId: string } }>(
    "/:orgId/marketplace/subscriptions",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "List organization subscriptions",
      },
      config: { authz: { org: "VIEWER" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply);
      }

      const subscriptions = await prisma.librarySubscription.findMany({
        where: { subscriberOrgId: orgId, libraryType: "MITIGATION_LIBRARY" },
        orderBy: { createdAt: "desc" },
      });

      const data = await Promise.all(
        subscriptions.map(async (sub) => {
          const library = await prisma.mitigationLibrary.findUnique({
            where: { id: sub.libraryId },
            include: {
              organization: { select: { name: true } },
              _count: { select: { templates: true } },
            },
          });

          return {
            id: sub.id,
            libraryId: sub.libraryId,
            organizationId: sub.subscriberOrgId,
            subscribedAt: sub.createdAt.toISOString(),
            library: library
              ? {
                  id: library.id,
                  name: library.name,
                  description: library.description,
                  templateCount: library._count.templates,
                  organization: {
                    name: library.organization?.name ?? "Unknown",
                  },
                }
              : null,
          };
        }),
      );

      return sendSuccess(reply, {
        data: data.filter((d) => d.library !== null),
      });
    },
  );

  /**
   * POST /subscriptions
   * Subscribe to a library
   */
  server.post<{ Params: { orgId: string }; Body: SubscribeInput }>(
    "/:orgId/marketplace/subscriptions",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Subscribe to a library",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;
      const body = SubscribeBodySchema.parse(request.body);

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const library = await prisma.mitigationLibrary.findFirst({
        where: { id: body.libraryId, isPublic: true },
        include: {
          organization: { select: { name: true } },
          _count: { select: { templates: true } },
        },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      const existing = await prisma.librarySubscription.findFirst({
        where: {
          subscriberOrgId: orgId,
          libraryType: "MITIGATION_LIBRARY",
          libraryId: body.libraryId,
        },
      });

      if (existing) {
        return sendConflict(reply, "Already subscribed", {
          subscriptionId: existing.id,
        });
      }

      const subscription = await prisma.librarySubscription.create({
        data: {
          subscriberOrgId: orgId,
          libraryType: "MITIGATION_LIBRARY",
          libraryId: body.libraryId,
          autoUpdate: body.autoUpdate,
          lastSyncedVersion: "1.0.0",
          lastSyncedAt: new Date(),
        },
      });

      await prisma.libraryUsageEvent.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          libraryType: "MITIGATION_LIBRARY",
          libraryId: body.libraryId,
          eventType: "CLONE",
          metadata: JSON.stringify({ subscriptionId: subscription.id }),
        },
      });

      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "THREAT_LIBRARY",
        resourceId: subscription.id,
        resourceName: `Subscription:${library.name}`,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "marketplace_subscribe", libraryId: body.libraryId },
      });

      return sendCreated(reply, {
        id: subscription.id,
        libraryId: subscription.libraryId,
        organizationId: subscription.subscriberOrgId,
        subscribedAt: subscription.createdAt.toISOString(),
        library: {
          id: library.id,
          name: library.name,
          description: library.description,
          templateCount: library._count.templates,
          organization: { name: library.organization?.name ?? "Unknown" },
        },
      });
    },
  );

  /**
   * DELETE /subscriptions/:id
   * Unsubscribe from a library
   */
  server.delete<{ Params: { orgId: string; id: string } }>(
    "/:orgId/marketplace/subscriptions/:id",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Unsubscribe from library",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, id } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const subscription = await prisma.librarySubscription.findFirst({
        where: { id, subscriberOrgId: orgId },
      });

      if (!subscription) {
        return sendNotFound(reply, "Subscription");
      }

      await prisma.librarySubscription.delete({ where: { id } });

      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "THREAT_LIBRARY",
        resourceId: id,
        resourceName: `Subscription:${subscription.libraryId}`,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "marketplace_unsubscribe" },
      });

      return sendNoContent(reply);
    },
  );
};
