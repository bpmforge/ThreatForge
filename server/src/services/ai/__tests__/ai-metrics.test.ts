/**
 * M3 - parse failures and truncated replies aggregate per organization.
 */
import { describe, it, expect, vi, afterAll } from "vitest";

vi.mock("../../../db.js", () => ({ getPrisma: vi.fn() }));
vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { aiMetrics } from "../ai-metrics.js";

afterAll(() => aiMetrics.stop());

describe("aiMetrics quality counters", () => {
  it("sums parseFailures and truncatedResponses per org", () => {
    aiMetrics.recordQuality("org-a", { parseFailures: 3 });
    aiMetrics.recordQuality("org-a", {
      parseFailures: 2,
      truncatedResponses: 1,
    });
    aiMetrics.recordQuality("org-b", { truncatedResponses: 4 });

    const a = aiMetrics.getSummary("org-a");
    expect(a.parseFailures).toBe(5);
    expect(a.truncatedResponses).toBe(1);
    const b = aiMetrics.getSummary("org-b");
    expect(b.parseFailures).toBe(0);
    expect(b.truncatedResponses).toBe(4);
  });

  it("is zero for an org with no recorded jobs", () => {
    const s = aiMetrics.getSummary("org-none");
    expect(s.parseFailures).toBe(0);
    expect(s.truncatedResponses).toBe(0);
  });
});
