/**
 * Bulk Operations API
 *
 * Endpoints for batch operations on threats and components.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
} from "../utils/api-response.js";
import { dispatchWebhookEvent } from "../services/webhooks/webhook-dispatcher.js";
import { authorizeModelAction } from "./threat-models/helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

async function getOrgIdFromModel(modelId: string): Promise<string | null> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    select: { project: { select: { organizationId: true } } },
  });
  return model?.project.organizationId ?? null;
}

// Schemas
const StrideCategoryEnum = z.enum([
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
]);
const SeverityEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
const ThreatStatusEnum = z.enum([
  "OPEN",
  "MITIGATED",
  "ACCEPTED",
  "NOT_APPLICABLE",
]);

const BulkCreateThreatSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  strideCategories: z.array(StrideCategoryEnum).min(1),
  severity: SeverityEnum.default("MEDIUM"),
  category: z.string().max(100).optional(),
  componentNodeId: z.string().optional(),
  connectionEdgeId: z.string().optional(),
});

const BulkUpdateThreatSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  strideCategories: z.array(StrideCategoryEnum).min(1).optional(),
  severity: SeverityEnum.optional(),
  status: ThreatStatusEnum.optional(),
  category: z.string().max(100).optional().nullable(),
});

const BulkThreatsSchema = z.object({
  create: z.array(BulkCreateThreatSchema).optional(),
  update: z.array(BulkUpdateThreatSchema).optional(),
  delete: z.array(z.string()).optional(),
});

const BulkUpdateComponentsSchema = z.object({
  nodeIds: z.array(z.string()).min(1),
  updates: z.object({
    name: z.string().optional(),
    componentType: z.string().optional(),
    description: z.string().optional(),
    trustLevel: z.enum(["TRUSTED", "SEMI_TRUSTED", "UNTRUSTED"]).optional(),
  }),
});

export async function bulkRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/threat-models/:modelId/bulk/threats
   * Bulk create, update, and delete threats
   */
  fastify.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/bulk/threats",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const parsed = BulkThreatsSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Invalid bulk operation data");
      }

      const { create = [], update = [], delete: deleteIds = [] } = parsed.data;
      if (
        deleteIds.length > 0 &&
        !(await authorizeModelAction(reply, user.id, modelId, "edit"))
      ) {
        return reply;
      }
      const results = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: [] as string[],
      };

      // Create threats
      if (create.length > 0) {
        try {
          const createData = create.map((t) => ({
            name: t.name,
            description: t.description,
            strideCategories: JSON.stringify(t.strideCategories),
            severity: t.severity,
            category: t.category,
            componentNodeId: t.componentNodeId,
            connectionEdgeId: t.connectionEdgeId,
            threatModelId: modelId,
            createdById: user.id,
          }));

          const createResult = await prisma.threat.createMany({
            data: createData,
          });
          results.created = createResult.count;
        } catch (err) {
          results.errors.push(
            `Create failed: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      }

      // Update threats
      for (const upd of update) {
        try {
          const { id, strideCategories, ...rest } = upd;
          // Bound to :modelId — a threat id from another model matches nothing.
          const { count } = await prisma.threat.updateMany({
            where: { id, threatModelId: modelId },
            data: {
              ...rest,
              ...(strideCategories && {
                strideCategories: JSON.stringify(strideCategories),
              }),
            },
          });
          if (count === 0) {
            results.errors.push(`Update ${id} failed: threat not found`);
            continue;
          }
          results.updated++;
        } catch (err) {
          results.errors.push(
            `Update ${upd.id} failed: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      }

      // Delete threats
      if (deleteIds.length > 0) {
        try {
          const deleteResult = await prisma.threat.deleteMany({
            where: { id: { in: deleteIds }, threatModelId: modelId },
          });
          results.deleted = deleteResult.count;
        } catch (err) {
          results.errors.push(
            `Delete failed: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      }

      // Fire webhook event
      const orgId = await getOrgIdFromModel(modelId);
      if (
        orgId &&
        (results.created > 0 || results.updated > 0 || results.deleted > 0)
      ) {
        dispatchWebhookEvent(orgId, "threat.updated", {
          modelId,
          bulkOperation: true,
          created: results.created,
          updated: results.updated,
          deleted: results.deleted,
        });
      }

      return sendSuccess(reply, {
        success: results.errors.length === 0,
        created: results.created,
        updated: results.updated,
        deleted: results.deleted,
        errors: results.errors.length > 0 ? results.errors : undefined,
      });
    },
  );

  /**
   * POST /api/threat-models/:modelId/bulk/components
   * Bulk update component properties in canvas state
   */
  fastify.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/bulk/components",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const parsed = BulkUpdateComponentsSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Invalid bulk component update data");
      }

      const { nodeIds, updates } = parsed.data;

      // Get the threat model canvas state
      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        select: { canvasState: true },
      });

      if (!model?.canvasState) {
        return sendNotFound(reply, "Canvas state", modelId);
      }

      // Parse and update canvas state
      const canvasState = model.canvasState as {
        nodes?: Array<{ id: string; data: Record<string, unknown> }>;
      };
      let updatedCount = 0;

      if (canvasState.nodes) {
        canvasState.nodes = canvasState.nodes.map((node) => {
          if (nodeIds.includes(node.id)) {
            updatedCount++;
            return {
              ...node,
              data: { ...node.data, ...updates },
            };
          }
          return node;
        });
      }

      // Save updated canvas state
      await prisma.threatModel.update({
        where: { id: modelId },
        data: { canvasState: canvasState as object },
      });

      return sendSuccess(reply, {
        success: true,
        updatedCount,
        nodeIds,
      });
    },
  );

  /**
   * DELETE /api/threat-models/:modelId/bulk/threats
   * Bulk delete threats by IDs
   */
  fastify.delete<{ Params: { modelId: string }; Body: { ids: string[] } }>(
    "/api/threat-models/:modelId/bulk/threats",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;
      const { ids } = request.body as { ids: string[] };

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return sendBadRequest(reply, "No threat IDs provided");
      }

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const result = await prisma.threat.deleteMany({
        where: { id: { in: ids }, threatModelId: modelId },
      });

      const orgId = await getOrgIdFromModel(modelId);
      if (orgId && result.count > 0) {
        dispatchWebhookEvent(orgId, "threat.deleted", {
          modelId,
          bulkOperation: true,
          deletedCount: result.count,
        });
      }

      return sendSuccess(reply, { deleted: result.count });
    },
  );

  /**
   * PATCH /api/threat-models/:modelId/bulk/threats/severity
   * Bulk update severity for multiple threats
   */
  fastify.patch<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/bulk/threats/severity",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;
      const body = request.body as { ids: string[]; severity: string };

      if (!body.ids || !body.severity) {
        return sendBadRequest(reply, "Missing ids or severity");
      }

      const severityResult = SeverityEnum.safeParse(body.severity);
      if (!severityResult.success) {
        return sendBadRequest(reply, "Invalid severity value");
      }

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const result = await prisma.threat.updateMany({
        where: { id: { in: body.ids }, threatModelId: modelId },
        data: { severity: severityResult.data },
      });

      return sendSuccess(reply, { updated: result.count });
    },
  );

  /**
   * PATCH /api/threat-models/:modelId/bulk/threats/status
   * Bulk update status for multiple threats
   */
  fastify.patch<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/bulk/threats/status",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { modelId } = request.params;
      const body = request.body as { ids: string[]; status: string };

      if (!body.ids || !body.status) {
        return sendBadRequest(reply, "Missing ids or status");
      }

      const statusResult = ThreatStatusEnum.safeParse(body.status);
      if (!statusResult.success) {
        return sendBadRequest(reply, "Invalid status value");
      }

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const result = await prisma.threat.updateMany({
        where: { id: { in: body.ids }, threatModelId: modelId },
        data: { status: statusResult.data },
      });

      return sendSuccess(reply, { updated: result.count });
    },
  );
}
