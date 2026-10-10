/**
 * AI API — Expert Analysis Route
 *
 * POST /api/threat-models/:modelId/ai/expert-analysis
 *
 * Runs the multi-pass expert analysis pipeline (6 passes, verification loops).
 * Always async — returns 202 with job ID.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { startModelAnalysisJob } from "../analysis-job.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { authorizeModelAction } from "../../threat-models/helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

/**
 * S1 + review of #237: these routes queue jobs that write threats or
 * mitigations into the model and spend its org's AI budget, so they need
 * edit, not just access.
 */
const MODEL_EDIT = routeAuthz({ model: "edit" });

export const expertAnalysisRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/threat-models/:modelId/ai/expert-analysis
   *
   * Runs full 6-pass expert analysis. Always async via job queue if Redis
   * is available, otherwise runs synchronously (long request).
   */
  server.post<{
    Params: { modelId: string };
  }>(
    "/api/threat-models/:modelId/ai/expert-analysis",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      return startModelAnalysisJob({
        prisma,
        reply,
        log: request.log,
        userId: user.id,
        modelId,
        analysisName: "expert analysis",
        input: JSON.stringify({ modelId, mode: "expert" }),
        type: "EXPERT_ANALYSIS",
        estimatedDuration: "2-5 minutes (6 analysis passes)",
      });
    },
  );
};
