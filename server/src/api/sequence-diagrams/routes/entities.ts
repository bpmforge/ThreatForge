/**
 * Sequence Diagrams API - Entity/Participant Management Routes
 *
 * Add, update, delete participants in sequence diagrams.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  getAuthUser,
  requireThreatModelEdit,
  CreateParticipantSchema,
  UpdateParticipantSchema,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

export const entityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/threat-models/:id/sequences/:seqId/participants
   * Add a participant to a sequence diagram
   */
  fastify.post<{ Params: { id: string; seqId: string } }>(
    "/api/threat-models/:id/sequences/:seqId/participants",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId } = request.params;
      const parseResult = CreateParticipantSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      const diagram = await prisma.sequenceDiagram.findFirst({
        where: { id: seqId, threatModelId: id },
      });
      if (!diagram) {
        return sendNotFound(reply, "Sequence diagram");
      }

      const participant = await prisma.sequenceParticipant.create({
        data: {
          ...parseResult.data,
          sequenceDiagramId: seqId,
        },
      });

      return sendCreated(reply, participant);
    },
  );

  /**
   * PATCH /api/threat-models/:id/sequences/:seqId/participants/:partId
   * Update a participant
   */
  fastify.patch<{ Params: { id: string; seqId: string; partId: string } }>(
    "/api/threat-models/:id/sequences/:seqId/participants/:partId",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId, partId } = request.params;
      const parseResult = UpdateParticipantSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      const existing = await prisma.sequenceParticipant.findFirst({
        where: {
          id: partId,
          sequenceDiagram: { id: seqId, threatModelId: id },
        },
      });
      if (!existing) {
        return sendNotFound(reply, "Participant");
      }

      const participant = await prisma.sequenceParticipant.update({
        where: { id: partId },
        data: parseResult.data,
      });

      return participant;
    },
  );

  /**
   * DELETE /api/threat-models/:id/sequences/:seqId/participants/:partId
   * Delete a participant
   */
  fastify.delete<{ Params: { id: string; seqId: string; partId: string } }>(
    "/api/threat-models/:id/sequences/:seqId/participants/:partId",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId, partId } = request.params;

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      const existing = await prisma.sequenceParticipant.findFirst({
        where: {
          id: partId,
          sequenceDiagram: { id: seqId, threatModelId: id },
        },
      });
      if (!existing) {
        return sendNotFound(reply, "Participant");
      }

      await prisma.sequenceParticipant.delete({ where: { id: partId } });

      return sendNoContent(reply);
    },
  );
};
