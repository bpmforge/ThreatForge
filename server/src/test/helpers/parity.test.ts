/**
 * Golden-run parity comparator tests.
 *
 * Proves:
 * - identical sets pass with empty diffs
 * - a renamed-but-paraphrase-equal threat (per the real ADR-006
 *   normalizeThreatName behavior) still passes
 * - a missing threat fails and its ADR-006 key is reported
 * - a severity 2-step drift fails; ±1 step passes
 * - drift > 10% of the intersection fails; ≤ 10% passes
 * - mitigation count drift > ±1 counts toward drift; ±1 passes
 */
import { describe, it, expect } from "vitest";
import {
  compareThreatSets,
  formatParityReport,
  parityKey,
  type ThreatLike,
} from "./parity.js";
import { normalizeThreatName } from "../../services/threat-review/normalize-threat-name.js";

function threat(overrides: Partial<ThreatLike> = {}): ThreatLike {
  return {
    name: "SQL injection in login form",
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "web-app-1",
    mitigations: [{}, {}],
    ...overrides,
  };
}

describe("parityKey", () => {
  it("builds the ADR-006 key ${targetKey}::${category}::${normalizedName}", () => {
    const t = threat();
    expect(parityKey(t)).toBe(
      `web-app-1::TAMPERING::${normalizeThreatName(t.name)}`,
    );
  });

  it("falls back to connectionEdgeId, then the __compound__ sentinel", () => {
    expect(
      parityKey(threat({ componentId: null, connectionEdgeId: "edge-7" })),
    ).toMatch(/^edge-7::/);
    expect(
      parityKey(threat({ componentId: "", connectionEdgeId: undefined })),
    ).toMatch(/^__compound__::/);
  });
});

describe("compareThreatSets — set membership", () => {
  it("identical sets pass with empty diffs", () => {
    const a = [
      threat(),
      threat({ name: "Credential stuffing", category: "SPOOFING" }),
    ];
    const b = [
      threat({ name: "Credential stuffing", category: "SPOOFING" }),
      threat(),
    ];

    const report = compareThreatSets(a, b);

    expect(report.pass).toBe(true);
    expect(report.onlyInA).toEqual([]);
    expect(report.onlyInB).toEqual([]);
    expect(report.severityDrift).toEqual([]);
    expect(report.mitigationDrift).toEqual([]);
    expect(report.intersectionSize).toBe(2);
  });

  it("renamed-but-paraphrase-equal threats map to the same key and pass", () => {
    // Documented normalizeThreatName equivalence class:
    //   "Missing authentication on gRPC endpoints"
    //   "gRPC endpoints lack authentication"  → same canonical form
    const a = [threat({ name: "Missing authentication on gRPC endpoints" })];
    const b = [threat({ name: "gRPC endpoints lack authentication" })];
    expect(normalizeThreatName(a[0].name)).toBe(normalizeThreatName(b[0].name));

    const report = compareThreatSets(a, b);

    expect(report.pass).toBe(true);
    expect(report.intersectionSize).toBe(1);
  });

  it("a missing threat fails with its key reported", () => {
    const missing = threat({ name: "Session fixation", category: "SPOOFING" });
    const a = [threat(), missing];
    const b = [threat()];

    const report = compareThreatSets(a, b);

    expect(report.pass).toBe(false);
    expect(report.onlyInA).toEqual([parityKey(missing)]);
    expect(report.onlyInB).toEqual([]);
    // The key surfaces in the printable report too.
    expect(formatParityReport(report)).toContain(parityKey(missing));
  });

  it("an extra threat in B fails via onlyInB", () => {
    const extra = threat({ name: "Log forging", category: "REPUDIATION" });
    const report = compareThreatSets([threat()], [threat(), extra]);

    expect(report.pass).toBe(false);
    expect(report.onlyInB).toEqual([parityKey(extra)]);
  });
});

