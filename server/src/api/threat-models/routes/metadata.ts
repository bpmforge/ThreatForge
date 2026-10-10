/**
 * Threat Model API - Metadata Routes (Status, Tags)
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { logAudit } from "../../../services/audit.js";
import { UpdateStatusSchema, UpdateTagsSchema } from "../schemas.js";
import { getAuthUser, authorizeModelAction } from "../helpers.js";
import { sendBadRequest } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

export const metadataRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * PATCH /api/threat-models/:id/status
   * Update model lifecycle status
   */
  fastify.patch<{ Params: { id: string } }>(
    "/api/threat-models/:id/status",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const parseResult = UpdateStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Invalid status", {
          details: parseResult.error.flatten(),
        });
      }

      const { status } = parseResult.data;

      const oldModel = await prisma.threatModel.findUnique({
        where: { id },
        select: {
          status: true,
          name: true,
          project: { select: { organizationId: true } },
        },
      });

      const model = await prisma.threatModel.update({
        where: { id },
        data: { status },
        select: { id: true, name: true, status: true, updatedAt: true },
      });

      if (oldModel && oldModel.status !== status) {
        await logAudit({
          action: "UPDATE",
          resourceType: "THREAT_MODEL",
          resourceId: model.id,
          resourceName: model.name,
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: oldModel.project.organizationId,
          changes: { status: { old: oldModel.status, new: status } },
          metadata: {
            ip: request.ip,
            userAgent: request.headers["user-agent"],
          },
        });
      }

      return model;
    },
  );

  /**
   * PATCH /api/threat-models/:id/tags
   * Update model tags
   */
  fastify.patch<{ Params: { id: string } }>(
    "/api/threat-models/:id/tags",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const parseResult = UpdateTagsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Invalid tags", {
          details: parseResult.error.flatten(),
        });
      }

      const { tags } = parseResult.data;

      const model = await prisma.threatModel.update({
        where: { id },
        data: { tags: JSON.stringify(tags) },
        select: { id: true, name: true, tags: true, updatedAt: true },
      });

      return { ...model, tags: JSON.parse(model.tags) };
    },
  );
};
