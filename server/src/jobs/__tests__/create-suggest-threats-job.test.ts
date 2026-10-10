/**
 * Enqueue mutex invariants: mutex-1, mutex-2, mutex-8
 *
 * Invariants:
 *   mutex-1: first enqueue for a model succeeds
 *   mutex-2: a second concurrent enqueue returns {conflict: true}
 *   mutex-8: non-P2002 Prisma errors BUBBLE UP — never swallowed as conflicts
 *
 * The third invariant is the subtle one. A future refactor that widens the
 * catch to `err instanceof PrismaError` would mask FK violations, timeouts,
 * and connection errors as "conflict" — the route would return 409 for what
 * should be 500, and the real error would be invisible.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSuggestThreatsJob } from "../create-suggest-threats-job.js";

vi.mock("../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makePrisma(overrides: {
  createImpl?: (
    args: unknown,
  ) => Promise<{ id: string; threatModelId: string | null }>;
  findFirstImpl?: (args: unknown) => Promise<{ id: string } | null>;
}) {
  return {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ monthlySpendCapUsd: null }),
    },
    aiJob: {
      create: vi.fn(overrides.createImpl),
      findFirst: vi.fn(overrides.findFirstImpl),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("createSuggestThreatsJob — per-model mutex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mutex-1: first enqueue for model returns {conflict: false, job}", async () => {
    const prisma = makePrisma({
      createImpl: () =>
        Promise.resolve({ id: "job-new", threatModelId: "modelX" }),
    });

    const result = await createSuggestThreatsJob({
      prisma,
      userId: "user-1",
      organizationId: "org-1",
      threatModelId: "modelX",
      input: "{}",
    });

    expect(result.conflict).toBe(false);
    expect(result.job).toEqual({ id: "job-new", threatModelId: "modelX" });
  });

  it("mutex-2: P2002 conflict returns {conflict: true, existingJobId}", async () => {
    const p2002 = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    const prisma = makePrisma({
      createImpl: () => Promise.reject(p2002),
      findFirstImpl: () => Promise.resolve({ id: "existing-job-123" }),
    });

    const result = await createSuggestThreatsJob({
      prisma,
      userId: "user-1",
      organizationId: "org-1",
      threatModelId: "modelX",
      input: "{}",
    });

    expect(result.conflict).toBe(true);
    expect(result.existingJobId).toBe("existing-job-123");
    expect(result.job).toBeUndefined();
  });

  it("mutex-8: non-P2002 Prisma errors bubble up — NOT rendered as conflicts", async () => {
    const p2003 = Object.assign(new Error("FK violation"), { code: "P2003" });
    const prisma = makePrisma({
      createImpl: () => Promise.reject(p2003),
    });

    await expect(
      createSuggestThreatsJob({
        prisma,
        userId: "user-1",
        organizationId: "org-1",
        threatModelId: "modelX",
        input: "{}",
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("mutex-8 (generic errors): non-code errors also bubble up", async () => {
    const generic = new Error("connection timeout");
    const prisma = makePrisma({
      createImpl: () => Promise.reject(generic),
    });

    await expect(
      createSuggestThreatsJob({
        prisma,
        userId: "user-1",
        organizationId: "org-1",
        threatModelId: "modelX",
        input: "{}",
      }),
    ).rejects.toThrow("connection timeout");
  });
});
