import { describe, it, expect } from "vitest";
import { buildGapCsv } from "./gap-csv";
import type {
  GapAnalysisResult,
  GapThreat,
} from "../services/gap-analysis-api";

function threat(over: Partial<GapThreat>): GapThreat {
  return {
    id: "t1",
    name: "Threat",
    category: "TAMPERING",
    severity: "HIGH",
    cweIds: [],
    status: "OPEN",
    mitigationCount: 0,
    effectiveMitigationCount: 0,
    controlCategories: [],
    ...over,
  };
}

function result(over: Partial<GapAnalysisResult>): GapAnalysisResult {
  return {
    summary: {
      total: 0,
      covered: 0,
      gaps: 0,
      coveragePct: 0,
      gapsByStrideCategory: {},
      missingControlCategories: [],
    },
    covered: [],
    gaps: [],
    ...over,
  };
}

describe("buildGapCsv", () => {
  it("emits the header row first", () => {
    const csv = buildGapCsv(result({}));
    expect(csv.split("\n")[0]).toBe(
      '"ID","Name","Severity","Category","Status","Mitigations","CWEs"',
    );
  });

  it("tags gap threats GAP and covered threats COVERED", () => {
    const csv = buildGapCsv(
      result({
        gaps: [threat({ id: "g1", name: "Gap one" })],
        covered: [threat({ id: "c1", name: "Covered one" })],
      }),
    );
    const lines = csv.split("\n");
    expect(lines[1]).toContain('"g1"');
    expect(lines[1]).toContain('"GAP"');
    expect(lines[2]).toContain('"c1"');
    expect(lines[2]).toContain('"COVERED"');
  });

  it("escapes embedded double quotes per RFC 4180", () => {
    const csv = buildGapCsv(
      result({ gaps: [threat({ name: 'SQL "injection" risk' })] }),
    );
    expect(csv).toContain('"SQL ""injection"" risk"');
  });

  it("joins CWE ids with '; ' and stringifies mitigation count", () => {
    const csv = buildGapCsv(
      result({
        gaps: [threat({ cweIds: ["CWE-89", "CWE-79"], mitigationCount: 3 })],
      }),
    );
    const row = csv.split("\n")[1];
    expect(row).toContain('"CWE-89; CWE-79"');
    expect(row).toContain('"3"');
  });

  it("renders a null category as an empty cell", () => {
    const csv = buildGapCsv(result({ gaps: [threat({ category: null })] }));
    // Category is the 4th column → an empty quoted cell.
    expect(csv.split("\n")[1].split(",")[3]).toBe('""');
  });

  it("includes both gaps and covered in the body row count", () => {
    const csv = buildGapCsv(
      result({
        gaps: [threat({ id: "g1" }), threat({ id: "g2" })],
        covered: [threat({ id: "c1" })],
      }),
    );
    // header + 3 data rows
    expect(csv.split("\n")).toHaveLength(4);
  });
});
