/**
 * PR Comment Generator
 *
 * Generates markdown formatted PR comments for threat model scan results.
 */

import type { Finding, ScanSummary, DiffAnalysis, Severity } from "./types.js";

/** Comment marker for identifying ThreatForge comments */
export const COMMENT_MARKER = "<!-- threatforge-scan -->";

/** Severity emoji mapping */
const SEVERITY_EMOJI: Record<Severity, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🟢",
  INFO: "🔵",
};

/** Severity badge colors */
const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: "critical",
  HIGH: "important",
  MEDIUM: "warning",
  LOW: "success",
  INFO: "informational",
};

/** Generate severity badge */
function severityBadge(severity: Severity, count: number): string {
  if (count === 0) return "";
  const color = SEVERITY_COLORS[severity];
  return `![${severity}](https://img.shields.io/badge/${severity}-${count}-${color})`;
}

/** Generate status badge */
function statusBadge(status: "passing" | "failing" | "warning"): string {
  const colors = { passing: "success", failing: "critical", warning: "yellow" };
  const labels = { passing: "Passing", failing: "Failing", warning: "Warning" };
  return `![Status](https://img.shields.io/badge/Threat%20Model-${labels[status]}-${colors[status]})`;
}

/** Format finding as table row */
function findingRow(finding: Finding): string {
  const severity = `${SEVERITY_EMOJI[finding.severity as Severity]} ${finding.severity}`;
  const location = finding.componentName || finding.connectionLabel || "-";
  const categories = finding.strideCategories.join(", ") || "-";
  const status =
    finding.status === "MITIGATED"
      ? "✅"
      : finding.status === "ACCEPTED"
        ? "⚠️"
        : "❌";

  return `| ${severity} | ${finding.name} | ${location} | ${categories} | ${status} |`;
}

/** Generate summary statistics */
function generateSummary(
  summary: ScanSummary,
  conclusion: "success" | "failure" | "warning",
): string {
  const status =
    conclusion === "success"
      ? "passing"
      : conclusion === "failure"
        ? "failing"
        : "warning";
  const badges = [
    statusBadge(status),
    severityBadge("CRITICAL", summary.critical),
    severityBadge("HIGH", summary.high),
    severityBadge("MEDIUM", summary.medium),
    severityBadge("LOW", summary.low),
    severityBadge("INFO", summary.info),
  ]
    .filter(Boolean)
    .join(" ");

  return `
${badges}

| Metric | Count |
|--------|-------|
| Total Threats | ${summary.total} |
| Open | ${summary.open} |
| Mitigated | ${summary.mitigated} |
`;
}

/** Generate findings table */
function generateFindingsTable(findings: Finding[], title: string): string {
  if (findings.length === 0) return "";

  const header = `
### ${title}

| Severity | Threat | Location | STRIDE | Status |
|----------|--------|----------|--------|--------|`;

  const rows = findings.map(findingRow).join("\n");

  return `${header}\n${rows}`;
}

