/**
 * Security Review Workflow API
 *
 * REST endpoints for managing threat model reviews and approvals.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { canAccessReview, reviewModelId } from "./reviews-authz.js";
import {
  authorizeModelAction,
  canAccessThreatModel,
} from "./threat-models/helpers.js";
import type { Permission } from "../services/access-control/access-control-service.js";
import {
  checkOrganizationAccess,
  getOrgIdFromModel,
} from "../services/access-control/access-control-service.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import {
  sendSuccess,
  sendUnauthorized,
  sendForbidden,
  sendBadRequest,
  sendNotFound,
  sendConflict,
} from "../utils/api-response.js";
import {
  createReviewRequest,
  getReviewRequest,
  getModelReviewRequests,
  getUserPendingReviews,
  startReview,
  submitReviewDecision,
  addReviewComment,
  resolveReviewComment,
  completeChecklistItem,
  signOffReview,
  calculateReviewMetrics,
  getReviewActivity,
} from "../services/review-workflow/index.js";
import { InvalidReviewStateError } from "../services/review-workflow/types.js";
import type {
  ReviewerRole,
  ReviewDecision,
  ReviewComment,
} from "../services/review-workflow/types.js";
import { getPrisma } from "../db.js";
import { dispatchMentionNotifications } from "./mention-notifications.js";

const AUTHENTICATED = routeAuthz("authenticated");
const MODEL_VIEW = routeAuthz({ model: "view" });
/** Review routes: the caller must reach the review's model (canAccessReview). */
const REVIEW_VIEW = routeAuthz({
  handler: "view access to the review's threat model (canAccessReview)",
});

/** Review routes that write comments/checklist: needs comment on the model. */
const REVIEW_COMMENT = routeAuthz({
  handler: "comment access to the review's threat model (reviewCaller)",
});

// Request types
interface CreateReviewBody {
  threatModelId: string;
  reviewers: Array<{ userId: string; role: ReviewerRole; required: boolean }>;
  dueDate?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  reviewType?: "INITIAL" | "PERIODIC" | "CHANGE" | "COMPLIANCE";
  description?: string;
  scope?: string;
  workflowConfigId?: string;
}

interface SubmitDecisionBody {
  decision: ReviewDecision;
  comments?: string;
}

interface AddCommentBody {
  content: string;
  category?: ReviewComment["category"];
  referencedItemType?: ReviewComment["referencedItemType"];
  referencedItemId?: string;
  parentCommentId?: string;
}

interface CompleteChecklistBody {
  checklistItemId: string;
  notes?: string;
}

interface SignOffBody {
  statement: string;
  expiresAt?: string;
}

/**
 * The signed-in caller, when they may reach the review in the URL. Otherwise
 * sends 401 / 403 and returns null.
 *
 * Authentication is not authorization. Without the review check any
 * signed-in user could read another org's reviewer identities and comment
 * threads, and write to their reviews — decisions, comments, checklist,
 * sign-off.
 */
async function reviewCaller(
  request: FastifyRequest<{ Params: { reviewId: string } }>,
  reply: FastifyReply,
  action: Permission = "view",
): Promise<string | null> {
  const userId = request.authUser?.id;
  if (!userId) {
    sendUnauthorized(reply);
    return null;
  }
  if (!(await canAccessReview(userId, request.params.reviewId))) {
    sendForbidden(reply, "Access denied");
    return null;
  }
  if (action !== "view") {
    const modelId = await reviewModelId(request.params.reviewId);
    if (
      !modelId ||
      !(await authorizeModelAction(reply, userId, modelId, action))
    ) {
      return null;
    }
  }
  return userId;
}

