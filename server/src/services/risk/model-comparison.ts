/**
 * Multi-Model Risk Comparison
 *
 * Compares risk metrics across multiple threat models side-by-side.
 * Used by CISOs to identify which models need attention and track
 * risk trends across the portfolio.
 */
import { getPrisma } from "../../db.js";

interface ModelRiskSummary {
  id: string;
  name: string;
  projectName: string;
  updatedAt: Date;
  metrics: {
    totalThreats: number;
    openThreats: number;
    criticalCount: number;
    highCount: number;
    mitigationRate: number;
    riskScore: number;
    componentCount: number;
    connectionCount: number;
  };
}

export interface ComparisonResult {
  models: ModelRiskSummary[];
  averages: {
    riskScore: number;
    mitigationRate: number;
    threatsPerModel: number;
  };
  highestRisk: ModelRiskSummary | null;
  lowestRisk: ModelRiskSummary | null;
  needsAttention: ModelRiskSummary[]; // Models with CRITICAL open threats
}

const SEVERITY_WEIGHTS = { CRITICAL: 10, HIGH: 7, MEDIUM: 4, LOW: 1, INFO: 0 };

/**
 * Compare risk across multiple threat models.
 */
export async function compareModels(
  modelIds: string[],
): Promise<ComparisonResult> {
  const prisma = await getPrisma();

  const models = await prisma.threatModel.findMany({
    where: { id: { in: modelIds } },
    include: {
      project: { select: { name: true } },
      threats: {
        select: { severity: true, status: true },
      },
      components: { select: { id: true } },
      connections: { select: { id: true } },
    },
  });

  const summaries: ModelRiskSummary[] = models.map((model) => {
    const threats = model.threats;
    const open = threats.filter((t) => t.status === "OPEN");
    const mitigated = threats.filter((t) => t.status !== "OPEN");

    const riskScore = threats.reduce((sum, t) => {
      const weight =
        SEVERITY_WEIGHTS[t.severity as keyof typeof SEVERITY_WEIGHTS] || 0;
      const factor = t.status === "OPEN" ? 1 : 0.3;
      return sum + weight * factor;
    }, 0);

    return {
      id: model.id,
      name: model.name,
      projectName: model.project.name,
      updatedAt: model.updatedAt,
      metrics: {
        totalThreats: threats.length,
        openThreats: open.length,
        criticalCount: open.filter((t) => t.severity === "CRITICAL").length,
        highCount: open.filter((t) => t.severity === "HIGH").length,
        mitigationRate:
          threats.length > 0
            ? Math.round((mitigated.length / threats.length) * 100)
            : 100,
        riskScore: Math.round(riskScore),
        componentCount: model.components.length,
        connectionCount: model.connections.length,
      },
    };
  });

  const sorted = [...summaries].sort(
    (a, b) => b.metrics.riskScore - a.metrics.riskScore,
  );

  const totalModels = summaries.length || 1;
  const averages = {
    riskScore: Math.round(
      summaries.reduce((s, m) => s + m.metrics.riskScore, 0) / totalModels,
    ),
    mitigationRate: Math.round(
      summaries.reduce((s, m) => s + m.metrics.mitigationRate, 0) / totalModels,
    ),
    threatsPerModel: Math.round(
      summaries.reduce((s, m) => s + m.metrics.totalThreats, 0) / totalModels,
    ),
  };

  return {
    models: sorted,
    averages,
    highestRisk: sorted[0] || null,
    lowestRisk: sorted[sorted.length - 1] || null,
    needsAttention: summaries.filter((m) => m.metrics.criticalCount > 0),
  };
}
