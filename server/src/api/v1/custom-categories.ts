/**
 * Custom Threat Categories API (v1)
 *
 * Allows organizations to create custom threat categorization taxonomies.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../db.js";
import { getAuthUser, checkOrganizationAccess, logAudit } from "./helpers.js";
import {
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendNoContent,
  sendConflict,
} from "../../utils/api-response.js";

// Validation schemas
const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const customCategoryRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /:orgId/custom-categories
   * List all custom threat categories for an organization
   */
  server.get<{ Params: { orgId: string } }>(
    "/:orgId/custom-categories",
    {
      schema: {
        tags: ["Custom Categories"],
        summary: "List custom threat categories",
      },
      config: { authz: { org: "VIEWER" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      // Check access
      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply, "Access denied");
      }

      const categories = await prisma.customThreatCategory.findMany({
        where: { organizationId: orgId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      return {
        data: categories.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      };
    },
  );

  /**
   * POST /:orgId/custom-categories
   * Create a new custom threat category
   */
  server.post<{
    Params: { orgId: string };
    Body: z.infer<typeof CreateCategorySchema>;
  }>(
    "/:orgId/custom-categories",
    {
      schema: {
        tags: ["Custom Categories"],
        summary: "Create custom threat category",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;
      const body = CreateCategorySchema.parse(request.body);

      // Check access (need ADMIN or OWNER)
      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      // Check for duplicate name
      const existing = await prisma.customThreatCategory.findFirst({
        where: { organizationId: orgId, name: body.name },
      });
      if (existing) {
        return sendConflict(reply, "Category with this name already exists");
      }

      const category = await prisma.customThreatCategory.create({
        data: {
          organizationId: orgId,
          name: body.name,
          description: body.description,
          color: body.color,
          icon: body.icon,
          sortOrder: body.sortOrder ?? 0,
          createdById: user.id,
        },
      });

      // Audit log
      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "THREAT_LIBRARY",
        resourceId: category.id,
        resourceName: category.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "custom_category" },
      });

      return sendCreated(reply, {
        ...category,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      });
    },
  );

  /**
   * PUT /:orgId/custom-categories/:id
   * Update a custom threat category
   */
  server.patch<{
    Params: { orgId: string; id: string };
    Body: z.infer<typeof UpdateCategorySchema>;
  }>(
    "/:orgId/custom-categories/:id",
    {
      schema: {
        tags: ["Custom Categories"],
        summary: "Update custom threat category",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, id } = request.params;
      const body = UpdateCategorySchema.parse(request.body);

      // Check access
      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      // Check category exists
      const existing = await prisma.customThreatCategory.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!existing) {
        return sendNotFound(reply, "Category");
      }

      // Check for duplicate name if changing
      if (body.name && body.name !== existing.name) {
        const duplicate = await prisma.customThreatCategory.findFirst({
          where: { organizationId: orgId, name: body.name, id: { not: id } },
        });
        if (duplicate) {
          return reply
            .status(409)
            .send({ error: "Category with this name already exists" });
        }
      }

      const category = await prisma.customThreatCategory.update({
        where: { id },
        data: body,
      });

      // Audit log
      await logAudit({
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "THREAT_LIBRARY",
        resourceId: category.id,
        resourceName: category.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "custom_category", changes: body },
      });

      return {
        ...category,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      };
    },
  );

  /**
   * DELETE /:orgId/custom-categories/:id
   * Delete a custom threat category
   */
  server.delete<{ Params: { orgId: string; id: string } }>(
    "/:orgId/custom-categories/:id",
    {
      schema: {
        tags: ["Custom Categories"],
        summary: "Delete custom threat category",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, id } = request.params;

      // Check access
      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      // Check category exists
      const existing = await prisma.customThreatCategory.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!existing) {
        return sendNotFound(reply, "Category");
      }

      await prisma.customThreatCategory.delete({ where: { id } });

      // Audit log
      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "THREAT_LIBRARY",
        resourceId: id,
        resourceName: existing.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "custom_category" },
      });

      return sendNoContent(reply);
    },
  );

  /**
   * POST /:orgId/custom-categories/reorder
   * Reorder custom threat categories
   */
  server.post<{
    Params: { orgId: string };
    Body: { categoryIds: string[] };
  }>(
    "/:orgId/custom-categories/reorder",
    {
      schema: {
        tags: ["Custom Categories"],
        summary: "Reorder custom threat categories",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;
      const { categoryIds } = request.body;

      // Check access
      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      // Update sort order for each category
      await Promise.all(
        categoryIds.map((id, index) =>
          prisma.customThreatCategory.updateMany({
            where: { id, organizationId: orgId },
            data: { sortOrder: index },
          }),
        ),
      );

      return { success: true };
    },
  );
};
