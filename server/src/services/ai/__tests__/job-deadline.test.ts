/**
 * The analysis loop is wall-clock bounded.
 *
 * The design constraint is asserted here as much as the arithmetic: the
 * deadline must STOP the loop, never throw. `processAiJob`'s failure handler
 * runs `cleanupSessionThreats` on FAILED, which deletes every AI_SUGGESTED /
 * PENDING row carrying the session id — and components are stream-persisted as
 * they finish. A throwing deadline would therefore destroy the partial results
 * it exists to preserve, making it strictly worse than the slow job.
 */
import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_ANALYSIS_BUDGET_MS,
  computeDeadlineAt,
  isPastDeadline,
  reportDeadlineStop,
} from "../job-deadline.js";
import { AI_HEAVY_LOCK_DURATION_MS } from "../../../jobs/ai-queue.js";

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("analysis budget vs the ai-heavy lock", () => {
  it("leaves headroom under the lock for the stages that run after the identifier", () => {
    // Deliberately not imported into job-deadline.ts (services must not depend
    // on the job layer), so this is the only thing stopping the two drifting.
    expect(DEFAULT_ANALYSIS_BUDGET_MS).toBeLessThan(AI_HEAVY_LOCK_DURATION_MS);
    const headroom = AI_HEAVY_LOCK_DURATION_MS - DEFAULT_ANALYSIS_BUDGET_MS;
    expect(headroom).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });
});

describe("computeDeadlineAt", () => {
  it("is absolute, so it cannot be re-derived per unit and drift", () => {
    const start = 1_000_000;
    expect(computeDeadlineAt(start)).toBe(start + DEFAULT_ANALYSIS_BUDGET_MS);
  });

  it("accepts an explicit budget", () => {
    expect(computeDeadlineAt(1_000, 500)).toBe(1_500);
  });
});

describe("isPastDeadline", () => {
  it("treats an absent deadline as unbounded — previous behaviour is preserved", () => {
    expect(isPastDeadline(undefined, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("is false before the deadline and true at or after it", () => {
    expect(isPastDeadline(1_000, 999)).toBe(false);
    expect(isPastDeadline(1_000, 1_000)).toBe(true);
    expect(isPastDeadline(1_000, 1_001)).toBe(true);
  });
});

describe("reportDeadlineStop", () => {
  it("names what was dropped, so a bounded run cannot read as a complete one", () => {
    const msg = reportDeadlineStop("runMicroAnalysis", 3, 7, 1_000);
    expect(msg).toContain("3");
    expect(msg).toContain("7");
    expect(msg).toMatch(/kept/i);
  });
});
