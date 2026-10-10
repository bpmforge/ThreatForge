/**
 * Sequence Diagrams API - Message/Interaction Management Routes
 *
 * Add, update, delete, reorder messages in sequence diagrams.
 */
import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  getAuthUser,
  requireThreatModelEdit,
  CreateMessageSchema,
  UpdateMessageSchema,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

type Prisma = Awaited<ReturnType<typeof getPrisma>>;

/** True when every id names a participant of the given diagram. */
async function participantsInDiagram(
  prisma: Prisma,
  seqId: string,
  ids: (string | undefined)[],
): Promise<boolean> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (unique.length === 0) return true;
  const found = await prisma.sequenceParticipant.count({
    where: { id: { in: unique }, sequenceDiagramId: seqId },
  });
  return found === unique.length;
}

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/threat-models/:id/sequences/:seqId/messages
   * Add a message to a sequence diagram
   */
  fastify.post<{ Params: { id: string; seqId: string } }>(
    "/api/threat-models/:id/sequences/:seqId/messages",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId } = request.params;
      const parseResult = CreateMessageSchema.safeParse(request.body);

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

      const { fromId, toId } = parseResult.data;
      if (!(await participantsInDiagram(prisma, seqId, [fromId, toId]))) {
        return sendBadRequest(
          reply,
          "Participants must belong to this diagram",
        );
      }

      const message = await prisma.sequenceMessage.create({
        data: {
          ...parseResult.data,
          sequenceDiagramId: seqId,
        },
        include: {
          fromParticipant: true,
          toParticipant: true,
        },
      });

      return sendCreated(reply, message);
    },
  );

  /**
   * PATCH /api/threat-models/:id/sequences/:seqId/messages/:msgId
   * Update a message
   */
  fastify.patch<{ Params: { id: string; seqId: string; msgId: string } }>(
    "/api/threat-models/:id/sequences/:seqId/messages/:msgId",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId, msgId } = request.params;
      const parseResult = UpdateMessageSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      const existing = await prisma.sequenceMessage.findFirst({
        where: {
          id: msgId,
          sequenceDiagram: { id: seqId, threatModelId: id },
        },
      });
      if (!existing) {
        return sendNotFound(reply, "Message");
      }

      const { fromId, toId } = parseResult.data;
      if (!(await participantsInDiagram(prisma, seqId, [fromId, toId]))) {
        return sendBadRequest(
          reply,
          "Participants must belong to this diagram",
        );
      }

      const message = await prisma.sequenceMessage.update({
        where: { id: msgId },
        data: parseResult.data,
        include: {
          fromParticipant: true,
          toParticipant: true,
        },
      });

      return message;
    },
  );

  /**
   * DELETE /api/threat-models/:id/sequences/:seqId/messages/:msgId
   * Delete a message
   */
  fastify.delete<{ Params: { id: string; seqId: string; msgId: string } }>(
    "/api/threat-models/:id/sequences/:seqId/messages/:msgId",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId, msgId } = request.params;

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      const existing = await prisma.sequenceMessage.findFirst({
        where: {
          id: msgId,
          sequenceDiagram: { id: seqId, threatModelId: id },
        },
      });
      if (!existing) {
        return sendNotFound(reply, "Message");
      }

      await prisma.sequenceMessage.delete({ where: { id: msgId } });

      return sendNoContent(reply);
    },
  );

  /**
   * PUT /api/threat-models/:id/sequences/:seqId/messages/reorder
   * Reorder messages in a sequence diagram
   */
  fastify.put<{ Params: { id: string; seqId: string } }>(
    "/api/threat-models/:id/sequences/:seqId/messages/reorder",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId } = request.params;

      const schema = z.object({
        messageIds: z.array(z.string()),
      });

      const parseResult = schema.safeParse(request.body);
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

      const { messageIds } = parseResult.data;
      const uniqueIds = new Set(messageIds);
      const owned = await prisma.sequenceMessage.count({
        where: { id: { in: [...uniqueIds] }, sequenceDiagramId: seqId },
      });
      if (uniqueIds.size !== messageIds.length || owned !== uniqueIds.size) {
        return sendBadRequest(reply, "Messages must belong to this diagram");
      }

      // Update order for each message
      await Promise.all(
        messageIds.map((msgId, index) =>
          prisma.sequenceMessage.update({
            where: { id: msgId },
            data: { order: index },
          }),
        ),
      );

      // Return updated messages
      const messages = await prisma.sequenceMessage.findMany({
        where: { sequenceDiagramId: seqId },
        orderBy: { order: "asc" },
        include: {
          fromParticipant: true,
          toParticipant: true,
        },
      });

      return messages;
    },
  );
};
