/**
 * DFD CRUD Routes
 */
import type { FastifyInstance } from "fastify";
import type { DFDLevel } from "@prisma/client";
import { getPrisma } from "../../db.js";
import {
  getAuthUser,
  canAccessThreatModel,
  requireThreatModelEdit,
} from "./helpers.js";
import { CreateDFDSchema, UpdateDFDSchema } from "./schemas.js";
import {
  sendCreated,
  sendNotFound,
  sendNoContent,
} from "../../utils/api-response.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

export async function dfdCrudRoutes(fastify: FastifyInstance) {
  const prisma = await getPrisma();

  /** GET /api/threat-models/:modelId/dfds - List DFDs */
  fastify.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/dfds",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      if (!(await canAccessThreatModel(user.id, modelId))) {
        return sendNotFound(reply, "Threat model");
      }

      const dfds = await prisma.dataFlowDiagram.findMany({
        where: { threatModelId: modelId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: {
            select: {
              processes: true,
              dataStores: true,
              externalEntities: true,
              dataFlows: true,
            },
          },
        },
      });

      return dfds;
    },
  );

  /** GET /api/threat-models/:modelId/dfds/:dfdId - Get single DFD */
  fastify.get<{ Params: { modelId: string; dfdId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId } = request.params;

      if (!(await canAccessThreatModel(user.id, modelId))) {
        return sendNotFound(reply, "Threat model");
      }

      const dfd = await prisma.dataFlowDiagram.findUnique({
        where: { id: dfdId },
        include: {
          processes: true,
          dataStores: true,
          externalEntities: true,
          dataFlows: true,
          childDfds: true,
        },
      });

      if (!dfd || dfd.threatModelId !== modelId) {
        return sendNotFound(reply, "DFD");
      }

      return {
        ...dfd,
        canvasState: JSON.parse(dfd.canvasState),
      };
    },
  );

  /** POST /api/threat-models/:modelId/dfds - Create DFD */
  fastify.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/dfds",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = CreateDFDSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      if (parsed.data.parentDfdId) {
        const parent = await prisma.dataFlowDiagram.findFirst({
          where: { id: parsed.data.parentDfdId, threatModelId: modelId },
          select: { id: true },
        });
        if (!parent) {
          return sendNotFound(reply, "Parent DFD");
        }
      }

      const dfd = await prisma.dataFlowDiagram.create({
        data: {
          name: parsed.data.name,
          level: (parsed.data.level as DFDLevel) || "CONTEXT",
          threatModelId: modelId,
          parentDfdId: parsed.data.parentDfdId,
        },
      });

      return sendCreated(reply, dfd);
    },
  );

  /** PATCH /api/threat-models/:modelId/dfds/:dfdId - Update DFD */
  fastify.patch<{ Params: { modelId: string; dfdId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = UpdateDFDSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      const existing = await prisma.dataFlowDiagram.findUnique({
        where: { id: dfdId },
      });
      if (!existing || existing.threatModelId !== modelId) {
        return sendNotFound(reply, "DFD");
      }

      const dfd = await prisma.dataFlowDiagram.update({
        where: { id: dfdId },
        data: {
          name: parsed.data.name,
          canvasState: parsed.data.canvasState
            ? JSON.stringify(parsed.data.canvasState)
            : undefined,
        },
      });

      return dfd;
    },
  );

  /** DELETE /api/threat-models/:modelId/dfds/:dfdId - Delete DFD */
  fastify.delete<{ Params: { modelId: string; dfdId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const existing = await prisma.dataFlowDiagram.findUnique({
        where: { id: dfdId },
      });
      if (!existing || existing.threatModelId !== modelId) {
        return sendNotFound(reply, "DFD");
      }

      await prisma.dataFlowDiagram.delete({ where: { id: dfdId } });
      return sendNoContent(reply);
    },
  );
}
