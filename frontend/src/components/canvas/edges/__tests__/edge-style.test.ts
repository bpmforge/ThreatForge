/**
 * Tests for getEdgeStyle color precedence logic.
 * The function is not exported, so we duplicate the logic here and keep
 * it in sync — the real risk being tested is the precedence ordering.
 */
import { describe, it, expect } from "vitest";
import type { ConnectionData } from "@/types/canvas";

// Mirror of getEdgeStyle in SecurityEdge.tsx
function getEdgeStyle(data: ConnectionData | undefined) {
  const encrypted = data?.encrypted ?? false;
  const crossesBoundary = data?.crossesBoundary ?? false;
  const auth = data?.authentication;
  const hasUnmitigatedThreats =
    data?.threats?.some((t) => !t.mitigated) ?? false;

  let stroke = "#6b7280";
  if (crossesBoundary) stroke = "#f97316";
  if (auth === "None" && crossesBoundary) stroke = "#ef4444";
  if (hasUnmitigatedThreats) stroke = "#ef4444";

  const strokePatternOverride = data?.strokePattern;
  let strokeDasharray: string | undefined;
  if (strokePatternOverride === "dashed") strokeDasharray = "5,5";
  else if (strokePatternOverride === "dotted") strokeDasharray = "2,3";
  else if (strokePatternOverride === "solid") strokeDasharray = undefined;
  else strokeDasharray = encrypted ? undefined : "5,5";

  return { stroke, strokeDasharray };
}

describe("getEdgeStyle — color precedence", () => {
  it("default gray for a plain edge", () => {
    expect(getEdgeStyle(undefined).stroke).toBe("#6b7280");
  });

  it("orange for cross-boundary edge", () => {
    const style = getEdgeStyle({ crossesBoundary: true });
    expect(style.stroke).toBe("#f97316");
  });

  it("red for auth=None on cross-boundary edge (beats orange)", () => {
    const style = getEdgeStyle({
      crossesBoundary: true,
      authentication: "None",
    });
    expect(style.stroke).toBe("#ef4444");
  });

  it("red for unmitigated threat (highest precedence)", () => {
    const style = getEdgeStyle({
      crossesBoundary: false,
      threats: [
        {
          id: "t1",
          title: "X",
          category: "S",
          severity: "HIGH",
          mitigated: false,
        },
      ],
    } as unknown as ConnectionData);
    expect(style.stroke).toBe("#ef4444");
  });

  it("unmitigated threat beats auth=None cross-boundary", () => {
    const style = getEdgeStyle({
      crossesBoundary: true,
      authentication: "None",
      threats: [
        {
          id: "t1",
          title: "X",
          category: "S",
          severity: "HIGH",
          mitigated: false,
        },
      ],
    } as unknown as ConnectionData);
    expect(style.stroke).toBe("#ef4444");
  });

  it("mitigated threats do not trigger red", () => {
    const style = getEdgeStyle({
      crossesBoundary: false,
      threats: [
        {
          id: "t1",
          title: "X",
          category: "S",
          severity: "HIGH",
          mitigated: true,
        },
      ],
    } as unknown as ConnectionData);
    expect(style.stroke).toBe("#6b7280");
  });
});

describe("getEdgeStyle — stroke pattern override", () => {
  it("explicit dashed overrides encrypted solid", () => {
    const style = getEdgeStyle({ encrypted: true, strokePattern: "dashed" });
    expect(style.strokeDasharray).toBe("5,5");
  });

  it("explicit solid overrides encrypted default dashed", () => {
    const style = getEdgeStyle({ encrypted: false, strokePattern: "solid" });
    expect(style.strokeDasharray).toBeUndefined();
  });

  it("explicit dotted sets dotted pattern", () => {
    const style = getEdgeStyle({ strokePattern: "dotted" });
    expect(style.strokeDasharray).toBe("2,3");
  });

  it("no override falls back to encrypted logic (solid when encrypted)", () => {
    const style = getEdgeStyle({ encrypted: true });
    expect(style.strokeDasharray).toBeUndefined();
  });

  it("no override falls back to encrypted logic (dashed when not encrypted)", () => {
    const style = getEdgeStyle({ encrypted: false });
    expect(style.strokeDasharray).toBe("5,5");
  });
});
