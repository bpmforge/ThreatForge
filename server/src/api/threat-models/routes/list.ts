/**
 * Threat Model API - List Route
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser } from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const OWN_ORGS_ONLY = routeAuthz({
  handler: "lists models of the caller's ACTIVE memberships",
});

export const listRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/threat-models
   * List threat models the user has access to
   */
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      projectId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    };
  }>("/api/threat-models", OWN_ORGS_ONLY, async (request) => {
    const user = getAuthUser(request);
    const prisma = await getPrisma();
    const {
      page: pageStr,
      limit: limitStr,
      projectId,
      search,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = request.query;

    const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitStr || "20", 10) || 20),
    );
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      project: {
        ...(projectId && { id: projectId }),
        organization: {
          memberships: { some: { userId: user.id, status: "ACTIVE" } },
        },
      },
    };

    if (search) {
      where.name = { contains: search };
    }

    const orderBy: Record<string, string> = {};
    if (["name", "createdAt", "updatedAt"].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.updatedAt = "desc";
    }

    const [models, total] = await Promise.all([
      prisma.threatModel.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.threatModel.count({ where }),
    ]);

    // Fetch threat counts with a single groupBy instead of loading every threat row
    const modelIds = models.map((m) => m.id);
    const threatGroups =
      modelIds.length > 0
        ? await prisma.threat.groupBy({
            by: ["threatModelId", "status", "severity"],
            where: { threatModelId: { in: modelIds } },
            _count: { id: true },
          })
        : [];

    // Build per-model count map from the flat groupBy result
    type CountMap = {
      total: number;
      open: number;
      mitigated: number;
      critical: number;
      high: number;
    };
    const countByModel = new Map<string, CountMap>();
    for (const g of threatGroups) {
      const entry = countByModel.get(g.threatModelId) ?? {
        total: 0,
        open: 0,
        mitigated: 0,
        critical: 0,
        high: 0,
      };
      const n = g._count.id;
      entry.total += n;
      if (g.status === "OPEN") entry.open += n;
      if (g.status === "MITIGATED") entry.mitigated += n;
      if (g.severity === "CRITICAL") entry.critical += n;
      if (g.severity === "HIGH") entry.high += n;
      countByModel.set(g.threatModelId, entry);
    }

    const totalPages = Math.ceil(total / limit);

    const modelsWithStats = models.map((model) => {
      const c = countByModel.get(model.id) ?? {
        total: 0,
        open: 0,
        mitigated: 0,
        critical: 0,
        high: 0,
      };
      return {
        id: model.id,
        name: model.name,
        version: model.version,
        status: model.status,
        tags: model.tags,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
        project: model.project,
        threatCount: c.total,
        openThreatCount: c.open,
        mitigatedThreatCount: c.mitigated,
        criticalThreatCount: c.critical,
        highThreatCount: c.high,
      };
    });

    return {
      data: modelsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  });
};
