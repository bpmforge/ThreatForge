/**
 * Review Workflow Service - Workflow Operations
 *
 * Start reviews and submit decisions.
 */

import { getPrisma } from "../../db.js";
import { getNotificationService } from "../notifications/index.js";
import type {
  ReviewRequest,
  ReviewStatus,
  ReviewDecision,
  Reviewer,
  ReviewActivityAction,
} from "./types.js";
import { logReviewActivity, mapReviewer } from "./helpers.js";
import { getReviewRequest } from "./query-requests.js";

/** Start review (mark as in progress). */
export async function startReview(
  reviewRequestId: string,
  reviewerId: string,
): Promise<Reviewer> {
  const prisma = await getPrisma();

  const assignment = await prisma.reviewAssignment.findFirst({
    where: {
      reviewRequestId,
      userId: reviewerId,
    },
  });

  if (!assignment) {
    throw new Error("Reviewer assignment not found");
  }

  const updated = await prisma.reviewAssignment.update({
    where: { id: assignment.id },
    data: { status: "IN_PROGRESS" },
  });

  // Update review request status if this is the first reviewer
  const request = await prisma.reviewRequest.findUnique({
    where: { id: reviewRequestId },
  });

  if (request?.status === "PENDING_REVIEW") {
    await prisma.reviewRequest.update({
      where: { id: reviewRequestId },
      data: { status: "IN_REVIEW" },
    });
  }

  await logReviewActivity(reviewRequestId, reviewerId, "REVIEW_STARTED", {});

  return mapReviewer(updated);
}

/** Submit review decision. */
export async function submitReviewDecision(params: {
  reviewRequestId: string;
  reviewerId: string;
  decision: ReviewDecision;
  comments?: string;
}): Promise<{ request: ReviewRequest; allReviewsComplete: boolean }> {
  const prisma = await getPrisma();
  const notificationService = getNotificationService();

  const assignment = await prisma.reviewAssignment.findFirst({
    where: {
      reviewRequestId: params.reviewRequestId,
      userId: params.reviewerId,
    },
  });

  if (!assignment) {
    throw new Error("Reviewer assignment not found");
  }

  // Update assignment
  await prisma.reviewAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "COMPLETED",
      decision: params.decision,
      decisionAt: new Date(),
      comments: params.comments,
    },
  });

  // Log activity
  await logReviewActivity(
    params.reviewRequestId,
    params.reviewerId,
    "DECISION_MADE",
    {
      decision: params.decision,
    },
  );

  // Check if all required reviews are complete
  const allAssignments = await prisma.reviewAssignment.findMany({
    where: { reviewRequestId: params.reviewRequestId },
  });

  const requiredAssignments = allAssignments.filter((a) => a.required);
  const completedRequired = requiredAssignments.filter(
    (a) => a.status === "COMPLETED",
  );
  const allRequiredComplete =
    completedRequired.length === requiredAssignments.length;

  // Determine overall status
  let newStatus: ReviewStatus | null = null;

  if (params.decision === "REJECT") {
    newStatus = "REJECTED";
  } else if (params.decision === "REQUEST_CHANGES") {
    newStatus = "CHANGES_REQUESTED";
  } else if (allRequiredComplete) {
    // Check if any reviewer rejected or requested changes
    const hasRejection = completedRequired.some((a) => a.decision === "REJECT");
    const hasChangesRequest = completedRequired.some(
      (a) => a.decision === "REQUEST_CHANGES",
    );

    if (hasRejection) {
      newStatus = "REJECTED";
    } else if (hasChangesRequest) {
      newStatus = "CHANGES_REQUESTED";
    } else {
      // All approved - check if sign-off is required
      const request = await prisma.reviewRequest.findUnique({
        where: { id: params.reviewRequestId },
      });

      if (request?.signOffRequired) {
        newStatus = "APPROVED"; // Waiting for sign-off
      } else {
        newStatus = "APPROVED";
      }
    }
  }

  if (newStatus) {
    await prisma.reviewRequest.update({
      where: { id: params.reviewRequestId },
      data: { status: newStatus },
    });

    // Log status change activity
    const actionMap: Record<string, ReviewActivityAction> = {
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      CHANGES_REQUESTED: "CHANGES_REQUESTED",
    };
    if (actionMap[newStatus]) {
      await logReviewActivity(
        params.reviewRequestId,
        params.reviewerId,
        actionMap[newStatus],
        {},
      );
    }

    // Notify the requester
    const request = await prisma.reviewRequest.findUnique({
      where: { id: params.reviewRequestId },
    });

    if (request) {
      await notificationService.notify({
        type: "MODEL_STATUS_CHANGED",
        category: "MODEL",
        priority: newStatus === "REJECTED" ? "HIGH" : "NORMAL",
        recipientIds: [request.requestedById],
        data: {
          modelName: request.threatModelName,
          newStatus,
          reviewerName: assignment.userName,
        },
        link: `/models/${request.threatModelId}/review/${request.id}`,
      });
    }
  }

  // Get updated request
  const updatedRequest = await getReviewRequest(params.reviewRequestId);

  return {
    request: updatedRequest!,
    allReviewsComplete: allRequiredComplete,
  };
}
