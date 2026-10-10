/**
 * Report Data Builder
 *
 * Extracts and assembles ReportData from a threat model ID.
 * Shared by reporting routes and the DOCX generator.
 */
import { getPrisma } from "../../db.js";
import type { ReportData } from "./template-engine.js";
import { resolveBranding } from "./branding.js";

/**
 * Build a ReportData object from a stored threat model.
 * Returns null if the model doesn't exist or the user lacks access.
 */
export async function buildReportData(
  modelId: string,
  userId: string,
): Promise<ReportData | null> {
  const prisma = await getPrisma();

  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: {
        include: {
          organization: {
            include: { memberships: { where: { userId, status: "ACTIVE" } } },
          },
        },
      },
      components: true,
      connections: true,
      threats: { include: { mitigations: true } },
    },
  });

  if (!model || model.project.organization.memberships.length === 0) {
    return null;
  }

  const threats = model.threats;
  const mitigations = threats.flatMap((t) => t.mitigations);
  const bySeverity: Record<string, number> = {};
  const byStride: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const t of threats) {
    bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    try {
      for (const c of JSON.parse(t.strideCategories || "[]") as string[]) {
        byStride[c] = (byStride[c] || 0) + 1;
      }
    } catch {
      // intentional — strideCategories parse failure silently skips entry
    }
  }

  const mitigatedCount = threats.filter((t) => t.status === "MITIGATED").length;

  return {
    modelName: model.name,
    generatedAt: new Date().toISOString(),
    branding: resolveBranding(model.project.organization),
    connections: model.connections.map((c) => ({
      source: c.sourceComponentId,
      target: c.targetComponentId,
      protocol: c.protocol ?? undefined,
      encrypted: c.encrypted,
    })),
    components: model.components.map((c) => ({
      name: c.name,
      type: c.type,
      trustLevel: c.trustLevel ?? undefined,
      threatCount: threats.filter((t) => t.componentNodeId === c.nodeId).length,
    })),
    threats: threats.map((t) => ({
      name: t.name,
      description: t.description ?? undefined,
      severity: t.severity,
      status: t.status,
      strideCategory:
        ((JSON.parse(t.strideCategories || "[]") as string[])[0] as string) ||
        "TAMPERING",
      componentName: model.components.find(
        (c) => c.nodeId === t.componentNodeId,
      )?.name,
      mitigationCount: t.mitigations.length,
    })),
    mitigations: mitigations.map((m) => {
      const parentThreat = threats.find((t) =>
        t.mitigations.some((mit) => mit.id === m.id),
      );
      return {
        description: m.description,
        status: m.status,
        priority: m.priority,
        threatName: parentThreat?.name ?? "Unknown",
      };
    }),
    summary: {
      totalComponents: model.components.length,
      totalConnections: model.connections.length,
      totalThreats: threats.length,
      threatsBySeverity: bySeverity,
      threatsByStride: byStride,
      threatsByStatus: byStatus,
      mitigationRate:
        threats.length > 0
          ? Math.round((mitigatedCount / threats.length) * 100)
          : 100,
      riskScore: Math.min(
        100,
        (bySeverity["CRITICAL"] || 0) * 25 +
          (bySeverity["HIGH"] || 0) * 10 +
          threats.filter((t) => t.status === "OPEN").length * 5,
      ),
    },
  };
}
