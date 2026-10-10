/**
 * Persistence-time confidence floor.
 *
 * Without the floor, `aiConfidence` was written to the DB but never read as a
 * filter: `minCategoryConfidence` only gated a same-category retry, never
 * dropped anything at persist. `applyConfidenceFloor` runs once, right
 * before the final persist, on the deduped set.
 */
import { describe, it, expect } from "vitest";
import {
  applyConfidenceFloor,
  DEFAULT_MIN_PERSIST_CONFIDENCE,
} from "../confidence-floor.js";
import type { MicroThreat } from "../types.js";

function makeThreat(overrides: Partial<MicroThreat> = {}): MicroThreat {
  return {
    name: "Test threat",
    description: "",
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "c1",
    componentName: "Test",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.7,
    sourceMethodology: "stride",
    ...overrides,
  };
}

describe("applyConfidenceFloor", () => {
  it("default floor is 0.4", () => {
    expect(DEFAULT_MIN_PERSIST_CONFIDENCE).toBe(0.4);
  });

  it("drops a threat below the floor", () => {
    const threats = [makeThreat({ confidence: 0.2 })];
    const { kept, droppedCount } = applyConfidenceFloor(threats);
    expect(kept).toEqual([]);
    expect(droppedCount).toBe(1);
  });

  it("keeps a threat at or above the floor", () => {
    const atFloor = makeThreat({ confidence: 0.4, name: "at-floor" });
    const above = makeThreat({ confidence: 0.9, name: "above" });
    const { kept, droppedCount } = applyConfidenceFloor([atFloor, above]);
    expect(kept.map((t) => t.name)).toEqual(["at-floor", "above"]);
    expect(droppedCount).toBe(0);
  });

  it("never drops a template threat (ml_threat) regardless of confidence", () => {
    const template = makeThreat({
      confidence: 0.1,
      sourceMethodology: "ml_threat",
    });
    const { kept, droppedCount } = applyConfidenceFloor([template]);
    expect(kept).toEqual([template]);
    expect(droppedCount).toBe(0);
  });

  it("never drops a template threat (supply_chain) regardless of confidence", () => {
    const template = makeThreat({
      confidence: 0.0,
      sourceMethodology: "supply_chain",
    });
    const { kept, droppedCount } = applyConfidenceFloor([template]);
    expect(kept).toEqual([template]);
    expect(droppedCount).toBe(0);
  });

  it("respects a custom floor", () => {
    const threats = [makeThreat({ confidence: 0.5 })];
    const { kept, droppedCount } = applyConfidenceFloor(threats, 0.6);
    expect(kept).toEqual([]);
    expect(droppedCount).toBe(1);
  });

  it("mixed batch: drops only the low-confidence non-template threats", () => {
    const lowLlm = makeThreat({ confidence: 0.1, name: "low-llm" });
    const highLlm = makeThreat({ confidence: 0.9, name: "high-llm" });
    const lowTemplate = makeThreat({
      confidence: 0.05,
      name: "low-template",
      sourceMethodology: "ml_threat",
    });
    const { kept, droppedCount } = applyConfidenceFloor([
      lowLlm,
      highLlm,
      lowTemplate,
    ]);
    expect(kept.map((t) => t.name)).toEqual(["high-llm", "low-template"]);
    expect(droppedCount).toBe(1);
  });
});
