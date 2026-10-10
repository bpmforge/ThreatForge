/**
 * Threat Model API - Canvas Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { canPerformAction } from "../../../services/access-control/access-control-service.js";
import { CanvasStateSchema } from "../schemas.js";
import { getAuthUser, authorizeMemberModelAction } from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} from "../../../utils/api-response.js";
import { syncCanvasToDatabase } from "../../../services/canvas-sync.js";
import { logAudit } from "../../../services/audit.js";

export const canvasRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/threat-models/:id/save-canvas
   * Quick save endpoint for auto-save functionality
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/threat-models/:id/save-canvas",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const actionCheck = await canPerformAction(user.id, id, "edit");
      if (!actionCheck.allowed) {
        if (!actionCheck.access?.hasAccess) {
          return sendNotFound(reply, "Threat model");
        }
        return sendForbidden(reply, actionCheck.error);
      }

      const parseResult = CanvasStateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Invalid canvas state", {
          details: parseResult.error.flatten(),
        });
      }

      // updateMany returns { count } and silently ignores missing rows, so we
      // don't 500 if the model was deleted between access-check and update —
      // a race observed when parallel E2E workers DELETE one model while
      // another in-flight request is mid-save against the same id.
      const updated = await prisma.threatModel.updateMany({
        where: { id },
        data: { canvasState: JSON.stringify(parseResult.data) },
      });
      if (updated.count === 0) {
        return sendNotFound(reply, "Threat model");
      }

      // Sync canvas nodes/edges to the components/connections tables
      // so stats, exports, and queries reflect the canvas state
      try {
        await syncCanvasToDatabase(id, parseResult.data);
      } catch (err) {
        // Non-blocking — save succeeded, sync is best-effort
        request.log.warn({ err, modelId: id }, "Canvas sync to DB failed");
      }

      // Audit log canvas save (non-blocking)
      Promise.resolve(
        logAudit({
          action: "UPDATE",
          resourceType: "THREAT_MODEL",
          resourceId: id,
          resourceName: "Canvas",
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: actionCheck.access?.organizationId || "",
          metadata: {
            type: "canvas_save",
            nodeCount: parseResult.data.nodes?.length || 0,
          },
        }),
      ).catch(() => {});

      return { success: true };
    },
  );

  /**
   * POST /api/threat-models/:id/duplicate
   * Duplicate a threat model
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/threat-models/:id/duplicate",
    routeAuthz({ handler: "org member (not a guest) with edit on the model" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      // The copy is a new model in the project, which a guest's per-model
      // grant does not cover.
      if (!(await authorizeMemberModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const original = await prisma.threatModel.findUnique({
        where: { id },
        select: { name: true, canvasState: true, projectId: true },
      });

      if (!original) {
        return sendNotFound(reply, "Threat model");
      }

      const duplicate = await prisma.threatModel.create({
        data: {
          name: `${original.name} (Copy)`,
          canvasState: original.canvasState,
          projectId: original.projectId,
          createdById: user.id,
        },
      });

      return sendCreated(reply, {
        ...duplicate,
        canvasState: JSON.parse(duplicate.canvasState),
      });
    },
  );
};
