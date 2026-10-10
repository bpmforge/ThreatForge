/**
 * Mitigation Template Search Route
 *
 * Cross-library template search endpoint.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../db.js";
import { getAuthUser, checkOrganizationAccess } from "../../helpers.js";
import { sendForbidden } from "../../../../utils/api-response.js";

export const templateSearchRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /mitigation-templates/search
   * Search across all accessible mitigation templates (global endpoint)
   */
  server.post<{
    Body: {
      organizationId: string;
      query?: string;
      strategy?: string;
      threatTypes?: string[];
      frameworks?: string[];
      limit?: number;
    };
  }>(
    "/mitigation-templates/search",
    {
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "Search mitigation templates across libraries",
      },
      config: { authz: { org: "VIEWER" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const {
        organizationId,
        query,
        strategy,
        threatTypes,
        frameworks,
        limit = 50,
      } = request.body;

      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access) {
        return sendForbidden(reply, "Access denied");
      }

      // Get all accessible libraries
      const libraries = await prisma.mitigationLibrary.findMany({
        where: {
          OR: [{ organizationId }, { isPublic: true }, { isDefault: true }],
        },
        select: { id: true },
      });
      const libraryIds = libraries.map((l) => l.id);

      // Build search query
      const where: Record<string, unknown> = { libraryId: { in: libraryIds } };
      if (query) {
        where.OR = [
          { name: { contains: query } },
          { description: { contains: query } },
        ];
      }
      if (strategy) {
        where.strategy = strategy;
      }

      const templates = await prisma.mitigationTemplate.findMany({
        where,
        include: { library: { select: { name: true, isDefault: true } } },
        take: limit,
        orderBy: [{ usageCount: "desc" }, { name: "asc" }],
      });

      // Filter by threat types and frameworks if provided
      let filtered = templates;
      if (threatTypes && threatTypes.length > 0) {
        filtered = filtered.filter((t) => {
          const applicable = JSON.parse(t.applicableThreatTypes) as string[];
          return threatTypes.some((tt) => applicable.includes(tt));
        });
      }
      if (frameworks && frameworks.length > 0) {
        filtered = filtered.filter((t) => {
          const controls = JSON.parse(t.complianceControls) as Record<
            string,
            string[]
          >;
          return frameworks.some(
            (f) => f in controls && controls[f].length > 0,
          );
        });
      }

      return {
        data: filtered.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          strategy: t.strategy,
          effort: t.effort,
          effectiveness: t.effectiveness,
          applicableThreatTypes: JSON.parse(t.applicableThreatTypes),
          complianceControls: JSON.parse(t.complianceControls),
          tags: JSON.parse(t.tags),
          usageCount: t.usageCount,
          library: t.library,
        })),
        total: filtered.length,
      };
    },
  );
};
