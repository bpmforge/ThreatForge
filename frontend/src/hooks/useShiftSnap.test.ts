import { describe, it, expect } from "vitest";
import { snapTo45 } from "./useShiftSnap";

const from = { x: 0, y: 0 };

describe("snapTo45", () => {
  it("no snap needed — endpoint already on 0° axis", () => {
    const result = snapTo45(from, { x: 100, y: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(0);
  });

  it("20° angle snaps to 0° (east — within ±22.5° of 0°)", () => {
    const to = {
      x: Math.cos((20 * Math.PI) / 180) * 100,
      y: Math.sin((20 * Math.PI) / 180) * 100,
    };
    const result = snapTo45(from, to);
    // Snapped to 0° — result is (100, 0) at the original distance
    const dist = Math.hypot(to.x, to.y);
    expect(result.x).toBeCloseTo(dist, 1);
    expect(result.y).toBeCloseTo(0, 1);
  });

  it("50° angle snaps to 45° (northeast)", () => {
    const to = {
      x: Math.cos((50 * Math.PI) / 180) * 100,
      y: Math.sin((50 * Math.PI) / 180) * 100,
    };
    const result = snapTo45(from, to);
    expect(result.x).toBeCloseTo(Math.cos(Math.PI / 4) * 100, 1);
    expect(result.y).toBeCloseTo(Math.sin(Math.PI / 4) * 100, 1);
  });

  it("distance is preserved across snap", () => {
    const to = { x: 80, y: 60 }; // distance = 100
    const result = snapTo45(from, to);
    expect(Math.hypot(result.x - from.x, result.y - from.y)).toBeCloseTo(
      100,
      1,
    );
  });

  it("non-zero source point — snap relative to source", () => {
    const src = { x: 50, y: 50 };
    const to = { x: 150, y: 60 }; // ~6° from horizontal → snaps to 0°
    const result = snapTo45(src, to);
    // Result should be roughly east of source, same distance
    const dist = Math.hypot(to.x - src.x, to.y - src.y);
    expect(result.x).toBeCloseTo(src.x + dist, 1);
    expect(result.y).toBeCloseTo(src.y, 1);
  });
});
