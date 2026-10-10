/**
 * Presence API — active collaborator counts per threat model.
 *
 * Returns a lightweight map of modelId → active user count,
 * backed by Redis session data written by the collaboration service.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../utils/auth-helpers.js";
import { getActiveUserCounts } from "../services/redis-collaboration.js";
import { checkThreatModelAccess } from "../services/access-control/access-control-service.js";
import { sendSuccess, sendBadRequest } from "../utils/api-response.js";

const QuerySchema = z.object({
  modelIds: z.string().transform((s) => s.split(",").filter(Boolean)),
});

export async function presenceRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/presence?modelIds=id1,id2,id3
   * Returns active user count for each requested model.
   */
  fastify.get(
    "/api/presence",
    {
      config: {
        authz: {
          handler: "counts only the requested models the caller can access",
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const parse = QuerySchema.safeParse(request.query);
      if (!parse.success || parse.data.modelIds.length === 0) {
        return sendBadRequest(reply, "modelIds query param required");
      }

      const requested = parse.data.modelIds.slice(0, 50); // cap at 50
      // Only models the caller can open: presence must not reveal activity
      // on another organization's models.
      const visible = await Promise.all(
        requested.map(
          async (id) => (await checkThreatModelAccess(user.id, id)).hasAccess,
        ),
      );
      const modelIds = requested.filter((_, i) => visible[i]);
      const counts = await getActiveUserCounts(modelIds);
      return sendSuccess(reply, counts);
    },
  );
}
