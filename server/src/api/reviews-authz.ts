/**
 * Per-resource authorization for review routes (register §8, S2).
 *
 * Every review route authenticated the caller and then trusted the `:reviewId`
 * in the URL. Authentication proves who you are; it says nothing about whether
 * this review is yours to read or write. Without the check, any signed-in user
 * could read another organisation's reviewer identities and comment threads,
 * and complete checklist items on their reviews.
 *
 * A review is reachable exactly when its threat model is, so this resolves the
 * review to its model and defers to the same `canAccessThreatModel` gate the
 * rest of the API uses. One authority for "may this user reach this model",
 * rather than a second rule that can drift from it.
 */
import { getPrisma } from "../db.js";
import { canAccessThreatModel } from "./threat-models/helpers.js";

/**
 * May this user reach this review?
 *
 * Returns false for a missing review rather than throwing, so callers answer
 * 403 for both "not yours" and "does not exist". Distinguishing them would let
 * an attacker enumerate review ids across organisations.
 */
export async function canAccessReview(
  userId: string,
  reviewId: string,
): Promise<boolean> {
  const modelId = await reviewModelId(reviewId);
  if (!modelId) return false;
  return canAccessThreatModel(userId, modelId);
}

/** The threat model a review belongs to, or null when there is no such review. */
export async function reviewModelId(reviewId: string): Promise<string | null> {
  const prisma = await getPrisma();
  const review = await prisma.reviewRequest.findUnique({
    where: { id: reviewId },
    select: { threatModelId: true },
  });
  return review?.threatModelId ?? null;
}