describe("compareThreatSets — severity drift", () => {
  it("a 2-step severity drift fails", () => {
    const report = compareThreatSets(
      [threat({ severity: "LOW" })],
      [threat({ severity: "HIGH" })],
    );

    expect(report.pass).toBe(false);
    expect(report.severityDrift).toEqual([
      { key: parityKey(threat()), a: "LOW", b: "HIGH" },
    ]);
  });

  it("a ±1-step severity difference is tolerated", () => {
    const report = compareThreatSets(
      [threat({ severity: "MEDIUM" })],
      [threat({ severity: "HIGH" })],
    );

    expect(report.pass).toBe(true);
    expect(report.severityDrift).toEqual([]);
  });

  it("throws on an unknown severity value", () => {
    expect(() =>
      compareThreatSets(
        [threat({ severity: "SEVERE" as ThreatLike["severity"] })],
        [threat()],
      ),
    ).toThrow(/Unknown severity/);
  });
});

describe("compareThreatSets — mitigation drift", () => {
  it("mitigation count within ±1 passes", () => {
    const report = compareThreatSets(
      [threat({ mitigations: [{}, {}] })],
      [threat({ mitigations: [{}, {}, {}] })],
    );
    expect(report.pass).toBe(true);
  });

  it("mitigation count drift > ±1 counts as drift and fails", () => {
    const report = compareThreatSets(
      [threat({ mitigations: [] })],
      [threat({ mitigations: [{}, {}, {}] })],
    );

    expect(report.pass).toBe(false);
    expect(report.mitigationDrift).toEqual([
      { key: parityKey(threat()), a: 0, b: 3 },
    ]);
  });

  it("honors snapshot-shaped mitigationCount over mitigations.length", () => {
    const report = compareThreatSets(
      [threat({ mitigations: undefined, mitigationCount: 2 })],
      [threat({ mitigations: [{}, {}] })],
    );
    expect(report.pass).toBe(true);
    expect(report.mitigationDrift).toEqual([]);
  });
});

describe("compareThreatSets — 10% drift budget", () => {
  /** n intersecting threats, `drifted` of them with a 2-step severity gap. */
  function setsWithDrift(n: number, drifted: number) {
    const a: ThreatLike[] = [];
    const b: ThreatLike[] = [];
    for (let i = 0; i < n; i++) {
      // 3-digit numbers: the normalizer drops tokens shorter than 2 chars,
      // so single-digit names would collapse to the same key.
      const base = threat({ name: `Threat number ${100 + i}` });
      a.push({ ...base, severity: "LOW" });
      b.push({ ...base, severity: i < drifted ? "HIGH" : "LOW" });
    }
    return { a, b };
  }

  it("drift at exactly 10% of intersection passes", () => {
    const { a, b } = setsWithDrift(20, 2);
    const report = compareThreatSets(a, b);
    expect(report.intersectionSize).toBe(20);
    expect(report.severityDrift).toHaveLength(2);
    expect(report.pass).toBe(true);
  });

  it("drift above 10% of intersection fails", () => {
    const { a, b } = setsWithDrift(20, 3);
    const report = compareThreatSets(a, b);
    expect(report.severityDrift).toHaveLength(3);
    expect(report.pass).toBe(false);
  });

  it("severity and mitigation drift share the budget", () => {
    const { a, b } = setsWithDrift(20, 2); // exactly at budget
    // Push one mitigation drift on a non-drifted threat → over budget.
    a[19] = { ...a[19], mitigations: [] };
    b[19] = { ...b[19], mitigations: [{}, {}, {}] };

    const report = compareThreatSets(a, b);
    expect(report.severityDrift).toHaveLength(2);
    expect(report.mitigationDrift).toHaveLength(1);
    expect(report.pass).toBe(false);
  });

  it("empty sets pass vacuously", () => {
    const report = compareThreatSets([], []);
    expect(report.pass).toBe(true);
    expect(report.intersectionSize).toBe(0);
  });
});
