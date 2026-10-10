/**
 * Review Workflow Service - Checklist Operations
 */

import { getPrisma } from "../../db.js";
import type { ChecklistItem } from "./types.js";
import { logReviewActivity } from "./helpers.js";

/** Complete a checklist item. */
export async function completeChecklistItem(
  reviewRequestId: string,
  checklistItemId: string,
  userId: string,
  notes?: string,
): Promise<ChecklistItem[]> {
  const prisma = await getPrisma();

  const request = await prisma.reviewRequest.findUnique({
    where: { id: reviewRequestId },
  });

  if (!request) {
    throw new Error("Review request not found");
  }

  const checklist = JSON.parse(request.checklist) as ChecklistItem[];
  const item = checklist.find((i) => i.id === checklistItemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  item.isCompleted = true;
  item.completedById = userId;
  item.completedAt = new Date();
  if (notes) item.notes = notes;

  await prisma.reviewRequest.update({
    where: { id: reviewRequestId },
    data: { checklist: JSON.stringify(checklist) },
  });

  await logReviewActivity(reviewRequestId, userId, "CHECKLIST_ITEM_COMPLETED", {
    itemId: checklistItemId,
    itemDescription: item.description,
  });

  return checklist;
}
