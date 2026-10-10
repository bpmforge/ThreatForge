/**
 * Rescore Endpoint
 *
 * Synchronously recalculates CVSS scores for threats using the rule-based
 * auto-scorer — no LLM call, no job queue.
 */
import { authorizeModelAction } from "../../threat-models/helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { autoScoreThreat } from "../../../services/threat-review/cvss-auto-scorer.js";
import type { MicroThreat } from "../../../services/ai/micro-analysis/types.js";
import { sendNotFound } from "../helpers.js";

export const rescoreRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/threat-models/:modelId/ai/rescore
   *
   * Recalculate CVSS 3.1 and 4.0 scores for threats using rule-based logic.
   * Synchronous — no job queue, no LLM.
   *
   * Body:
   * - threatIds?: string[] — scope to specific threat IDs; empty/undefined = all
   */
  server.post<{
    Params: { modelId: string };
    Body: { threatIds?: string[] };
  }>(
    "/api/threat-models/:modelId/ai/rescore",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const { modelId } = request.params;
      // Authenticated is not authorised — verify this caller may reach
      // THIS model before touching it.
      const s1User = request.authUser as { id: string } | undefined;
      if (!s1User) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      // Rescoring rewrites threat severities: a write on the model.
      if (!(await authorizeModelAction(reply, s1User.id, modelId, "edit"))) {
        return reply;
      }
      const body = (request.body || {}) as { threatIds?: string[] };
      const prisma = await getPrisma();

      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        select: { id: true },
      });
      if (!model) return sendNotFound(reply, "Threat model");

      const threats = await prisma.threat.findMany({
        where: {
          threatModelId: modelId,
          ...(body.threatIds?.length ? { id: { in: body.threatIds } } : {}),
        },
      });

      let rescored = 0;
      for (const t of threats) {
        const microShape: Pick<
          MicroThreat,
          "category" | "severity" | "evidence" | "cweIds" | "owaspIds"
        > = {
          category:
            (
              JSON.parse((t.strideCategories as string) || "[]") as string[]
            )[0] ?? "TAMPERING",
          severity: t.severity as MicroThreat["severity"],
          evidence: t.evidence ? JSON.parse(t.evidence as string) : {},
          cweIds: JSON.parse((t.cweIds as string) || "[]"),
          owaspIds: JSON.parse((t.owaspIds as string) || "[]"),
        };

        const cvss = autoScoreThreat(microShape as MicroThreat);
        await prisma.threat.update({
          where: { id: t.id },
          data: {
            cvssVector31: cvss.vector31,
            cvssScore31: cvss.score31,
            cvssVector40: cvss.vector40,
            cvssScore40: cvss.score40,
          },
        });
        rescored++;
      }

      return { rescored };
    },
  );
};
