/**
 * Threat Model Members API
 *
 * Returns the mentionable org members for a given threat model.
 * Used by the @mention autocomplete in comment threads.
 */
import type { FastifyInstance } from "fastify";
import { getPrisma } from "../db.js";
import { sendSuccess, sendNotFound } from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { getAccessCache } from "../utils/access-cache.js";

interface MentionableMember {
  id: string;
  name: string;
  email: string;
}

export async function threatModelMemberRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/threat-models/:modelId/members
   * Returns org members who can be mentioned in this model's comments.
   */
  fastify.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/members",
    { config: { authz: { model: "view" } } },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      const hasAccess = await getAccessCache(request).canAccessThreatModel(
        user.id,
        modelId,
      );
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model", modelId);
      }

      const prisma = await getPrisma();

      // Walk: ThreatModel → Project → Organization → Memberships → User
      const model = await prisma.threatModel.findFirst({
        where: { id: modelId, deletedAt: null },
        select: {
          project: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!model) {
        return sendNotFound(reply, "Threat model", modelId);
      }

      const members = await prisma.membership.findMany({
        where: {
          organizationId: model.project.organizationId,
          status: "ACTIVE",
        },
        select: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const result: MentionableMember[] = members
        .filter((m) => m.user !== null && m.user.name !== null)
        .map((m) => ({
          id: m.user!.id,
          name: m.user!.name!,
          email: m.user!.email,
        }));

      return sendSuccess(reply, result);
    },
  );
}