/** Generate recommendations based on findings */
function generateRecommendations(findings: Finding[]): string {
  const recommendations: string[] = [];

  // Critical threats require immediate action
  const criticalCount = findings.filter(
    (f) => f.severity === "CRITICAL" && f.status === "OPEN",
  ).length;
  if (criticalCount > 0) {
    recommendations.push(
      `🚨 **${criticalCount} critical threat(s)** require immediate attention before merging`,
    );
  }

  // High severity threats
  const highCount = findings.filter(
    (f) => f.severity === "HIGH" && f.status === "OPEN",
  ).length;
  if (highCount > 0) {
    recommendations.push(
      `⚠️ **${highCount} high severity threat(s)** should be addressed or accepted with justification`,
    );
  }

  // Unmitigated threats by STRIDE category
  const openByStride = findings
    .filter((f) => f.status === "OPEN")
    .reduce(
      (acc, f) => {
        f.strideCategories.forEach((cat) => {
          acc[cat] = (acc[cat] || 0) + 1;
        });
        return acc;
      },
      {} as Record<string, number>,
    );

  if (openByStride["ELEVATION_OF_PRIVILEGE"]) {
    recommendations.push(
      `🔓 Review **${openByStride["ELEVATION_OF_PRIVILEGE"]}** elevation of privilege threat(s) - check authorization controls`,
    );
  }
  if (openByStride["INFORMATION_DISCLOSURE"]) {
    recommendations.push(
      `📤 Review **${openByStride["INFORMATION_DISCLOSURE"]}** information disclosure threat(s) - check data encryption and access controls`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ All threats are either mitigated or accepted");
  }

  return `### Recommendations\n\n${recommendations.map((r) => `- ${r}`).join("\n")}`;
}

/** Generate full PR comment */
export function generatePRComment(
  findings: Finding[],
  summary: ScanSummary,
  threatModelName: string,
  scanUrl: string,
  conclusion: "success" | "failure" | "warning",
  diff?: DiffAnalysis,
): string {
  // Title
  const title =
    conclusion === "success"
      ? "## ✅ Threat Model Scan Passed"
      : conclusion === "failure"
        ? "## ❌ Threat Model Scan Failed"
        : "## ⚠️ Threat Model Scan Warning";

  // Summary section
  const summarySection = generateSummary(summary, conclusion);

  // Diff analysis (if available)
  let diffSection = "";
  if (diff) {
    if (diff.newThreats.length > 0) {
      diffSection += `\n### 🆕 New Threats in This PR\n\n`;
      diffSection += diff.newThreats
        .map(
          (t) =>
            `- ${SEVERITY_EMOJI[t.severity as Severity]} **${t.name}** (${t.severity})`,
        )
        .join("\n");
    }
    if (diff.resolvedThreats.length > 0) {
      diffSection += `\n### ✅ Resolved Threats\n\n`;
      diffSection += diff.resolvedThreats
        .map((t) => `- ~~${t.name}~~`)
        .join("\n");
    }
  }

  // Critical and high findings table (only show top issues)
  const criticalFindings = findings.filter(
    (f) => f.severity === "CRITICAL" || f.severity === "HIGH",
  );
  const findingsTable =
    criticalFindings.length > 0
      ? generateFindingsTable(
          criticalFindings.slice(0, 10),
          "Critical & High Severity Threats",
        )
      : "";

  // Recommendations
  const recommendations = generateRecommendations(findings);

  // Footer
  const footer = `
---
<details>
<summary>📊 View Full Report</summary>

**Threat Model:** ${threatModelName}
**Scan Details:** [View in ThreatForge](${scanUrl})

</details>

${COMMENT_MARKER}
_Generated by [ThreatForge](https://github.com/bpmforge/ThreatForge)_
`;

  return [
    title,
    summarySection,
    diffSection,
    findingsTable,
    recommendations,
    footer,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Generate check run summary */
export function generateCheckRunSummary(
  findings: Finding[],
  summary: ScanSummary,
  threatModelName: string,
): { title: string; summary: string; text: string } {
  const openCritical = findings.filter(
    (f) => f.severity === "CRITICAL" && f.status === "OPEN",
  ).length;
  const openHigh = findings.filter(
    (f) => f.severity === "HIGH" && f.status === "OPEN",
  ).length;

  let title: string;
  if (openCritical > 0) {
    title = `${openCritical} critical threat(s) found`;
  } else if (openHigh > 0) {
    title = `${openHigh} high severity threat(s) found`;
  } else if (summary.open > 0) {
    title = `${summary.open} open threat(s) found`;
  } else {
    title = "All threats mitigated or accepted";
  }

  const summaryText = `
## Threat Model: ${threatModelName}

| Severity | Count |
|----------|-------|
| Critical | ${summary.critical} |
| High | ${summary.high} |
| Medium | ${summary.medium} |
| Low | ${summary.low} |
| Info | ${summary.info} |

**Total:** ${summary.total} threats (${summary.open} open, ${summary.mitigated} mitigated)
`;

  const textDetails = findings
    .filter((f) => f.status === "OPEN")
    .slice(0, 50)
    .map(
      (f) =>
        `- **${f.name}** (${f.severity}): ${f.description || "No description"}`,
    )
    .join("\n");

  return {
    title,
    summary: summaryText,
    text: textDetails || "No open threats found.",
  };
}
