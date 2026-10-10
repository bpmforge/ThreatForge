import { describe, it, expect } from "vitest";
import { isTopologyImpossible } from "./verifier-checks.js";
import type { MicroThreat } from "../micro-analysis/types.js";

const idx = {
  componentIds: new Set(["c1"]),
  connectionIds: new Set(["e1"]),
} as unknown as Parameters<typeof isTopologyImpossible>[1];
const t = (componentId: string) => ({ componentId }) as unknown as MicroThreat;

describe("isTopologyImpossible — sentinels", () => {
  it("allows compound and supply-chain sentinel targets", () => {
    expect(isTopologyImpossible(t("compound"), idx)).toBe(false);
    expect(isTopologyImpossible(t("supply-chain"), idx)).toBe(false);
  });
  it("still refutes unknown targets and accepts real ones", () => {
    expect(isTopologyImpossible(t("ghost"), idx)).toBe(true);
    expect(isTopologyImpossible(t("c1"), idx)).toBe(false);
    expect(isTopologyImpossible(t("e1"), idx)).toBe(false);
  });
});
