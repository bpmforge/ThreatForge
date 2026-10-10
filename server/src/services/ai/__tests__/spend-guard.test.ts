/**
 * Tests for the AI spend cap guard (AI-SPEND).
 */
import { describe, it, expect, vi } from "vitest";
import {
  assertWithinSpendCap,
  replyIfOverSpendCap,
  SpendCapExceededError,
  AI_QUOTA_EXCEEDED_CODE,
} from "../spend-guard.js";
import { createSuggestThreatsJob } from "../../../jobs/create-suggest-threats-job.js";

function mockReply() {
  const reply = {
    request: { id: "req-1" },
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue(undefined),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return reply as any;
}

function mockPrisma(cap: number | null, spent: number) {
  return {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ monthlySpendCapUsd: cap }),
    },
    aIProvider: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { estimatedCost: spent } }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("assertWithinSpendCap", () => {
  it("allows when no cap is set (null = unlimited)", async () => {
    await expect(
      assertWithinSpendCap(mockPrisma(null, 9999), "org-1"),
    ).resolves.toBeUndefined();
  });

  it("allows when spend is under the cap", async () => {
    await expect(
      assertWithinSpendCap(mockPrisma(100, 42.5), "org-1"),
    ).resolves.toBeUndefined();
  });

  it("throws SpendCapExceededError when spend has reached the cap", async () => {
    await expect(
      assertWithinSpendCap(mockPrisma(100, 100), "org-1"),
    ).rejects.toBeInstanceOf(SpendCapExceededError);
  });

  it("throws when spend exceeds the cap, with a 429 status code", async () => {
    try {
      await assertWithinSpendCap(mockPrisma(50, 75), "org-1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SpendCapExceededError);
      expect((err as SpendCapExceededError).statusCode).toBe(429);
    }
  });

  it("treats missing aggregate sum as zero spend", async () => {
    const prisma = mockPrisma(100, 0);
    prisma.aIProvider.aggregate.mockResolvedValue({
      _sum: { estimatedCost: null },
    });
    await expect(
      assertWithinSpendCap(prisma, "org-1"),
    ).resolves.toBeUndefined();
  });
});

describe("replyIfOverSpendCap (D-02 enforcement at enqueue)", () => {
  it("under quota: returns false and sends nothing", async () => {
    const reply = mockReply();
    expect(await replyIfOverSpendCap(reply, mockPrisma(100, 40), "o")).toBe(
      false,
    );
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("at quota: sends 429 with AI_QUOTA_EXCEEDED and a clear message", async () => {
    const reply = mockReply();
    expect(await replyIfOverSpendCap(reply, mockPrisma(100, 100), "o")).toBe(
      true,
    );
    expect(reply.status).toHaveBeenCalledWith(429);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(AI_QUOTA_EXCEEDED_CODE);
    expect(body.error).toMatch(/spend cap reached/i);
  });

  it("over quota: sends 429", async () => {
    const reply = mockReply();
    expect(await replyIfOverSpendCap(reply, mockPrisma(50, 75), "o")).toBe(
      true,
    );
    expect(reply.status).toHaveBeenCalledWith(429);
  });

  it("no cap configured: allowed", async () => {
    const reply = mockReply();
    expect(await replyIfOverSpendCap(reply, mockPrisma(null, 999), "o")).toBe(
      false,
    );
  });
});

describe("createSuggestThreatsJob quota", () => {
  const args = {
    userId: "u",
    organizationId: "o",
    threatModelId: "m",
    input: "{}",
  };

  it("creates no job when over quota", async () => {
    const prisma = mockPrisma(10, 10);
    prisma.aiJob = { create: vi.fn() };
    await expect(
      createSuggestThreatsJob({ prisma, ...args }),
    ).rejects.toBeInstanceOf(SpendCapExceededError);
    expect(prisma.aiJob.create).not.toHaveBeenCalled();
  });

  it("creates the job when under quota", async () => {
    const prisma = mockPrisma(10, 1);
    prisma.aiJob = {
      create: vi.fn().mockResolvedValue({ id: "j1", threatModelId: "m" }),
    };
    const res = await createSuggestThreatsJob({ prisma, ...args });
    expect(res.conflict).toBe(false);
    expect(prisma.aiJob.create).toHaveBeenCalledTimes(1);
  });
});
