/**
 * Threat Comments API routes.
 *
 * CRUD for inline comments on individual threats.
 * All routes require authentication and verify access via threat model membership.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendNotFound,
  sendValidationError,
} from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { getAccessCache } from "../utils/access-cache.js";
import { dispatchMentionNotifications } from "./mention-notifications.js";
import { authorizeModelAction } from "./threat-models/helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";

// Reads need view; adding a comment needs comment (not granted to VIEWER).
const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_COMMENT = routeAuthz({ model: "comment" });

const CreateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

export async function threatCommentRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/threat-models/:modelId/threats/:threatId/comments
   * List all comments for a threat.
   */
  fastify.get<{ Params: { modelId: string; threatId: string } }>(
    "/api/threat-models/:modelId/threats/:threatId/comments",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, threatId } = request.params;

      const hasAccess = await getAccessCache(request).canAccessThreatModel(
        user.id,
        modelId,
      );
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model", modelId);
      }

      const prisma = await getPrisma();

      const threat = await prisma.threat.findFirst({
        where: { id: threatId, threatModelId: modelId },
        select: { id: true },
      });
      if (!threat) {
        return sendNotFound(reply, "Threat", threatId);
      }

      const comments = await prisma.threatComment.findMany({
        where: { threatId },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      return sendSuccess(reply, comments);
    },
  );

  /**
   * POST /api/threat-models/:modelId/threats/:threatId/comments
   * Add a comment to a threat.
   */
  fastify.post<{ Params: { modelId: string; threatId: string } }>(
    "/api/threat-models/:modelId/threats/:threatId/comments",
    MODEL_COMMENT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, threatId } = request.params;

      const parseResult = CreateCommentSchema.safeParse(request.body);
      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      if (!(await authorizeModelAction(reply, user.id, modelId, "comment"))) {
        return reply;
      }

      const prisma = await getPrisma();

      const threat = await prisma.threat.findFirst({
        where: { id: threatId, threatModelId: modelId },
        select: { id: true },
      });
      if (!threat) {
        return sendNotFound(reply, "Threat", threatId);
      }

      const comment = await prisma.threatComment.create({
        data: {
          body: parseResult.data.body,
          threatId,
          authorId: user.id,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      // Fire-and-forget: notify @mentioned org members
      void dispatchMentionNotifications({
        body: parseResult.data.body,
        modelId,
        actorId: user.id,
        actorName: user.name ?? user.email ?? "Someone",
      });

      return sendCreated(reply, comment);
    },
  );

  /**
   * DELETE /api/threat-models/:modelId/threats/:threatId/comments/:commentId
   * Delete a comment. Only the author may delete.
   */
  fastify.delete<{
    Params: { modelId: string; threatId: string; commentId: string };
  }>(
    "/api/threat-models/:modelId/threats/:threatId/comments/:commentId",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, threatId, commentId } = request.params;

      const hasAccess = await getAccessCache(request).canAccessThreatModel(
        user.id,
        modelId,
      );
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model", modelId);
      }

      const prisma = await getPrisma();

      const comment = await prisma.threatComment.findFirst({
        where: { id: commentId, threatId },
      });
      if (!comment) {
        return sendNotFound(reply, "Comment", commentId);
      }

      if (comment.authorId !== user.id) {
        return sendNotFound(reply, "Comment", commentId);
      }

      await prisma.threatComment.delete({ where: { id: commentId } });

      return sendNoContent(reply);
    },
  );
}
