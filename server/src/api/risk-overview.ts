/**
 * Organization Risk Overview API
 *
 * Aggregates threat data across ALL projects in an organization
 * for CISO-level risk visibility.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { sendSuccess, sendForbidden } from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });

export const riskOverviewRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/organizations/:orgId/risk-overview
   *
   * Returns aggregated risk metrics across all projects:
   * - Total threats by severity
   * - Mitigation rate
   * - Projects ranked by risk
   * - STRIDE category breakdown
   * - Trend (improving/stable/worsening)
   */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/risk-overview",
    ORG_VIEWER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { orgId } = request.params;

      // Verify membership
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId: orgId, status: "ACTIVE" },
      });
      if (!membership) {
        return sendForbidden(reply, "Not a member of this organization");
      }

      // Get all projects in org
      const projects = await prisma.project.findMany({
        where: { organizationId: orgId },
        include: {
          threatModels: {
            include: {
              threats: {
                select: {
                  id: true,
                  severity: true,
                  status: true,
                  strideCategories: true,
                  createdAt: true,
                  mitigations: {
                    select: { status: true },
                  },
                },
              },
            },
          },
        },
      });

      // Aggregate threats across all projects
      const allThreats = projects.flatMap((p) =>
        p.threatModels.flatMap((m) => m.threats),
      );

      // Severity breakdown
      const bySeverity = {
        CRITICAL: allThreats.filter((t) => t.severity === "CRITICAL").length,
        HIGH: allThreats.filter((t) => t.severity === "HIGH").length,
        MEDIUM: allThreats.filter((t) => t.severity === "MEDIUM").length,
        LOW: allThreats.filter((t) => t.severity === "LOW").length,
        INFO: allThreats.filter((t) => t.severity === "INFO").length,
      };

      // Status breakdown
      const byStatus = {
        OPEN: allThreats.filter((t) => t.status === "OPEN").length,
        MITIGATED: allThreats.filter((t) => t.status === "MITIGATED").length,
        ACCEPTED: allThreats.filter((t) => t.status === "ACCEPTED").length,
        NOT_APPLICABLE: allThreats.filter((t) => t.status === "NOT_APPLICABLE")
          .length,
      };

      // Mitigation rate
      const totalThreats = allThreats.length;
      const mitigatedOrAccepted =
        byStatus.MITIGATED + byStatus.ACCEPTED + byStatus.NOT_APPLICABLE;
      const mitigationRate =
        totalThreats > 0
          ? Math.round((mitigatedOrAccepted / totalThreats) * 100)
          : 100;

      // STRIDE breakdown
      const byStride: Record<string, number> = {};
      for (const threat of allThreats) {
        try {
          const categories = JSON.parse(threat.strideCategories) as string[];
          for (const cat of categories) {
            byStride[cat] = (byStride[cat] || 0) + 1;
          }
        } catch {
          // parse fallback — intentionally silent
        }
      }

      // Risk score per project
      const SEVERITY_WEIGHTS = {
        CRITICAL: 10,
        HIGH: 7,
        MEDIUM: 4,
        LOW: 1,
        INFO: 0,
      };
      const projectRisk = projects
        .map((project) => {
          const threats = project.threatModels.flatMap((m) => m.threats);
          const riskScore = threats.reduce((sum, t) => {
            const weight =
              SEVERITY_WEIGHTS[t.severity as keyof typeof SEVERITY_WEIGHTS] ||
              0;
            const mitigated = t.status !== "OPEN" ? 0.3 : 1; // Mitigated threats count 30%
            return sum + weight * mitigated;
          }, 0);

          return {
            id: project.id,
            name: project.name,
            modelCount: project.threatModels.length,
            threatCount: threats.length,
            openThreats: threats.filter((t) => t.status === "OPEN").length,
            criticalCount: threats.filter(
              (t) => t.severity === "CRITICAL" && t.status === "OPEN",
            ).length,
            riskScore: Math.round(riskScore),
            lastUpdated: project.updatedAt,
          };
        })
        .sort((a, b) => b.riskScore - a.riskScore);

      // Trend (based on mitigation rate)
      const trend =
        mitigationRate > 70
          ? "improving"
          : mitigationRate > 30
            ? "stable"
            : "worsening";

      return sendSuccess(reply, {
        summary: {
          totalProjects: projects.length,
          totalModels: projects.reduce((s, p) => s + p.threatModels.length, 0),
          totalThreats,
          openThreats: byStatus.OPEN,
          mitigationRate,
          trend,
        },
        bySeverity,
        byStatus,
        byStride,
        projectRisk,
      });
    },
  );
};
