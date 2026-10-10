/**
 * Threat Model API - Stats Route
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, canAccessThreatModel } from "../helpers.js";
import { sendSuccess, sendNotFound } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });

export const statsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/threat-models/:id/stats
   * Get detailed stats for a threat model including STRIDE breakdown
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/stats",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      const model = await prisma.threatModel.findUnique({
        where: { id },
        include: {
          components: true,
          connections: true,
          boundaries: true,
          threats: { include: { mitigations: true } },
        },
      });

      if (!model) {
        return sendNotFound(reply, "Threat model");
      }

      type ParsedThreat = (typeof model.threats)[number] & {
        categories: string[];
      };
      const threatsWithCategories: ParsedThreat[] = model.threats.map((t) => ({
        ...t,
        categories: JSON.parse(t.strideCategories || "[]") as string[],
      }));

      const strideCategories = [
        "SPOOFING",
        "TAMPERING",
        "REPUDIATION",
        "INFORMATION_DISCLOSURE",
        "DENIAL_OF_SERVICE",
        "ELEVATION_OF_PRIVILEGE",
      ];
      const strideBreakdown = strideCategories.map((category) => {
        const categoryThreats = threatsWithCategories.filter((t) =>
          t.categories.includes(category),
        );
        return {
          category,
          total: categoryThreats.length,
          open: categoryThreats.filter((t) => t.status === "OPEN").length,
          inProgress: categoryThreats.filter(
            (t) => t.status === "NOT_APPLICABLE",
          ).length,
          mitigated: categoryThreats.filter((t) => t.status === "MITIGATED")
            .length,
          accepted: categoryThreats.filter((t) => t.status === "ACCEPTED")
            .length,
          bySeverity: {
            critical: categoryThreats.filter((t) => t.severity === "CRITICAL")
              .length,
            high: categoryThreats.filter((t) => t.severity === "HIGH").length,
            medium: categoryThreats.filter((t) => t.severity === "MEDIUM")
              .length,
            low: categoryThreats.filter((t) => t.severity === "LOW").length,
          },
        };
      });

      const totalThreats = model.threats.length;
      const openThreats = model.threats.filter(
        (t) => t.status === "OPEN",
      ).length;
      const inProgressThreats = model.threats.filter(
        (t) => t.status === "NOT_APPLICABLE",
      ).length;
      const mitigatedThreats = model.threats.filter(
        (t) => t.status === "MITIGATED",
      ).length;
      const acceptedThreats = model.threats.filter(
        (t) => t.status === "ACCEPTED",
      ).length;
      const criticalThreats = model.threats.filter(
        (t) => t.severity === "CRITICAL",
      ).length;
      const highThreats = model.threats.filter(
        (t) => t.severity === "HIGH",
      ).length;

      const allMitigations = model.threats.flatMap((t) => t.mitigations);
      const totalMitigations = allMitigations.length;
      const completedMitigations = allMitigations.filter(
        (m) => m.status === "IMPLEMENTED",
      ).length;

      const componentTypes = [
        "SERVICE",
        "API",
        "DATABASE",
        "PROCESS",
        "EXTERNAL_USER",
        "EXTERNAL_SYSTEM",
        "FUNCTION",
        "FILE_STORAGE",
        "CACHE",
        "QUEUE",
        "LOAD_BALANCER",
        "FIREWALL",
        "API_GATEWAY",
      ];
      const componentBreakdown = componentTypes.map((type) => ({
        type,
        count: model.components.filter((c) => c.type === type).length,
      }));

      return sendSuccess(reply, {
        modelId: model.id,
        modelName: model.name,
        version: model.version,
        lastModified: model.updatedAt,
        componentCount: model.components.length,
        connectionCount: model.connections.length,
        boundaryCount: model.boundaries.length,
        totalThreats,
        openThreats,
        inProgressThreats,
        mitigatedThreats,
        acceptedThreats,
        criticalThreats,
        highThreats,
        totalMitigations,
        completedMitigations,
        mitigationProgress:
          totalMitigations > 0
            ? Math.round((completedMitigations / totalMitigations) * 100)
            : 0,
        strideBreakdown,
        componentBreakdown,
        riskScore: Math.min(
          100,
          criticalThreats * 25 + highThreats * 10 + openThreats * 5,
        ),
        // Business-context weighted risk score
        businessRiskScore: (() => {
          // Check if any components have high-value data classifications
          const dataClassifications = model.components
            .map((c) => {
              try {
                const props = c.properties ? JSON.parse(c.properties) : {};
                return props.dataClassification || props.originalType || null;
              } catch {
                return null;
              }
            })
            .filter(Boolean);
          const hasRestricted = dataClassifications.some((d: string) =>
            ["RESTRICTED", "CONFIDENTIAL"].includes(d),
          );
          const hasCustomerData = dataClassifications.some(
            (d: string) =>
              d.includes("PII") || d.includes("PHI") || d.includes("CUSTOMER"),
          );
          // Multiplier: 1.0 (internal), 1.5 (confidential), 2.0 (restricted/PII)
          const multiplier =
            hasRestricted || hasCustomerData ? 2.0 : hasRestricted ? 1.5 : 1.0;
          const baseScore =
            criticalThreats * 25 + highThreats * 10 + openThreats * 5;
          return Math.min(100, Math.round(baseScore * multiplier));
        })(),
      });
    },
  );
};
