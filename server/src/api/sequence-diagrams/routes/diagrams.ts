/**
 * Sequence Diagrams API - Diagram CRUD Routes
 *
 * List, get, create, update, delete sequence diagrams.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  getAuthUser,
  canAccessThreatModel,
  requireThreatModelEdit,
  CreateSequenceDiagramSchema,
  UpdateSequenceDiagramSchema,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
} from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

export const diagramRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/threat-models/:id/sequences
   * List all sequence diagrams for a threat model
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/sequences",
    MODEL_VIEW,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // Verify user has access to this threat model
      const hasAccess = await canAccessThreatModel(authUser.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      const diagrams = await prisma.sequenceDiagram.findMany({
        where: { threatModelId: id },
        orderBy: { order: "asc" },
        include: {
          participants: {
            orderBy: { order: "asc" },
          },
          messages: {
            orderBy: { order: "asc" },
          },
        },
      });

      return diagrams;
    },
  );

  /**
   * POST /api/threat-models/:id/sequences
   * Create a new sequence diagram
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/threat-models/:id/sequences",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;
      const parseResult = CreateSequenceDiagramSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      // Get next order
      const maxOrder = await prisma.sequenceDiagram.aggregate({
        where: { threatModelId: id },
        _max: { order: true },
      });

      const diagram = await prisma.sequenceDiagram.create({
        data: {
          ...parseResult.data,
          threatModelId: id,
          order: (maxOrder._max.order ?? -1) + 1,
          createdById: authUser.id,
        },
        include: {
          participants: true,
          messages: true,
        },
      });

      return sendCreated(reply, diagram);
    },
  );

  /**
   * GET /api/threat-models/:id/sequences/:seqId
   * Get a single sequence diagram with participants and messages
   */
  fastify.get<{ Params: { id: string; seqId: string } }>(
    "/api/threat-models/:id/sequences/:seqId",
    MODEL_VIEW,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId } = request.params;

      // Verify user has access to this threat model
      const hasAccess = await canAccessThreatModel(authUser.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Sequence diagram");
      }

      const diagram = await prisma.sequenceDiagram.findFirst({
        where: { id: seqId, threatModelId: id },
        include: {
          participants: {
            orderBy: { order: "asc" },
          },
          messages: {
            orderBy: { order: "asc" },
            include: {
              fromParticipant: true,
              toParticipant: true,
            },
          },
        },
      });

      if (!diagram) {
        return sendNotFound(reply, "Sequence diagram");
      }

      return diagram;
    },
  );

  /**
   * PATCH /api/threat-models/:id/sequences/:seqId
   * Update a sequence diagram
   */
  fastify.patch<{ Params: { id: string; seqId: string } }>(
    "/api/threat-models/:id/sequences/:seqId",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId } = request.params;
      const parseResult = UpdateSequenceDiagramSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      const existing = await prisma.sequenceDiagram.findFirst({
        where: { id: seqId, threatModelId: id },
      });
      if (!existing) {
        return sendNotFound(reply, "Sequence diagram");
      }

      const diagram = await prisma.sequenceDiagram.update({
        where: { id: seqId },
        data: parseResult.data,
        include: {
          participants: { orderBy: { order: "asc" } },
          messages: { orderBy: { order: "asc" } },
        },
      });

      return diagram;
    },
  );

  /**
   * DELETE /api/threat-models/:id/sequences/:seqId
   * Delete a sequence diagram
   */
  fastify.delete<{ Params: { id: string; seqId: string } }>(
    "/api/threat-models/:id/sequences/:seqId",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, seqId } = request.params;

      if (!(await requireThreatModelEdit(authUser.id, id, reply))) {
        return reply;
      }

      const existing = await prisma.sequenceDiagram.findFirst({
        where: { id: seqId, threatModelId: id },
      });
      if (!existing) {
        return sendNotFound(reply, "Sequence diagram");
      }

      await prisma.sequenceDiagram.delete({ where: { id: seqId } });

      return sendNoContent(reply);
    },
  );
};
