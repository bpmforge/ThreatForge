/**
 * Sign-off must not overwrite a REJECTED (or otherwise non-approved) review.
 *
 * `signOffReview` checked only that the caller held a `SIGN_OFF_AUTHORITY`
 * assignment on the review. It never read the review's current `status`, so it
 * would unconditionally create a `reviewSignOff` attestation and overwrite the
 * status to `SIGNED_OFF` even when the review was already `REJECTED` — an
 * attestation that contradicts a recorded rejection.
 *
 * Default ruling applied here (see PR body): sign-off is allowed only from
 * `APPROVED` — `workflow.ts` sets `APPROVED` specifically as "waiting for
 * sign-off", so that is the one state sign-off should ever fire from. Every
 * other status (DRAFT, PENDING_REVIEW, IN_REVIEW, CHANGES_REQUESTED, REJECTED,
 * and an already-SIGNED_OFF review) is refused.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { signOffReview } from "../signoff.js";
import { InvalidReviewStateError } from "../types.js";

const mockReviewSignOffCreate = vi.fn();
const mockReviewRequestUpdate = vi.fn();

const mockPrisma = {
  reviewAssignment: {
    findFirst: vi
      .fn()
      .mockResolvedValue({ id: "ra-1", role: "SIGN_OFF_AUTHORITY" }),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue({ id: "user-1", name: "Signer" }),
  },
  reviewRequest: {
    findUnique: vi.fn(),
    update: mockReviewRequestUpdate,
  },
  reviewSignOff: {
    create: mockReviewSignOffCreate,
  },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../notifications/index.js", () => ({
  getNotificationService: () => ({
    notify: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../helpers.js", () => ({
  logReviewActivity: vi.fn().mockResolvedValue(undefined),
}));

describe("signOffReview — status gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reviewAssignment.findFirst.mockResolvedValue({
      id: "ra-1",
      role: "SIGN_OFF_AUTHORITY",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Signer",
    });
    mockReviewSignOffCreate.mockResolvedValue({
      id: "so-1",
      reviewRequestId: "rr-1",
      signedOffById: "user-1",
      signedOffByName: "Signer",
      signedOffAt: new Date(),
      statement: "Looks good",
      expiresAt: null,
      metadata: null,
    });
    mockReviewRequestUpdate.mockResolvedValue({ id: "rr-1" });
  });

  it("refuses to sign off a REJECTED review and leaves it REJECTED", async () => {
    mockPrisma.reviewRequest.findUnique.mockResolvedValue({
      id: "rr-1",
      status: "REJECTED",
      threatModelId: "tm-1",
      threatModelName: "Model",
      requestedById: "user-2",
      assignments: [],
    });

    await expect(
      signOffReview({
        reviewRequestId: "rr-1",
        signedOffById: "user-1",
        statement: "Looks good",
      }),
    ).rejects.toThrow(InvalidReviewStateError);

    expect(mockReviewSignOffCreate).not.toHaveBeenCalled();
    expect(mockReviewRequestUpdate).not.toHaveBeenCalled();
  });

  it("refuses to sign off a review that is already SIGNED_OFF", async () => {
    mockPrisma.reviewRequest.findUnique.mockResolvedValue({
      id: "rr-1",
      status: "SIGNED_OFF",
      threatModelId: "tm-1",
      threatModelName: "Model",
      requestedById: "user-2",
      assignments: [],
    });

    await expect(
      signOffReview({
        reviewRequestId: "rr-1",
        signedOffById: "user-1",
        statement: "Looks good",
      }),
    ).rejects.toThrow(InvalidReviewStateError);

    expect(mockReviewSignOffCreate).not.toHaveBeenCalled();
    expect(mockReviewRequestUpdate).not.toHaveBeenCalled();
  });

  it("allows sign-off from APPROVED", async () => {
    mockPrisma.reviewRequest.findUnique.mockResolvedValueOnce({
      id: "rr-1",
      status: "APPROVED",
      threatModelId: "tm-1",
      threatModelName: "Model",
      requestedById: "user-2",
      assignments: [],
    });
    // Second findUnique call inside signOffReview re-reads the request for
    // notifications after the status update.
    mockPrisma.reviewRequest.findUnique.mockResolvedValueOnce({
      id: "rr-1",
      status: "SIGNED_OFF",
      threatModelId: "tm-1",
      threatModelName: "Model",
      requestedById: "user-2",
      assignments: [],
    });

    const result = await signOffReview({
      reviewRequestId: "rr-1",
      signedOffById: "user-1",
      statement: "Looks good",
    });

    expect(result.id).toBe("so-1");
    expect(mockReviewSignOffCreate).toHaveBeenCalledTimes(1);
    expect(mockReviewRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rr-1" },
        data: expect.objectContaining({ status: "SIGNED_OFF" }),
      }),
    );
  });
});
