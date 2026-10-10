export interface ExecutiveSummary {
  title: string;
  date: string;
  preparedBy: string;
  overallRisk: "low" | "medium" | "high" | "critical";
  keyFindings: KeyFinding[];
  topThreats: ThreatSummary[];
  recommendations: string[];
  nextSteps: string[];
  riskTrend?: "improving" | "stable" | "worsening";
}

export interface KeyFinding {
  title: string;
  impact: string;
  recommendation: string;
}

export interface ThreatSummary {
  title: string;
  severity: string;
  status: "open" | "mitigated" | "accepted";
}
