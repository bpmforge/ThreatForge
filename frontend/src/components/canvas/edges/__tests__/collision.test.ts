import { describe, it, expect } from "vitest";
import { computeLabelDodge } from "../collision";
describe("computeLabelDodge", () => {
  it("single label → perp=0 (nothing to dodge)", () => {
    const result = computeLabelDodge([
      { edgeId: "e1", midpoint: { x: 100, y: 100 }, offset: null },
    ]);
    expect(result[0].perp).toBe(0);
  });

  it("two auto labels far apart → no dodge (perp=0 each)", () => {
    const result = computeLabelDodge([
      { edgeId: "e1", midpoint: { x: 0, y: 0 }, offset: null },
      { edgeId: "e2", midpoint: { x: 200, y: 200 }, offset: null },
    ]);
    expect(result[0].perp).toBe(0);
    expect(result[1].perp).toBe(0);
  });

  it("two overlapping auto labels → dodge in opposite directions", () => {
    const result = computeLabelDodge([
      { edgeId: "e1", midpoint: { x: 100, y: 100 }, offset: null },
      { edgeId: "e2", midpoint: { x: 102, y: 100 }, offset: null },
    ]);
    // They should be dodged symmetrically: one positive, one negative
    expect(result[0].perp).not.toBe(0);
    expect(result[1].perp).not.toBe(0);
    expect(result[0].perp + result[1].perp).toBeCloseTo(0);
  });

  it("explicit offset label is not auto-dodged", () => {
    const result = computeLabelDodge([
      { edgeId: "e1", midpoint: { x: 100, y: 100 }, offset: "above" },
      { edgeId: "e2", midpoint: { x: 101, y: 100 }, offset: null },
    ]);
    // e1 has explicit offset → perp stays 0
    expect(result[0].perp).toBe(0);
    // e2 alone in auto cluster → also 0
    expect(result[1].perp).toBe(0);
  });

  it("three overlapping auto labels → evenly spread", () => {
    const result = computeLabelDodge([
      { edgeId: "e1", midpoint: { x: 50, y: 50 }, offset: null },
      { edgeId: "e2", midpoint: { x: 51, y: 50 }, offset: null },
      { edgeId: "e3", midpoint: { x: 52, y: 50 }, offset: null },
    ]);
    const perps = result.map((r) => r.perp).sort((a, b) => a - b);
    // Should be [-STEP, 0, +STEP]
    expect(perps[0]).toBeLessThan(0);
    expect(perps[1]).toBeCloseTo(0);
    expect(perps[2]).toBeGreaterThan(0);
    expect(perps[0]).toBeCloseTo(-perps[2]);
  });
});
