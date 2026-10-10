import { describe, it, expect } from "vitest";
import {
  aggregateSystemicPatterns,
  normalizePatternKey,
  type PatternModelInput,
  type PatternThreatInput,
} from "./systemic-patterns.js";

function threat(over: Partial<PatternThreatInput>): PatternThreatInput {
  return {
    name: "T",
    category: null,
    severity: "MEDIUM",
    status: "OPEN",
    cweIds: "[]",
    ...over,
  };
}

function model(id: string, threats: PatternThreatInput[]): PatternModelInput {
  return { id, name: `Model ${id}`, projectName: `Proj ${id}`, threats };
}

describe("normalizePatternKey", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizePatternKey("  SQL-Injection!! in  API ")).toBe(
      "sql injection in api",
    );
  });
});

describe("aggregateSystemicPatterns", () => {
  const models = [
    model("a", [
      threat({
        name: "SQL Injection",
        severity: "CRITICAL",
        status: "OPEN",
        cweIds: '["CWE-89"]',
      }),
      threat({ name: "Unique to A", severity: "LOW" }),
    ]),
    model("b", [
      threat({
        name: "sql injection",
        severity: "HIGH",
        status: "MITIGATED",
        cweIds: '["cwe-89", "CWE-20"]',
      }),
    ]),
    model("c", [
      threat({
        name: "SQL  injection",
        severity: "HIGH",
        status: "OPEN",
        cweIds: "[89]",
      }),
      threat({ name: "Weak TLS", category: "Crypto" }),
    ]),
  ];

  it("groups the same normalized name across models with counts and severity mix", () => {
    const [top] = aggregateSystemicPatterns(models, 2).filter(
      (p) => p.kind === "name",
    );
    expect(top.key).toBe("sql injection");
    expect(top.modelCount).toBe(3);
    expect(top.threatCount).toBe(3);
    expect(top.unmitigatedCount).toBe(2);
    expect(top.severityMix).toEqual({ CRITICAL: 1, HIGH: 2 });
    expect(top.maxSeverity).toBe("CRITICAL");
    expect(top.affectedModels.map((m) => m.id).sort()).toEqual(["a", "b", "c"]);
    // Models with unmitigated instances sort first.
    expect(top.affectedModels[2].id).toBe("b");
  });

  it("normalizes CWE ids (case, bare numbers) and groups by CWE", () => {
    const cwe = aggregateSystemicPatterns(models, 2).find(
      (p) => p.kind === "cwe" && p.label === "CWE-89",
    );
    expect(cwe?.modelCount).toBe(3);
    expect(
      aggregateSystemicPatterns(models, 2).find((p) => p.label === "CWE-20"),
    ).toBeUndefined();
  });

  it("applies the minModels threshold on distinct models, not threat count", () => {
    const dup = [
      model("a", [threat({ name: "X" }), threat({ name: "X" })]),
      model("b", [threat({ name: "Y" })]),
    ];
    expect(aggregateSystemicPatterns(dup, 2)).toEqual([]);
    expect(aggregateSystemicPatterns(dup, 1).length).toBe(2);
  });

  it("groups by category and tolerates malformed cwe JSON", () => {
    const m = [
      model("a", [threat({ name: "A1", category: "Crypto", cweIds: "oops" })]),
      model("b", [threat({ name: "B1", category: "crypto" })]),
    ];
    const res = aggregateSystemicPatterns(m, 2);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ kind: "category", key: "crypto" });
  });

  it("sorts by model count, then unmitigated count", () => {
    const res = aggregateSystemicPatterns(models, 2);
    expect(res[0].modelCount).toBeGreaterThanOrEqual(res[1].modelCount);
  });
});
