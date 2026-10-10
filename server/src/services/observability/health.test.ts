import { describe, it, expect } from "vitest";
import { checkMemory } from "./health.js";

describe("checkMemory", () => {
  it("is healthy on an idle process (heap measured against the V8 limit, not heapTotal)", () => {
    const result = checkMemory();
    expect(result.status).toBe("healthy");
    expect(result.details?.heapUsagePercent).toBeLessThan(75);
    expect(result.details?.heapLimitMB).toBeGreaterThan(
      result.details?.heapTotalMB as number,
    );
  });
});
