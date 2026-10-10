/**
 * Requirements Coverage Route
 *
 * GET /api/threat-models/:modelId/requirements-coverage
 *
 * For each requirement in the model, shows which mitigations address it
 * and whether those mitigations are in an effective status (COMPLETED/VERIFIED).
 * Returns a coverage summary and per-requirement breakdown useful for
 * compliance gap analysis and requirements traceability reporting.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, canAccessThreatModel } from "../helpers.js";
import { sendSuccess, sendNotFound } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });

export const requirementsCoverageRoutes: FastifyPluginAsync = async (
  fastify,
) => {
  const prisma = await getPrisma();

  fastify.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/requirements-coverage",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, modelId);
      if (!hasAccess) return sendNotFound(reply, "Threat model");

      const requirements = await prisma.requirement.findMany({
        where: { threatModelId: modelId, supersededAt: null },
        include: {
          mitigations: {
            select: {
              mitigationId: true,
              mitigation: {
                select: {
                  id: true,
                  description: true,
                  status: true,
                  controlCategory: true,
                  threat: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ source: "asc" }, { reqId: "asc" }],
      });

      const rows = requirements.map((req) => {
        const mitigations = req.mitigations.map((mr) => mr.mitigation);
        const completedMitigations = mitigations.filter(
          (m) => m.status === "IMPLEMENTED",
        );

        // Distinct threats via Set on id
        const threatMap = new Map<string, { id: string; name: string }>();
        for (const m of completedMitigations) {
          if (m.threat && !threatMap.has(m.threat.id)) {
            threatMap.set(m.threat.id, m.threat);
          }
        }

        return {
          id: req.id,
          reqId: req.reqId,
          text: req.text,
          category: req.category,
          docId: req.docId,
          source: req.source,
          isCovered: completedMitigations.length > 0,
          mitigationCount: mitigations.length,
          completedCount: completedMitigations.length,
          threats: Array.from(threatMap.values()),
          controlCategories: [
            ...new Set(
              completedMitigations
                .map((m) => m.controlCategory)
                .filter(Boolean),
            ),
          ],
        };
      });

      const covered = rows.filter((r) => r.isCovered).length;
      const total = rows.length;

      return sendSuccess(reply, {
        summary: {
          total,
          covered,
          uncovered: total - covered,
          coveragePct: total > 0 ? Math.round((covered / total) * 100) : 0,
        },
        requirements: rows,
      });
    },
  );
};
