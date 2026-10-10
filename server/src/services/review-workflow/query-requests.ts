/**
 * Review Workflow Service - Query Review Requests
 */

import { getPrisma } from "../../db.js";
import type { ReviewRequest } from "./types.js";
import { mapReviewRequest } from "./helpers.js";

/** Get review request by ID. */
export async function getReviewRequest(
  reviewRequestId: string,
): Promise<ReviewRequest | null> {
  const prisma = await getPrisma();

  const request = await prisma.reviewRequest.findUnique({
    where: { id: reviewRequestId },
    include: {
      assignments: true,
      comments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!request) return null;

  return mapReviewRequest(request, request.assignments, request.comments);
}

/** Get review requests for a threat model. */
export async function getModelReviewRequests(
  threatModelId: string,
): Promise<ReviewRequest[]> {
  const prisma = await getPrisma();

  const requests = await prisma.reviewRequest.findMany({
    where: { threatModelId },
    include: {
      assignments: true,
      comments: true,
    },
    orderBy: { requestedAt: "desc" },
  });

  return requests.map((r) => mapReviewRequest(r, r.assignments, r.comments));
}

/** Get pending reviews for a user. */
export async function getUserPendingReviews(
  userId: string,
): Promise<ReviewRequest[]> {
  const prisma = await getPrisma();

  const assignments = await prisma.reviewAssignment.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      reviewRequest: {
        include: {
          assignments: true,
          comments: true,
        },
      },
    },
  });

  return assignments.map((a) =>
    mapReviewRequest(
      a.reviewRequest,
      a.reviewRequest.assignments,
      a.reviewRequest.comments,
    ),
  );
}
