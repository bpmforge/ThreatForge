/**
 * Threat-model access check shared by model-scoped handlers.
 *
 * Loads the model with the caller's ACTIVE membership of its organization. A
 * missing model and a model the caller cannot see both get the same 404, so a
 * probe cannot tell whether the id exists (as in authorizeModelAction). A
 * soft-deleted organization's models count as missing. Guests with a share
 * link are refused: these model views are for organization members.
 */

import type { FastifyReply } from "fastify";
import { getPrisma } from "../db.js";
import { sendNotFound } from "../utils/api-response.js";

/** Prisma `include` for a model's project, organization and the user's ACTIVE membership. */
export function memberProjectInclude(userId: string) {
  return {
    include: {
      organization: {
        include: {
          memberships: {
            where: { userId, status: "ACTIVE" as const },
          },
        },
      },
    },
  };
}

type MemberModel = {
  project: {
    organization: { deletedAt: Date | null; memberships: unknown[] };
  };
};

export type ModelAccess<M> =
  | { model: M; denied?: undefined }
  | { model?: undefined; denied: FastifyReply };

/** Check an already-loaded model (or null) for ACTIVE org membership. */
export function checkModelAccess<M extends MemberModel>(
  reply: FastifyReply,
  model: M | null,
): ModelAccess<M> {
  const org = model?.project.organization;
  if (!model || !org || org.deletedAt || org.memberships.length === 0) {
    return { denied: sendNotFound(reply, "Threat model") };
  }
  return { model };
}

/** Load a model and require the user to be an ACTIVE member of its organization. */
export async function loadMemberModel(
  reply: FastifyReply,
  modelId: string,
  userId: string,
) {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: { project: memberProjectInclude(userId) },
  });
  return checkModelAccess(reply, model);
}