export async function reviewRoutes(fastify: FastifyInstance) {
  // Create a review request
  fastify.post<{ Body: CreateReviewBody }>(
    "/api/reviews",
    {
      config: { authz: { model: "edit" } },
      schema: {
        body: {
          type: "object",
          properties: {
            threatModelId: { type: "string" },
            reviewers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  role: { type: "string" },
                  required: { type: "boolean" },
                },
                required: ["userId", "role", "required"],
              },
              minItems: 1,
            },
            dueDate: { type: "string", format: "date-time" },
            priority: {
              type: "string",
              enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
            },
            reviewType: {
              type: "string",
              enum: ["INITIAL", "PERIODIC", "CHANGE", "COMPLIANCE"],
            },
            description: { type: "string" },
            scope: { type: "string" },
            workflowConfigId: { type: "string" },
          },
          required: ["threatModelId", "reviewers"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      // The body names the target model, so this is a cross-tenant WRITE
      // vector too. Opening a review is a write on the model (edit), and the
      // reviewers must be ACTIVE members of the model's organization —
      // otherwise a viewer could name themselves sign-off authority.
      const { threatModelId, reviewers } = request.body;
      if (!(await authorizeModelAction(reply, userId, threatModelId, "edit"))) {
        return reply;
      }
      const orgId = await getOrgIdFromModel(threatModelId);
      for (const reviewer of reviewers) {
        const access = orgId
          ? await checkOrganizationAccess(reviewer.userId, orgId)
          : null;
        if (!access?.hasAccess) {
          return sendBadRequest(
            reply,
            "Reviewers must be active members of the model's organization",
          );
        }
        // Signing off needs edit on the model; a sign-off authority without
        // it could never complete the review.
        if (
          reviewer.role === "SIGN_OFF_AUTHORITY" &&
          !access.permissions.includes("edit")
        ) {
          return sendBadRequest(
            reply,
            "A sign-off authority must have edit access (EDITOR or above) in the model's organization",
          );
        }
      }

      try {
        const review = await createReviewRequest({
          ...request.body,
          requestedById: userId,
          dueDate: request.body.dueDate
            ? new Date(request.body.dueDate)
            : undefined,
        });

        return sendSuccess(reply, review);
      } catch (error) {
        return sendBadRequest(
          reply,
          error instanceof Error ? error.message : "Failed to create review",
        );
      }
    },
  );

  // Get user's pending reviews
  fastify.get("/api/reviews/pending", AUTHENTICATED, async (request, reply) => {
    const userId = request.authUser?.id;
    if (!userId) {
      return sendUnauthorized(reply);
    }

    const reviews = await getUserPendingReviews(userId);

    return sendSuccess(reply, reviews);
  });

  // Get review by ID
  fastify.get<{ Params: { reviewId: string } }>(
    "/api/reviews/:reviewId",
    REVIEW_VIEW,
    async (request, reply) => {
      const userId = await reviewCaller(request, reply);
      if (!userId) return reply;

      const review = await getReviewRequest(request.params.reviewId);

      if (!review) {
        return sendNotFound(reply, "Review");
      }

      return sendSuccess(reply, review);
    },
  );

  // Get reviews for a threat model
  fastify.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/reviews",
    MODEL_VIEW,
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      // Same rule, model-scoped variant.
      if (!(await canAccessThreatModel(userId, request.params.modelId))) {
        return sendForbidden(reply, "Access denied");
      }

      const reviews = await getModelReviewRequests(request.params.modelId);

      return sendSuccess(reply, reviews);
    },
  );

  // Start review (mark as in progress)
  fastify.post<{ Params: { reviewId: string } }>(
    "/api/reviews/:reviewId/start",
    REVIEW_VIEW,
    async (request, reply) => {
      const userId = await reviewCaller(request, reply);
      if (!userId) return reply;

      try {
        const reviewer = await startReview(request.params.reviewId, userId);

        return sendSuccess(reply, reviewer);
      } catch (error) {
        return sendBadRequest(
          reply,
          error instanceof Error ? error.message : "Failed to start review",
        );
      }
    },
  );

  // Submit review decision
  fastify.post<{ Params: { reviewId: string }; Body: SubmitDecisionBody }>(
    "/api/reviews/:reviewId/decision",
    {
      ...REVIEW_VIEW,
      schema: {
        body: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: ["APPROVE", "REQUEST_CHANGES", "REJECT", "SIGN_OFF"],
            },
            comments: { type: "string" },
          },
          required: ["decision"],
        },
      },
    },
    async (request, reply) => {
      const userId = await reviewCaller(request, reply);
      if (!userId) return reply;

      try {
        const result = await submitReviewDecision({
          reviewRequestId: request.params.reviewId,
          reviewerId: userId,
          decision: request.body.decision,
          comments: request.body.comments,
        });

        return sendSuccess(reply, result);
      } catch (error) {
        return sendBadRequest(
          reply,
          error instanceof Error ? error.message : "Failed to submit decision",
        );
      }
    },
  );

  // Add comment to review
  fastify.post<{ Params: { reviewId: string }; Body: AddCommentBody }>(
    "/api/reviews/:reviewId/comments",
    {
      ...REVIEW_COMMENT,
      schema: {
        body: {
          type: "object",
          properties: {
            content: { type: "string", minLength: 1 },
            category: { type: "string" },
            referencedItemType: { type: "string" },
            referencedItemId: { type: "string" },
            parentCommentId: { type: "string" },
          },
          required: ["content"],
        },
      },
    },
    async (request, reply) => {
      const userId = await reviewCaller(request, reply, "comment");
      if (!userId) return reply;

      const comment = await addReviewComment({
        reviewRequestId: request.params.reviewId,
        userId,
        ...request.body,
      });

      // Fire-and-forget: notify @mentioned org members. Resolve the model id
      // from the review request so the existing dispatcher can scope members
      // to the right org.
      void (async () => {
        const prisma = await getPrisma();
        const review = await prisma.reviewRequest.findUnique({
          where: { id: request.params.reviewId },
          select: { threatModelId: true },
        });
        if (!review) return;
        await dispatchMentionNotifications({
          body: request.body.content,
          modelId: review.threatModelId,
          actorId: userId,
          actorName: request.authUser?.name ?? "Unknown",
          context: "a review comment",
          link: `/models/${review.threatModelId}?panel=review`,
        });
      })();

      return sendSuccess(reply, comment);
    },
  );

  // Resolve comment
  fastify.post<{ Params: { reviewId: string; commentId: string } }>(
    "/api/reviews/:reviewId/comments/:commentId/resolve",
    REVIEW_COMMENT,
    async (request, reply) => {
      const userId = await reviewCaller(request, reply, "comment");
      if (!userId) return reply;

      const comment = await resolveReviewComment(
        request.params.reviewId,
        request.params.commentId,
        userId,
      );
      if (!comment) {
        return sendNotFound(reply, "Comment");
      }

      return sendSuccess(reply, comment);
    },
  );

  // Complete checklist item
  fastify.post<{ Params: { reviewId: string }; Body: CompleteChecklistBody }>(
    "/api/reviews/:reviewId/checklist",
    {
      ...REVIEW_COMMENT,
      schema: {
        body: {
          type: "object",
          properties: {
            checklistItemId: { type: "string" },
            notes: { type: "string" },
          },
          required: ["checklistItemId"],
        },
      },
    },
    async (request, reply) => {
      const userId = await reviewCaller(request, reply, "comment");
      if (!userId) return reply;

      const checklist = await completeChecklistItem(
        request.params.reviewId,
        request.body.checklistItemId,
        userId,
        request.body.notes,
      );

      return sendSuccess(reply, checklist);
    },
  );

  // Sign off on review
  fastify.post<{ Params: { reviewId: string }; Body: SignOffBody }>(
    "/api/reviews/:reviewId/sign-off",
    {
      config: {
        authz: {
          handler:
            "edit on the review's model and a SIGN_OFF_AUTHORITY assignment",
        },
      },
      schema: {
        body: {
          type: "object",
          properties: {
            statement: { type: "string", minLength: 10 },
            expiresAt: { type: "string", format: "date-time" },
          },
          required: ["statement"],
        },
      },
    },
    async (request, reply) => {
      const userId = await reviewCaller(request, reply);
      if (!userId) return reply;

      // Signing off approves the model: the signer needs edit on it now, not
      // just a SIGN_OFF_AUTHORITY assignment made when the review was opened.
      const modelId = await reviewModelId(request.params.reviewId);
      if (!modelId) {
        return sendForbidden(reply, "Access denied");
      }
      if (!(await authorizeModelAction(reply, userId, modelId, "edit"))) {
        return reply;
      }

      try {
        const signOff = await signOffReview({
          reviewRequestId: request.params.reviewId,
          signedOffById: userId,
          statement: request.body.statement,
          expiresAt: request.body.expiresAt
            ? new Date(request.body.expiresAt)
            : undefined,
          metadata: {
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"],
          },
        });

        return sendSuccess(reply, signOff);
      } catch (error) {
        if (error instanceof InvalidReviewStateError) {
          return sendConflict(reply, error.message, {
            currentStatus: error.currentStatus,
          });
        }
        return sendBadRequest(
          reply,
          error instanceof Error ? error.message : "Failed to sign off",
        );
      }
    },
  );

  // Get review metrics
  fastify.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/review-metrics",
    MODEL_VIEW,
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      // Same rule, model-scoped variant.
      if (!(await canAccessThreatModel(userId, request.params.modelId))) {
        return sendForbidden(reply, "Access denied");
      }

      const metrics = await calculateReviewMetrics(request.params.modelId);

      return sendSuccess(reply, metrics);
    },
  );

  // Get review activity log
  fastify.get<{ Params: { reviewId: string } }>(
    "/api/reviews/:reviewId/activity",
    REVIEW_VIEW,
    async (request, reply) => {
      const userId = await reviewCaller(request, reply);
      if (!userId) return reply;

      const activity = await getReviewActivity(request.params.reviewId);

      return sendSuccess(reply, activity);
    },
  );
}
