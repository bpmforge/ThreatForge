/**
 * Test worked-example: cleanup-2
 *
 * Invariant: cleanupSessionThreats MUST NOT delete ACCEPTED threats even
 * when they share a session id with deleted PENDING rows. Humans have
 * decided on ACCEPTED rows — they are sacred.
 *
 * If this test fails, a future refactor has probably widened the deleteMany
 * filter to drop the reviewStatus check. That would silently destroy human
 * review decisions on every job failure.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanupSessionThreats } from "../review-service.js";

const mockDeleteMany = vi.fn();
const mockPrisma = {
  threat: { deleteMany: mockDeleteMany },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("cleanupSessionThreats — human decisions are sacred (cleanup-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by source=AI_SUGGESTED AND reviewStatus=PENDING AND manuallyEdited=false", async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 3 });

    await cleanupSessionThreats("job-A");

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    const whereClause = mockDeleteMany.mock.calls[0][0].where;

    // The filter MUST carry all four guards. Removing any one would delete
    // human-reviewed or manual rows.
    expect(whereClause.analysisSessionId).toBe("job-A");
    expect(whereClause.source).toBe("AI_SUGGESTED");
    expect(whereClause.reviewStatus).toBe("PENDING");
    expect(whereClause.manuallyEdited).toBe(false);
  });

  it("empty sessionId is a no-op (does not query the DB)", async () => {
    const result = await cleanupSessionThreats("");
    expect(result).toEqual({ deleted: 0 });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("returns the count Prisma gives us", async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 7 });
    const result = await cleanupSessionThreats("job-X");
    expect(result).toEqual({ deleted: 7 });
  });
});
