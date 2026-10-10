import type { ExecutiveSummary, KeyFinding, ThreatSummary } from "../types";

interface ModelData {
  name: string;
  nodes: Array<{ id: string; data: { name: string } }>;
  threats: Array<{
    title: string;
    severity: string;
    mitigations?: string[];
  }>;
}

function severityScore(severity: string): number {
  const scores: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return scores[severity] || 0;
}

function calculateOverallRisk(
  threats: ModelData["threats"],
): "low" | "medium" | "high" | "critical" {
  const criticalCount = threats.filter((t) => t.severity === "critical").length;
  const highCount = threats.filter((t) => t.severity === "high").length;
  const unmitigated = threats.filter((t) => !t.mitigations?.length).length;

  if (criticalCount > 2 || (criticalCount > 0 && unmitigated > 3))
    return "critical";
  if (highCount > 3 || criticalCount > 0) return "high";
  if (threats.length > 5) return "medium";
  return "low";
}

function generateKeyFindings(model: ModelData): KeyFinding[] {
  const findings: KeyFinding[] = [];
  const threats = model.threats;

  const criticalThreats = threats.filter((t) => t.severity === "critical");
  if (criticalThreats.length > 0) {
    findings.push({
      title: `${criticalThreats.length} Critical Security Vulnerabilities`,
      impact: "Immediate risk of data breach or system compromise",
      recommendation: "Address critical threats before production deployment",
    });
  }

  const unmitigated = threats.filter((t) => !t.mitigations?.length);
  if (unmitigated.length > 0) {
    findings.push({
      title: `${unmitigated.length} Unaddressed Threats`,
      impact: "Security gaps may be exploited by attackers",
      recommendation:
        "Develop mitigation strategies for all identified threats",
    });
  }

  return findings.slice(0, 5);
}

function generateRecommendations(threats: ModelData["threats"]): string[] {
  const recs: string[] = [];

  if (
    threats.some((t) => t.severity === "critical" && !t.mitigations?.length)
  ) {
    recs.push("Prioritize mitigation of critical threats immediately");
  }
  if (threats.length > 10) {
    recs.push("Consider phased remediation approach for large threat count");
  }
  recs.push("Schedule regular security reviews to track progress");
  recs.push("Establish ownership for each identified mitigation");

  return recs;
}

export function generateExecutiveSummary(model: ModelData): ExecutiveSummary {
  const threats = model.threats;
  const overallRisk = calculateOverallRisk(threats);

  const topThreats: ThreatSummary[] = threats
    .sort((a, b) => severityScore(b.severity) - severityScore(a.severity))
    .slice(0, 5)
    .map((t) => ({
      title: t.title,
      severity: t.severity,
      status: t.mitigations?.length ? "mitigated" : "open",
    }));

  return {
    title: `Security Assessment: ${model.name}`,
    date: new Date().toISOString(),
    preparedBy: "ThreatForge",
    overallRisk,
    keyFindings: generateKeyFindings(model),
    topThreats,
    recommendations: generateRecommendations(threats),
    nextSteps: [
      "Review and validate findings",
      "Assign owners to mitigations",
      "Schedule follow-up",
    ],
  };
}
