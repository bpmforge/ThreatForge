/**
 * Reporting Compare Handler
 *
 * Compare risk metrics across multiple threat models side-by-side.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../db.js";
import { compareModels } from "../services/risk/model-comparison.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { sendSuccess, sendBadRequest } from "../utils/api-response.js";

export async function compareModelsHandler(
  request: FastifyRequest<{ Body: { modelIds: string[] } }>,
  reply: FastifyReply,
) {
  const user = await getAuthUser(request);
  const { modelIds } = request.body;

  if (!Array.isArray(modelIds) || modelIds.length < 2) {
    return sendBadRequest(reply, "Provide at least 2 model IDs to compare");
  }
  if (modelIds.length > 10) {
    return sendBadRequest(reply, "Cannot compare more than 10 models at once");
  }

  // Verify user has access to all requested models
  const prisma = await getPrisma();
  const accessible = await prisma.threatModel.findMany({
    where: {
      id: { in: modelIds },
      project: {
        organization: {
          memberships: { some: { userId: user.id, status: "ACTIVE" } },
        },
      },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (accessible.length !== modelIds.length) {
    return sendBadRequest(
      reply,
      "One or more models not found or not accessible",
    );
  }

  const result = await compareModels(modelIds);
  return sendSuccess(reply, result);
}
