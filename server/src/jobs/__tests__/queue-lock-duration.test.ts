/**
 * The ai-fast worker ran on BullMQ's 30-second default lockDuration.
 *
 * Asserted against exported constants rather than a constructed Worker: the
 * only existing coverage (`ai-flow.integration.test.ts`) builds its OWN Workers
 * with its own options, so it would stay green no matter what the production
 * config said. That is exactly how this survived.
 */
import { describe, it, expect } from "vitest";
import {
  AI_FAST_LOCK_DURATION_MS,
  AI_HEAVY_LOCK_DURATION_MS,
} from "../ai-queue.js";
import { DEFAULT_PROVIDER_TIMEOUT_MS } from "../../services/ai/provider-timeout.js";

/** BullMQ's default when the option is omitted — the value B9 was stuck on. */
const BULLMQ_DEFAULT_LOCK_MS = 30_000;

/**
 * Worst case for one ai-fast job: a provider call at the B4 ceiling, times
 * lmstudio's three transient retries, plus its 5s/10s linear backoff. Imported
 * rather than restated, so raising AI_PROVIDER_TIMEOUT_MS's default without
 * revisiting the lock fails here instead of silently narrowing the margin.
 */
const WORST_CASE_FAST_JOB_MS = DEFAULT_PROVIDER_TIMEOUT_MS * 3 + 15_000;

describe("ai-fast lock duration", () => {
  it("is not BullMQ's default", () => {
    expect(AI_FAST_LOCK_DURATION_MS).not.toBe(BULLMQ_DEFAULT_LOCK_MS);
  });

  it("covers the worst case of a single fan-out child", () => {
    expect(AI_FAST_LOCK_DURATION_MS).toBeGreaterThan(WORST_CASE_FAST_JOB_MS);
  });

  it("leaves margin after lock renewal, which happens at half the duration", () => {
    // The renewal timer is what actually protects a running job; the margin
    // against a blocked event loop is lockDuration/2, not lockDuration.
    expect(AI_FAST_LOCK_DURATION_MS / 2).toBeGreaterThan(
      WORST_CASE_FAST_JOB_MS / 2,
    );
    expect(AI_FAST_LOCK_DURATION_MS / 2).toBeGreaterThan(
      BULLMQ_DEFAULT_LOCK_MS,
    );
  });

  it("stays below the heavy queue, which carries much longer jobs", () => {
    expect(AI_FAST_LOCK_DURATION_MS).toBeLessThan(AI_HEAVY_LOCK_DURATION_MS);
  });
});

describe("ai-heavy lock duration", () => {
  it("still covers the 30+ minute jobs it was set for", () => {
    expect(AI_HEAVY_LOCK_DURATION_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });
});
