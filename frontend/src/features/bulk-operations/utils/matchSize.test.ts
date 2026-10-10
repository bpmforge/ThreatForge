import { describe, it, expect } from "vitest";
import { computeMatchedSizes } from "./matchSize";

const ref = { width: 200, height: 100 };

const targets = [
  { id: "a", locked: false, width: 160, height: 60 },
  { id: "b", locked: false, width: 120, height: 40 },
  { id: "c", locked: true, width: 80, height: 30 },
];

describe("computeMatchedSizes", () => {
  it("width mode sets width to ref, keeps target height", () => {
    const result = computeMatchedSizes(ref, targets, "width");
    expect(result.get("a")).toEqual({ width: 200, height: 60 });
    expect(result.get("b")).toEqual({ width: 200, height: 40 });
  });

  it("height mode sets height to ref, keeps target width", () => {
    const result = computeMatchedSizes(ref, targets, "height");
    expect(result.get("a")).toEqual({ width: 160, height: 100 });
    expect(result.get("b")).toEqual({ width: 120, height: 100 });
  });

  it("both mode sets width and height to ref", () => {
    const result = computeMatchedSizes(ref, targets, "both");
    expect(result.get("a")).toEqual({ width: 200, height: 100 });
    expect(result.get("b")).toEqual({ width: 200, height: 100 });
  });

  it("excludes locked targets", () => {
    const result = computeMatchedSizes(ref, targets, "both");
    expect(result.has("c")).toBe(false);
  });

  it("returns empty map when all targets are locked", () => {
    const locked = [{ id: "x", locked: true, width: 100, height: 50 }];
    expect(computeMatchedSizes(ref, locked, "both").size).toBe(0);
  });

  it("handles empty targets array", () => {
    expect(computeMatchedSizes(ref, [], "both").size).toBe(0);
  });
});
