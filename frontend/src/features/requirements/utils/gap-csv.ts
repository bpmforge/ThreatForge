import type { GapAnalysisResult } from "../services/gap-analysis-api";

/**
 * Build the gap-analysis CSV text (pure — no DOM/side effects, so it's unit
 * testable). Each value is double-quoted with embedded quotes doubled per RFC
 * 4180. Threats are tagged GAP or COVERED based on which set they came from.
 */
export function buildGapCsv(data: GapAnalysisResult): string {
  const rows = [
    ["ID", "Name", "Severity", "Category", "Status", "Mitigations", "CWEs"],
    ...[...data.gaps, ...data.covered].map((t) => [
      t.id,
      t.name,
      t.severity,
      t.category ?? "",
      data.gaps.some((g) => g.id === t.id) ? "GAP" : "COVERED",
      String(t.mitigationCount),
      t.cweIds.join("; "),
    ]),
  ];
  return rows
    .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function downloadGapCsv(data: GapAnalysisResult) {
  const csv = buildGapCsv(data);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gap-analysis.csv";
  a.click();
  URL.revokeObjectURL(url);
}
