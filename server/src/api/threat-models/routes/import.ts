/**
 * Threat Model API - Import Route
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { CanvasStateSchema } from "../schemas.js";
import { getAuthUser, resolveModelTargetProject } from "../helpers.js";
import { sendCreated, sendBadRequest } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const PROJECT_ORG_EDITOR = routeAuthz({
  handler: "EDITOR+ in the target project's organization",
});

export const importRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/threat-models/import
   * Import a threat model from JSON
   */
  fastify.post(
    "/api/threat-models/import",
    PROJECT_ORG_EDITOR,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();

      const body = request.body as {
        name?: string;
        canvasState?: unknown;
        projectId?: string;
      };

      const name = body.name || "Imported Model";
      const canvasStateResult = CanvasStateSchema.safeParse(body.canvasState);

      if (body.canvasState && !canvasStateResult.success) {
        return sendBadRequest(reply, "Invalid canvas state format", {
          details: canvasStateResult.error.flatten(),
        });
      }

      const projectId = await resolveModelTargetProject(
        reply,
        user.id,
        body.projectId,
      );
      if (!projectId) return reply;

      const model = await prisma.threatModel.create({
        data: {
          name,
          projectId,
          createdById: user.id,
          canvasState: canvasStateResult.success
            ? JSON.stringify(canvasStateResult.data)
            : undefined,
        },
      });

      return sendCreated(reply, {
        ...model,
        canvasState: JSON.parse(model.canvasState),
      });
    },
  );
};
