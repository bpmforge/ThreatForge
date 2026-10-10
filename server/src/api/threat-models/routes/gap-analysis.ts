/**
 * Gap Analysis Route
 *
 * GET /api/threat-models/:modelId/gap-analysis
 *
 * Compares threats against their mitigations and returns:
 * - covered: threats that have ≥1 COMPLETED or ACCEPTED mitigation
 * - gaps: threats with no effective mitigation (actionable gaps)
 * - summary: counts by control category and STRIDE category
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, canAccessThreatModel } from "../helpers.js";
import { sendSuccess, sendNotFound } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });

export const gapAnalysisRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = await getPrisma();

  fastify.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/gap-analysis",
    MODEL_VIEW,
    async (request, reply) => {
      const user = await getAuthUser(request);
      const { modelId } = request.params;

      if (!(await canAccessThreatModel(user.id, modelId))) {
        return sendNotFound(reply, "Threat model");
      }

      const threats = await prisma.threat.findMany({
        where: { threatModelId: modelId, category: { not: "CODE_SCAN" } },
        include: {
          mitigations: {
            select: {
              id: true,
              status: true,
              controlCategory: true,
              description: true,
            },
          },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      });

      const covered = [];
      const gaps = [];

      for (const threat of threats) {
        const effectiveMitigations = threat.mitigations.filter(
          (m) => m.status === "IMPLEMENTED",
        );

        const cweIds = (() => {
          try {
            return JSON.parse(threat.cweIds as string) as string[];
          } catch {
            return [];
          }
        })();

        const entry = {
          id: threat.id,
          name: threat.name,
          category: threat.category,
          severity: threat.severity,
          cweIds,
          status: threat.status,
          mitigationCount: threat.mitigations.length,
          effectiveMitigationCount: effectiveMitigations.length,
          controlCategories: [
            ...new Set(
              effectiveMitigations
                .map((m) => m.controlCategory)
                .filter((c): c is string => c !== null),
            ),
          ],
        };

        if (effectiveMitigations.length > 0) {
          covered.push(entry);
        } else {
          gaps.push(entry);
        }
      }

      // Summary: gap counts by STRIDE category
      const gapsByCategory: Record<string, number> = {};
      for (const t of gaps) {
        const cat = t.category ?? "UNKNOWN";
        gapsByCategory[cat] = (gapsByCategory[cat] ?? 0) + 1;
      }

      // Summary: which control categories are missing coverage
      const allControlCategories = [
        "IAM",
        "ENCRYPTION",
        "ACCESS_CONTROL",
        "NETWORK",
        "LOGGING",
        "INPUT_VALIDATION",
        "SECRETS",
        "BACKUP",
        "MONITORING",
        "SUPPLY_CHAIN",
      ];
      const coveredCategories = new Set(
        covered.flatMap((t) => t.controlCategories),
      );
      const missingControlCategories = allControlCategories.filter(
        (c) => !coveredCategories.has(c),
      );

      const coveragePct =
        threats.length > 0
          ? Math.round((covered.length / threats.length) * 100)
          : 100;

      return sendSuccess(reply, {
        summary: {
          total: threats.length,
          covered: covered.length,
          gaps: gaps.length,
          coveragePct,
          gapsByStrideCategory: gapsByCategory,
          missingControlCategories,
        },
        covered,
        gaps,
      });
    },
  );
};
