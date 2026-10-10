/**
 * Reporting Service - Calculation Functions
 */
import type {
  ReportPeriod,
  RiskDistribution,
  ThreatStatusDistribution,
  MitigationStatusDistribution,
  ThreatTrends,
  TopRiskItem,
} from "./types.js";

/** Get period start date. */
export function getPeriodStart(period: ReportPeriod): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "all":
      return new Date(0);
  }
}

/** Calculate risk distribution. */
export function calculateRiskDistribution(
  threats: Array<{ severity: string }>,
): RiskDistribution {
  const dist: RiskDistribution = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const threat of threats) {
    switch (threat.severity) {
      case "CRITICAL":
        dist.critical++;
        break;
      case "HIGH":
        dist.high++;
        break;
      case "MEDIUM":
        dist.medium++;
        break;
      case "LOW":
        dist.low++;
        break;
      default:
        dist.info++;
    }
  }
  return dist;
}

/** Calculate threat status distribution. */
export function calculateThreatStatusDistribution(
  threats: Array<{ status: string }>,
): ThreatStatusDistribution {
  const dist: ThreatStatusDistribution = {
    open: 0,
    inProgress: 0,
    mitigated: 0,
    accepted: 0,
    transferred: 0,
    closed: 0,
  };

  for (const threat of threats) {
    switch (threat.status) {
      case "OPEN":
        dist.open++;
        break;
      case "IN_PROGRESS":
        dist.inProgress++;
        break;
      case "MITIGATED":
        dist.mitigated++;
        break;
      case "ACCEPTED":
        dist.accepted++;
        break;
      case "TRANSFERRED":
        dist.transferred++;
        break;
      case "CLOSED":
        dist.closed++;
        break;
    }
  }
  return dist;
}

/** Calculate mitigation status distribution. */
export function calculateMitigationStatusDistribution(
  mitigations: Array<{
    status: string;
    verified?: boolean;
    obligation?: string;
  }>,
): MitigationStatusDistribution {
  const dist: MitigationStatusDistribution = {
    notImplemented: 0,
    implemented: 0,
    verified: 0,
    required: 0,
    recommended: 0,
  };

  for (const mit of mitigations) {
    if (mit.status === "IMPLEMENTED") {
      dist.implemented++;
      if (mit.verified) dist.verified++;
    } else {
      dist.notImplemented++;
    }
    if (mit.obligation === "REQUIRED") dist.required++;
    else dist.recommended++;
  }
  return dist;
}

/** Calculate threat trends over time. */
export function calculateTrends(
  threats: Array<{ createdAt: Date; status: string }>,
  periodStart: Date,
): ThreatTrends {
  const newThreats: Map<string, number> = new Map();
  const mitigatedThreats: Map<string, number> = new Map();
  const openThreats: Map<string, number> = new Map();

  for (const threat of threats) {
    if (threat.createdAt >= periodStart) {
      const dateKey = threat.createdAt.toISOString().split("T")[0];
      newThreats.set(dateKey, (newThreats.get(dateKey) || 0) + 1);

      if (threat.status === "MITIGATED" || threat.status === "CLOSED") {
        mitigatedThreats.set(dateKey, (mitigatedThreats.get(dateKey) || 0) + 1);
      } else if (threat.status === "OPEN" || threat.status === "IN_PROGRESS") {
        openThreats.set(dateKey, (openThreats.get(dateKey) || 0) + 1);
      }
    }
  }

  const sortedDates = Array.from(
    new Set([
      ...newThreats.keys(),
      ...mitigatedThreats.keys(),
      ...openThreats.keys(),
    ]),
  ).sort();

  return {
    newThreats: sortedDates.map((date) => ({
      date,
      value: newThreats.get(date) || 0,
    })),
    mitigatedThreats: sortedDates.map((date) => ({
      date,
      value: mitigatedThreats.get(date) || 0,
    })),
    openThreats: sortedDates.map((date) => ({
      date,
      value: openThreats.get(date) || 0,
    })),
  };
}

/** Get top risk items. */
export function getTopRisks(
  threats: Array<{
    id: string;
    name: string;
    severity: string;
    status: string;
    strideCategories: string;
    createdAt: Date;
    threatModelId: string;
    threatModelName: string;
  }>,
  limit: number,
): TopRiskItem[] {
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };

  const openThreats = threats
    .filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS")
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const now = new Date();

  return openThreats.slice(0, limit).map((t) => {
    let strideCategories: string[] = [];
    try {
      strideCategories = JSON.parse(t.strideCategories || "[]");
    } catch {
      strideCategories = [];
    }

    return {
      id: t.id,
      name: t.name,
      modelId: t.threatModelId,
      modelName: t.threatModelName,
      severity: t.severity,
      status: t.status,
      strideCategories,
      daysSinceCreated: Math.floor(
        (now.getTime() - t.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      ),
    };
  });
}

/** Calculate model risk score. */
export function calculateModelRiskScore(
  threats: Array<{
    severity: string;
    status: string;
    mitigations: Array<{ status: string }>;
  }>,
): number {
  if (threats.length === 0) return 0;

  const severityWeights: Record<string, number> = {
    CRITICAL: 10,
    HIGH: 7,
    MEDIUM: 4,
    LOW: 2,
    INFO: 1,
  };
  let totalWeight = 0;
  let mitigatedWeight = 0;

  for (const threat of threats) {
    const weight = severityWeights[threat.severity] || 1;
    totalWeight += weight;

    if (
      threat.status === "MITIGATED" ||
      threat.status === "CLOSED" ||
      threat.mitigations.some((m) => m.status === "IMPLEMENTED")
    ) {
      mitigatedWeight += weight;
    }
  }

  const mitigationCoverage =
    totalWeight > 0 ? mitigatedWeight / totalWeight : 1;
  return (1 - mitigationCoverage) * 10;
}

/** Calculate STRIDE category analysis. */
export function calculateStrideAnalysis(
  threats: Array<{
    strideCategories: string;
    status: string;
    mitigations: Array<{ status: string }>;
  }>,
): Array<{ category: string; count: number; mitigated: number }> {
  const categories = [
    "spoofing",
    "tampering",
    "repudiation",
    "informationDisclosure",
    "denial",
    "elevationOfPrivilege",
  ];

  const analysis = categories.map((category) => {
    let count = 0;
    let mitigated = 0;

    for (const threat of threats) {
      let strideCategories: string[] = [];
      try {
        strideCategories = JSON.parse(threat.strideCategories || "[]");
      } catch {
        strideCategories = [];
      }

      if (strideCategories.includes(category)) {
        count++;
        if (
          threat.status === "MITIGATED" ||
          threat.status === "CLOSED" ||
          threat.mitigations.some((m) => m.status === "IMPLEMENTED")
        ) {
          mitigated++;
        }
      }
    }
    return { category, count, mitigated };
  });

  return analysis.filter((a) => a.count > 0);
}
