/**
 * Unit cover for the parity spot-check mapping. The comparison itself is the
 * `compareThreatSets` helper (already tested in test/helpers/parity.test.ts);
 * here we prove the DB-row → ThreatLike mapping preserves the fields the
 * ADR-006 key + drift checks depend on, and that the two compose end-to-end.
 */
import { describe, it, expect } from "vitest";
import { toThreatLike } from "../../scripts/spot-check-parity.js";
import { compareThreatSets } from "./helpers/parity.js";

const row = (over: Record<string, unknown> = {}) => ({
  name: "SQL injection on the login form",
  category: "Tampering",
  severity: "HIGH" as const,
  componentNodeId: "node-1",
  connectionEdgeId: null,
  _count: { mitigations: 2 },
  ...over,
});

describe("toThreatLike", () => {
  it("maps componentNodeId → componentId and the mitigation count", () => {
    const t = toThreatLike(row());
    expect(t.componentId).toBe("node-1");
    expect(t.connectionEdgeId).toBeNull();
    expect(t.mitigationCount).toBe(2);
    expect(t.severity).toBe("HIGH");
    expect(t.category).toBe("Tampering");
  });

  it("defaults a null category to '' (parityKey is null-safe)", () => {
    expect(toThreatLike(row({ category: null })).category).toBe("");
  });
});

describe("spot-check mapping ∘ compareThreatSets", () => {
  it("identical runs → parity PASS", () => {
    const legacy = [
      row(),
      row({ name: "XSS in comments", category: "Spoofing" }),
    ];
    const v2 = [row(), row({ name: "XSS in comments", category: "Spoofing" })];
    const report = compareThreatSets(
      legacy.map(toThreatLike),
      v2.map(toThreatLike),
    );
    expect(report.pass).toBe(true);
    expect(report.onlyInA).toHaveLength(0);
    expect(report.onlyInB).toHaveLength(0);
  });

  it("a threat only in one run → parity FAIL (set inequality)", () => {
    const legacy = [row()];
    const v2 = [
      row(),
      row({ name: "Extra v2-only threat", category: "Spoofing" }),
    ];
    const report = compareThreatSets(
      legacy.map(toThreatLike),
      v2.map(toThreatLike),
    );
    expect(report.pass).toBe(false);
    expect(report.onlyInB.length).toBeGreaterThan(0);
  });

  it("severity drift > 1 ordinal step → parity FAIL", () => {
    const legacy = [row({ severity: "LOW" })];
    const v2 = [row({ severity: "CRITICAL" })]; // LOW(1) vs CRITICAL(4) = 3 > 1
    const report = compareThreatSets(
      legacy.map(toThreatLike),
      v2.map(toThreatLike),
    );
    expect(report.pass).toBe(false);
    expect(report.severityDrift.length).toBeGreaterThan(0);
  });

  it("severity drift of exactly 1 step → parity PASS (within ±1)", () => {
    const legacy = [row({ severity: "HIGH" })];
    const v2 = [row({ severity: "CRITICAL" })]; // HIGH(3) vs CRITICAL(4) = 1
    const report = compareThreatSets(
      legacy.map(toThreatLike),
      v2.map(toThreatLike),
    );
    expect(report.pass).toBe(true);
  });
});
