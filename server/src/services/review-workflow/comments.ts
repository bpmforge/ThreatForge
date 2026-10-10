/**
 * Review Workflow Service - Comment Operations
 */

import { getPrisma } from "../../db.js";
import type { ReviewComment } from "./types.js";
import { logReviewActivity, mapComment } from "./helpers.js";

/** Add a review comment. */
export async function addReviewComment(params: {
  reviewRequestId: string;
  userId: string;
  content: string;
  category?: ReviewComment["category"];
  referencedItemType?: ReviewComment["referencedItemType"];
  referencedItemId?: string;
  parentCommentId?: string;
}): Promise<ReviewComment> {
  const prisma = await getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { name: true },
  });

  const comment = await prisma.reviewComment.create({
    data: {
      reviewRequestId: params.reviewRequestId,
      userId: params.userId,
      userName: user?.name || "Unknown",
      content: params.content,
      category: params.category,
      referencedItemType: params.referencedItemType,
      referencedItemId: params.referencedItemId,
      parentCommentId: params.parentCommentId,
      isResolved: false,
    },
  });

  await logReviewActivity(
    params.reviewRequestId,
    params.userId,
    "COMMENT_ADDED",
    {
      commentId: comment.id,
    },
  );

  return mapComment(comment);
}

/**
 * Resolve a comment of the given review. Returns null when the comment does
 * not exist or belongs to a different review.
 */
export async function resolveReviewComment(
  reviewRequestId: string,
  commentId: string,
  resolvedById: string,
): Promise<ReviewComment | null> {
  const prisma = await getPrisma();

  const existing = await prisma.reviewComment.findFirst({
    where: { id: commentId, reviewRequestId },
    select: { id: true },
  });
  if (!existing) return null;

  const comment = await prisma.reviewComment.update({
    where: { id: commentId },
    data: {
      isResolved: true,
      resolvedById,
      resolvedAt: new Date(),
    },
  });

  await logReviewActivity(reviewRequestId, resolvedById, "COMMENT_RESOLVED", {
    commentId,
  });

  return mapComment(comment);
}
