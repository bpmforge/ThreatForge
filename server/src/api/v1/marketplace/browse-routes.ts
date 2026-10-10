/**
 * Marketplace Browse Routes
 *
 * Public routes for browsing libraries, categories, templates, and stats.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import type {
  BrowseQuerystring,
  SimpleQuerystring,
  TemplateQuerystring,
} from "./schemas.js";
import { sendSuccess, sendNotFound } from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { getActiveOrgIds } from "../../../services/access-control/access-control-service.js";

/** Custom categories have no public flag: a caller sees only their own orgs'. */
async function ownCategoriesWhere(userId: string) {
  return {
    isActive: true,
    organizationId: { in: await getActiveOrgIds(userId) },
  };
}

export const browseRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /libraries
   * Browse public mitigation libraries in the marketplace
   */
  server.get<{ Querystring: BrowseQuerystring }>(
    "/libraries",
    {
      config: { authz: "authenticated" },
      schema: {
        tags: ["Marketplace"],
        summary: "Browse public mitigation libraries",
      },
    },
    async (request, reply) => {
      const {
        search,
        limit = "20",
        offset = "0",
        sort = "newest",
        featured,
      } = request.query;

      const whereClause: Record<string, unknown> = { isPublic: true };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      let orderBy: Record<string, string> | Record<string, string>[];
      switch (sort) {
        case "name":
          orderBy = { name: "asc" };
          break;
        case "popular":
        case "newest":
        default:
          orderBy = { createdAt: "desc" };
          break;
      }

      const [libraries, total] = await Promise.all([
        prisma.mitigationLibrary.findMany({
          where: whereClause,
          include: {
            organization: { select: { id: true, name: true } },
            _count: { select: { templates: true } },
          },
          take: sort === "popular" ? 100 : parseInt(limit),
          skip: sort === "popular" ? 0 : parseInt(offset),
          orderBy,
        }),
        prisma.mitigationLibrary.count({ where: whereClause }),
      ]);

      const libraryIds = libraries.map((l) => l.id);
      const subscriptionCounts = await prisma.librarySubscription.groupBy({
        by: ["libraryId"],
        where: {
          libraryId: { in: libraryIds },
          libraryType: "MITIGATION_LIBRARY",
        },
        _count: { libraryId: true },
      });

      const countMap = new Map(
        subscriptionCounts.map((s) => [s.libraryId, s._count.libraryId]),
      );

      let data = libraries.map((lib) => ({
        id: lib.id,
        name: lib.name,
        description: lib.description,
        organizationId: lib.organizationId,
        organizationName: lib.organization?.name ?? "Unknown",
        templateCount: lib._count.templates,
        subscriberCount: countMap.get(lib.id) || 0,
        createdAt: lib.createdAt.toISOString(),
        updatedAt: lib.updatedAt.toISOString(),
      }));

      if (sort === "popular") {
        data.sort((a, b) => b.subscriberCount - a.subscriberCount);
        const offsetNum = parseInt(offset);
        const limitNum = parseInt(limit);
        data = data.slice(offsetNum, offsetNum + limitNum);
      }

      if (featured === "true") {
        data = data.filter(
          (lib) => lib.subscriberCount >= 5 || lib.templateCount >= 10,
        );
      }

      return sendSuccess(reply, { data, total });
    },
  );

  /**
   * GET /libraries/:id
   * Get single library detail
   */
  server.get<{ Params: { id: string } }>(
    "/libraries/:id",
    {
      config: { authz: "authenticated" },
      schema: {
        tags: ["Marketplace"],
        summary: "Get library detail",
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const library = await prisma.mitigationLibrary.findFirst({
        where: { id, isPublic: true },
        include: {
          organization: { select: { id: true, name: true } },
          _count: { select: { templates: true } },
        },
      });

      if (!library) {
        return sendNotFound(reply, "Library");
      }

      const subscriberCount = await prisma.librarySubscription.count({
        where: { libraryId: id, libraryType: "MITIGATION_LIBRARY" },
      });

      return sendSuccess(reply, {
        id: library.id,
        name: library.name,
        description: library.description,
        organizationId: library.organizationId,
        organizationName: library.organization?.name ?? "Unknown",
        templateCount: library._count.templates,
        subscriberCount,
        createdAt: library.createdAt.toISOString(),
        updatedAt: library.updatedAt.toISOString(),
      });
    },
  );

  /**
   * GET /categories
   * Browse public custom threat categories
   */
  server.get<{ Querystring: SimpleQuerystring }>(
    "/categories",
    {
      config: { authz: "authenticated" },
      schema: {
        tags: ["Marketplace"],
        summary: "Browse public categories",
      },
    },
    async (request, reply) => {
      const { search, limit = "50" } = request.query;

      const whereClause: Record<string, unknown> = await ownCategoriesWhere(
        getAuthUser(request).id,
      );

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const categories = await prisma.customThreatCategory.findMany({
        where: whereClause,
        include: {
          organization: { select: { id: true, name: true } },
        },
        take: parseInt(limit),
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      const data = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        color: cat.color,
        icon: cat.icon,
        organizationId: cat.organizationId,
        organizationName: cat.organization?.name ?? "Unknown",
        usageCount: 0,
        createdAt: cat.createdAt.toISOString(),
      }));

      return sendSuccess(reply, { data });
    },
  );

  /**
   * GET /templates
   * Browse public model templates
   */
  server.get<{ Querystring: TemplateQuerystring }>(
    "/templates",
    {
      config: { authz: "authenticated" },
      schema: {
        tags: ["Marketplace"],
        summary: "Browse public model templates",
      },
    },
    async (request, reply) => {
      const { search, limit = "20", sort = "newest" } = request.query;

      const whereClause: Record<string, unknown> = { isPublic: true };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      let orderBy: Record<string, string>;
      switch (sort) {
        case "name":
          orderBy = { name: "asc" };
          break;
        case "popular":
          orderBy = { usageCount: "desc" };
          break;
        case "newest":
        default:
          orderBy = { createdAt: "desc" };
          break;
      }

      const templates = await prisma.modelTemplate.findMany({
        where: whereClause,
        include: {
          organization: { select: { id: true, name: true } },
        },
        take: parseInt(limit),
        orderBy,
      });

      const data = templates.map((tmpl) => {
        let nodeCount = 0;
        let threatCount = 0;

        if (tmpl.canvasState && typeof tmpl.canvasState === "object") {
          const state = tmpl.canvasState as {
            nodes?: unknown[];
            threats?: unknown[];
          };
          nodeCount = Array.isArray(state.nodes) ? state.nodes.length : 0;
          threatCount = Array.isArray(state.threats) ? state.threats.length : 0;
        }

        return {
          id: tmpl.id,
          name: tmpl.name,
          description: tmpl.description,
          organizationId: tmpl.organizationId,
          organizationName: tmpl.organization?.name ?? "Unknown",
          nodeCount,
          threatCount,
          downloads: tmpl.usageCount,
          createdAt: tmpl.createdAt.toISOString(),
        };
      });

      return sendSuccess(reply, { data });
    },
  );

  /**
   * GET /stats
   * Get marketplace statistics
   */
  server.get(
    "/stats",
    {
      config: { authz: "authenticated" },
      schema: {
        tags: ["Marketplace"],
        summary: "Get marketplace statistics",
      },
    },
    async (request, reply) => {
      const categoryWhere = await ownCategoriesWhere(getAuthUser(request).id);
      const [libraryCount, categoryCount, templateCount, totalSubscriptions] =
        await Promise.all([
          prisma.mitigationLibrary.count({ where: { isPublic: true } }),
          prisma.customThreatCategory.count({ where: categoryWhere }),
          prisma.modelTemplate.count({ where: { isPublic: true } }),
          prisma.librarySubscription.count(),
        ]);

      return sendSuccess(reply, {
        libraryCount,
        categoryCount,
        templateCount,
        totalSubscriptions,
      });
    },
  );
};
