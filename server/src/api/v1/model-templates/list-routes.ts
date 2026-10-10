/**
 * Model Templates List Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, checkOrganizationAccess } from "../helpers.js";
import type { ListTemplatesQuery } from "./schemas.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
} from "../../../utils/api-response.js";

export const listRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /model-templates
   * List available model templates (user's orgs + public)
   */
  server.get<{ Querystring: ListTemplatesQuery }>(
    "/model-templates",
    {
      config: { authz: "authenticated" },
      schema: {
        tags: ["Model Templates"],
        summary: "List model templates",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const {
        category,
        search,
        publicOnly,
        limit = "20",
        offset = "0",
      } = request.query;

      const memberships = await prisma.membership.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { organizationId: true },
      });
      const orgIds = memberships.map((m) => m.organizationId);

      const where: Record<string, unknown> = {};

      if (publicOnly === "true") {
        where.isPublic = true;
      } else {
        where.OR = [{ organizationId: { in: orgIds } }, { isPublic: true }];
      }

      if (category) {
        where.category = category;
      }
      if (search) {
        where.AND = [
          where.OR ? { OR: where.OR } : {},
          {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          },
        ];
        delete where.OR;
      }

      const [templates, total] = await Promise.all([
        prisma.modelTemplate.findMany({
          where,
          include: {
            createdBy: { select: { name: true, email: true } },
            organization: { select: { name: true, slug: true } },
          },
          take: parseInt(limit),
          skip: parseInt(offset),
          orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        }),
        prisma.modelTemplate.count({ where }),
      ]);

      return sendSuccess(reply, {
        data: templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          tags: JSON.parse(t.tags),
          thumbnail: t.thumbnail,
          isPublic: t.isPublic,
          usageCount: t.usageCount,
          createdBy: t.createdBy,
          organization: t.organization,
          createdAt: t.createdAt.toISOString(),
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + templates.length < total,
        },
      });
    },
  );

  /**
   * GET /model-templates/:id
   * Get a specific model template
   */
  server.get<{ Params: { id: string } }>(
    "/model-templates/:id",
    {
      config: {
        authz: {
          handler:
            "public templates for any signed-in user; private ones need ACTIVE membership of the template's org",
        },
      },
      schema: {
        tags: ["Model Templates"],
        summary: "Get model template details",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;

      const template = await prisma.modelTemplate.findUnique({
        where: { id },
        include: {
          createdBy: { select: { name: true, email: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!template) {
        return sendNotFound(reply, "Template");
      }

      if (!template.isPublic && template.organizationId) {
        const access = await checkOrganizationAccess(
          user.id,
          template.organizationId,
        );
        if (!access) {
          return sendForbidden(reply);
        }
      }

      return sendSuccess(reply, {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: JSON.parse(template.tags),
        thumbnail: template.thumbnail,
        canvasState: JSON.parse(template.canvasState),
        components: JSON.parse(template.components),
        boundaries: JSON.parse(template.boundaries),
        threats: JSON.parse(template.threats),
        isPublic: template.isPublic,
        usageCount: template.usageCount,
        createdBy: template.createdBy,
        organization: template.organization,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      });
    },
  );

  /**
   * GET /model-templates/categories
   * List available template categories
   */
  server.get(
    "/model-templates/categories",
    {
      config: {
        authz: {
          handler:
            "counts public templates and the caller's ACTIVE orgs' templates only",
        },
      },
      schema: {
        tags: ["Model Templates"],
        summary: "List template categories",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const memberships = await prisma.membership.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { organizationId: true },
      });
      // Same visibility as the template list: public plus the caller's orgs.
      const categories = await prisma.modelTemplate.groupBy({
        by: ["category"],
        where: {
          category: { not: null },
          OR: [
            {
              organizationId: { in: memberships.map((m) => m.organizationId) },
            },
            { isPublic: true },
          ],
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });

      return sendSuccess(
        reply,
        categories
          .filter((c) => c.category)
          .map((c) => ({
            name: c.category,
            count: c._count.id,
          })),
      );
    },
  );
};
