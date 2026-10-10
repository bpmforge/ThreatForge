/**
 * DFD Entity Routes (Process, DataStore, ExternalEntity, DataFlow)
 *
 * Every write requires edit permission on the threat model, the dfd must
 * belong to that model, and an entity id must belong to that dfd.
 */
import type { FastifyInstance } from "fastify";
import type { ExternalEntityType, FlowVolume } from "@prisma/client";
import { getPrisma } from "../../db.js";
import { getAuthUser, requireThreatModelEdit } from "./helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
} from "../../utils/api-response.js";
import {
  CreateProcessSchema,
  UpdateProcessSchema,
  CreateDataStoreSchema,
  UpdateDataStoreSchema,
  CreateExternalEntitySchema,
  UpdateExternalEntitySchema,
  CreateDataFlowSchema,
  UpdateDataFlowSchema,
} from "./schemas.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

export async function entityRoutes(fastify: FastifyInstance) {
  const prisma = await getPrisma();

  const dfdInModel = (dfdId: string, modelId: string) =>
    prisma.dataFlowDiagram.findFirst({
      where: { id: dfdId, threatModelId: modelId },
      select: { id: true },
    });

  /** True when every given node id belongs to the dfd (per node table). */
  async function nodesInDfd(
    dfdId: string,
    ids: {
      processes: (string | undefined)[];
      dataStores: (string | undefined)[];
      entities: (string | undefined)[];
    },
  ): Promise<boolean> {
    const uniq = (list: (string | undefined)[]) => [
      ...new Set(list.filter((v): v is string => !!v)),
    ];
    const processes = uniq(ids.processes);
    const dataStores = uniq(ids.dataStores);
    const entities = uniq(ids.entities);
    const [p, s, e] = await Promise.all([
      processes.length
        ? prisma.dFDProcess.count({ where: { id: { in: processes }, dfdId } })
        : 0,
      dataStores.length
        ? prisma.dFDDataStore.count({
            where: { id: { in: dataStores }, dfdId },
          })
        : 0,
      entities.length
        ? prisma.dFDExternalEntity.count({
            where: { id: { in: entities }, dfdId },
          })
        : 0,
    ]);
    return (
      p === processes.length && s === dataStores.length && e === entities.length
    );
  }

  // ==========================================================================
  // Process CRUD
  // ==========================================================================

  fastify.post<{ Params: { modelId: string; dfdId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId/processes",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = CreateProcessSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await dfdInModel(dfdId, modelId))) {
        return sendNotFound(reply, "DFD");
      }

      const process = await prisma.dFDProcess.create({
        data: {
          nodeId: parsed.data.nodeId,
          number: parsed.data.number,
          name: parsed.data.name,
          description: parsed.data.description,
          positionX: parsed.data.positionX,
          positionY: parsed.data.positionY,
          dfdId,
          linkedComponentId: parsed.data.linkedComponentId,
        },
      });

      return sendCreated(reply, process);
    },
  );

  fastify.patch<{
    Params: { modelId: string; dfdId: string; processId: string };
  }>(
    "/api/threat-models/:modelId/dfds/:dfdId/processes/:processId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, processId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = UpdateProcessSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const existing = await prisma.dFDProcess.findFirst({
        where: { id: processId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "Process");
      }

      const process = await prisma.dFDProcess.update({
        where: { id: processId },
        data: parsed.data,
      });

      return sendSuccess(reply, process);
    },
  );

  fastify.delete<{
    Params: { modelId: string; dfdId: string; processId: string };
  }>(
    "/api/threat-models/:modelId/dfds/:dfdId/processes/:processId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, processId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const existing = await prisma.dFDProcess.findFirst({
        where: { id: processId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "Process");
      }

      await prisma.dFDProcess.delete({ where: { id: processId } });
      return sendNoContent(reply);
    },
  );

  // ==========================================================================
  // Data Store CRUD
  // ==========================================================================

  fastify.post<{ Params: { modelId: string; dfdId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId/data-stores",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = CreateDataStoreSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await dfdInModel(dfdId, modelId))) {
        return sendNotFound(reply, "DFD");
      }

      const dataStore = await prisma.dFDDataStore.create({
        data: {
          nodeId: parsed.data.nodeId,
          number: parsed.data.number,
          name: parsed.data.name,
          description: parsed.data.description,
          dataTypes: JSON.stringify(parsed.data.dataTypes || []),
          positionX: parsed.data.positionX,
          positionY: parsed.data.positionY,
          dfdId,
          linkedComponentId: parsed.data.linkedComponentId,
        },
      });

      return sendCreated(reply, dataStore);
    },
  );

  fastify.patch<{
    Params: { modelId: string; dfdId: string; dataStoreId: string };
  }>(
    "/api/threat-models/:modelId/dfds/:dfdId/data-stores/:dataStoreId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, dataStoreId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = UpdateDataStoreSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const existing = await prisma.dFDDataStore.findFirst({
        where: { id: dataStoreId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "Data store");
      }

      const updateData: Record<string, unknown> = { ...parsed.data };
      delete updateData.dataTypes;
      if (parsed.data.dataTypes !== undefined) {
        updateData.dataTypes = JSON.stringify(parsed.data.dataTypes);
      }

      const dataStore = await prisma.dFDDataStore.update({
        where: { id: dataStoreId },
        data: updateData,
      });

      return sendSuccess(reply, dataStore);
    },
  );

  fastify.delete<{
    Params: { modelId: string; dfdId: string; dataStoreId: string };
  }>(
    "/api/threat-models/:modelId/dfds/:dfdId/data-stores/:dataStoreId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, dataStoreId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const existing = await prisma.dFDDataStore.findFirst({
        where: { id: dataStoreId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "Data store");
      }

      await prisma.dFDDataStore.delete({ where: { id: dataStoreId } });
      return sendNoContent(reply);
    },
  );

  // ==========================================================================
  // External Entity CRUD
  // ==========================================================================

  fastify.post<{ Params: { modelId: string; dfdId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId/external-entities",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = CreateExternalEntitySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await dfdInModel(dfdId, modelId))) {
        return sendNotFound(reply, "DFD");
      }

      const entity = await prisma.dFDExternalEntity.create({
        data: {
          nodeId: parsed.data.nodeId,
          name: parsed.data.name,
          entityType: parsed.data.entityType as ExternalEntityType,
          description: parsed.data.description,
          positionX: parsed.data.positionX,
          positionY: parsed.data.positionY,
          dfdId,
          linkedComponentId: parsed.data.linkedComponentId,
        },
      });

      return sendCreated(reply, entity);
    },
  );

  fastify.patch<{
    Params: { modelId: string; dfdId: string; entityId: string };
  }>(
    "/api/threat-models/:modelId/dfds/:dfdId/external-entities/:entityId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, entityId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = UpdateExternalEntitySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const existing = await prisma.dFDExternalEntity.findFirst({
        where: { id: entityId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "External entity");
      }

      const entity = await prisma.dFDExternalEntity.update({
        where: { id: entityId },
        data: parsed.data as { entityType?: ExternalEntityType },
      });

      return sendSuccess(reply, entity);
    },
  );

  fastify.delete<{
    Params: { modelId: string; dfdId: string; entityId: string };
  }>(
    "/api/threat-models/:modelId/dfds/:dfdId/external-entities/:entityId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, entityId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const existing = await prisma.dFDExternalEntity.findFirst({
        where: { id: entityId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "External entity");
      }

      await prisma.dFDExternalEntity.delete({ where: { id: entityId } });
      return sendNoContent(reply);
    },
  );

  // ==========================================================================
  // Data Flow CRUD
  // ==========================================================================

  fastify.post<{ Params: { modelId: string; dfdId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId/data-flows",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = CreateDataFlowSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      if (!(await dfdInModel(dfdId, modelId))) {
        return sendNotFound(reply, "DFD");
      }

      const d = parsed.data;
      const endpointsOk = await nodesInDfd(dfdId, {
        processes: [d.sourceProcessId, d.targetProcessId],
        dataStores: [d.sourceDataStoreId, d.targetDataStoreId],
        entities: [d.sourceEntityId, d.targetEntityId],
      });
      if (!endpointsOk) {
        return sendBadRequest(reply, "Flow endpoints must belong to this DFD");
      }

      const dataFlow = await prisma.dFDDataFlow.create({
        data: {
          edgeId: d.edgeId,
          number: d.number,
          name: d.name,
          dataTypes: JSON.stringify(d.dataTypes || []),
          volume: d.volume as FlowVolume | undefined,
          frequency: d.frequency,
          dfdId,
          sourceProcessId: d.sourceProcessId,
          sourceDataStoreId: d.sourceDataStoreId,
          sourceEntityId: d.sourceEntityId,
          targetProcessId: d.targetProcessId,
          targetDataStoreId: d.targetDataStoreId,
          targetEntityId: d.targetEntityId,
        },
      });

      return sendCreated(reply, dataFlow);
    },
  );

  fastify.patch<{ Params: { modelId: string; dfdId: string; flowId: string } }>(
    "/api/threat-models/:modelId/dfds/:dfdId/data-flows/:flowId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, flowId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const parsed = UpdateDataFlowSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const existing = await prisma.dFDDataFlow.findFirst({
        where: { id: flowId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "Data flow");
      }

      const updateData: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.dataTypes !== undefined) {
        updateData.dataTypes = JSON.stringify(parsed.data.dataTypes);
      }

      const dataFlow = await prisma.dFDDataFlow.update({
        where: { id: flowId },
        data: updateData as { volume?: FlowVolume | null },
      });

      return sendSuccess(reply, dataFlow);
    },
  );

  fastify.delete<{
    Params: { modelId: string; dfdId: string; flowId: string };
  }>(
    "/api/threat-models/:modelId/dfds/:dfdId/data-flows/:flowId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, dfdId, flowId } = request.params;

      if (!(await requireThreatModelEdit(user.id, modelId, reply))) {
        return reply;
      }

      const existing = await prisma.dFDDataFlow.findFirst({
        where: { id: flowId, dfd: { id: dfdId, threatModelId: modelId } },
      });
      if (!existing) {
        return sendNotFound(reply, "Data flow");
      }

      await prisma.dFDDataFlow.delete({ where: { id: flowId } });
      return sendNoContent(reply);
    },
  );
}
