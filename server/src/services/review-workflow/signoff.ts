/**
 * Review Workflow Service - Sign-off Operations
 */

import { getPrisma } from "../../db.js";
import { getNotificationService } from "../notifications/index.js";
import { InvalidReviewStateError, type SignOff } from "./types.js";
import { logReviewActivity } from "./helpers.js";

// Sign-off is only valid coming out of APPROVED — workflow.ts sets
// APPROVED specifically as "waiting for sign-off". Every other status
// (including an already-SIGNED_OFF review) must be refused rather than
// silently overwritten.
const SIGNOFF_ELIGIBLE_STATUS = "APPROVED";

/** Sign off on a review. */
export async function signOffReview(params: {
  reviewRequestId: string;
  signedOffById: string;
  statement: string;
  expiresAt?: Date;
  metadata?: SignOff["metadata"];
}): Promise<SignOff> {
  const prisma = await getPrisma();
  const notificationService = getNotificationService();

  // Verify user has sign-off authority
  const assignment = await prisma.reviewAssignment.findFirst({
    where: {
      reviewRequestId: params.reviewRequestId,
      userId: params.signedOffById,
      role: "SIGN_OFF_AUTHORITY",
    },
  });

  if (!assignment) {
    throw new Error("User does not have sign-off authority for this review");
  }

  const currentRequest = await prisma.reviewRequest.findUnique({
    where: { id: params.reviewRequestId },
    select: { status: true },
  });

  if (!currentRequest) {
    throw new Error("Review request not found");
  }

  if (currentRequest.status !== SIGNOFF_ELIGIBLE_STATUS) {
    throw new InvalidReviewStateError(
      `Cannot sign off a review in status '${currentRequest.status}'; sign-off requires status '${SIGNOFF_ELIGIBLE_STATUS}'`,
      currentRequest.status,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: params.signedOffById },
    select: { name: true },
  });

  const signOff = await prisma.reviewSignOff.create({
    data: {
      reviewRequestId: params.reviewRequestId,
      signedOffById: params.signedOffById,
      signedOffByName: user?.name || "Unknown",
      statement: params.statement,
      expiresAt: params.expiresAt,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    },
  });

  // Update review status
  await prisma.reviewRequest.update({
    where: { id: params.reviewRequestId },
    data: {
      status: "SIGNED_OFF",
      completedAt: new Date(),
    },
  });

  await logReviewActivity(
    params.reviewRequestId,
    params.signedOffById,
    "SIGNED_OFF",
    {
      signOffId: signOff.id,
    },
  );

  // Notify all stakeholders
  const request = await prisma.reviewRequest.findUnique({
    where: { id: params.reviewRequestId },
    include: { assignments: true },
  });

  if (request) {
    const recipientIds = [
      request.requestedById,
      ...request.assignments.map((a) => a.userId),
    ].filter((id, index, self) => self.indexOf(id) === index);

    await notificationService.notify({
      type: "MODEL_STATUS_CHANGED",
      category: "MODEL",
      priority: "HIGH",
      recipientIds,
      data: {
        modelName: request.threatModelName,
        newStatus: "SIGNED_OFF",
        signedOffBy: user?.name,
      },
      link: `/models/${request.threatModelId}/review/${request.id}`,
    });
  }

  return {
    id: signOff.id,
    reviewRequestId: signOff.reviewRequestId,
    signedOffById: signOff.signedOffById,
    signedOffByName: signOff.signedOffByName,
    signedOffAt: signOff.signedOffAt,
    statement: signOff.statement,
    expiresAt: signOff.expiresAt || undefined,
    metadata: signOff.metadata ? JSON.parse(signOff.metadata) : undefined,
  };
}
