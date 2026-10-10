/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma query result mappers */
/**
 * Review Workflow Service - Helper Functions
 *
 * Internal helper and mapper functions for review workflow.
 */

import { getPrisma } from "../../db.js";
import type {
  ReviewRequest,
  ReviewStatus,
  ReviewDecision,
  ReviewerRole,
  Reviewer,
  ReviewComment,
  ReviewActivityAction,
} from "./types.js";

/** Log review activity. */
export async function logReviewActivity(
  reviewRequestId: string,
  userId: string | null,
  action: ReviewActivityAction,
  details: Record<string, unknown>,
): Promise<void> {
  const prisma = await getPrisma();

  let userName: string | undefined;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    userName = user?.name || undefined;
  }

  await prisma.reviewActivity.create({
    data: {
      reviewRequestId,
      userId,
      userName,
      action,
      details: JSON.stringify(details),
    },
  });
}

/** Map database model to ReviewRequest type. */
export function mapReviewRequest(
  request: any,
  assignments: any[],
  comments: any[],
): ReviewRequest {
  return {
    id: request.id,
    threatModelId: request.threatModelId,
    threatModelName: request.threatModelName,
    version: request.version,
    status: request.status as ReviewStatus,
    requestedById: request.requestedById,
    requestedByName: request.requestedByName,
    requestedAt: request.requestedAt,
    dueDate: request.dueDate || undefined,
    priority: request.priority,
    reviewType: request.reviewType,
    description: request.description || undefined,
    scope: request.scope || undefined,
    reviewers: assignments.map(mapReviewer),
    comments: comments.map(mapComment),
    checklist: JSON.parse(request.checklist || "[]"),
    signOffRequired: request.signOffRequired,
    signOff: request.signOff
      ? {
          id: request.signOff.id,
          reviewRequestId: request.signOff.reviewRequestId,
          signedOffById: request.signOff.signedOffById,
          signedOffByName: request.signOff.signedOffByName,
          signedOffAt: request.signOff.signedOffAt,
          statement: request.signOff.statement,
          expiresAt: request.signOff.expiresAt || undefined,
        }
      : undefined,
    metadata: request.metadata ? JSON.parse(request.metadata) : undefined,
    completedAt: request.completedAt || undefined,
  };
}

/** Map database model to Reviewer type. */
export function mapReviewer(assignment: any): Reviewer {
  return {
    id: assignment.id,
    userId: assignment.userId,
    userName: assignment.userName,
    userEmail: assignment.userEmail,
    role: assignment.role as ReviewerRole,
    status: assignment.status,
    decision: assignment.decision as ReviewDecision | undefined,
    decisionAt: assignment.decisionAt || undefined,
    comments: assignment.comments || undefined,
    required: assignment.required,
    notifiedAt: assignment.notifiedAt || undefined,
    assignedAt: assignment.assignedAt || assignment.createdAt,
  };
}

/** Map database model to ReviewComment type. */
export function mapComment(comment: any): ReviewComment {
  return {
    id: comment.id,
    reviewRequestId: comment.reviewRequestId,
    userId: comment.userId,
    userName: comment.userName,
    content: comment.content,
    category: comment.category || undefined,
    referencedItemType: comment.referencedItemType || undefined,
    referencedItemId: comment.referencedItemId || undefined,
    isResolved: comment.isResolved,
    resolvedById: comment.resolvedById || undefined,
    resolvedAt: comment.resolvedAt || undefined,
    parentCommentId: comment.parentCommentId || undefined,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}
