/**
 * Reporting Template Generation Handlers
 *
 * List report templates and generate an HTML report from a built-in template.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../utils/api-response.js";
import {
  BUILTIN_TEMPLATES,
  generateReport,
  type ReportData,
} from "../services/reports/template-engine.js";

export async function listTemplatesHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  return sendSuccess(
    reply,
    BUILTIN_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      format: t.format,
      sectionCount: t.sections.length,
    })),
  );
}

export async function generateReportHandler(
  request: FastifyRequest<{
    Params: { modelId: string };
    Body: { templateId?: string };
  }>,
  reply: FastifyReply,
) {
  const user = getAuthUser(request);
  const prisma = await getPrisma();
  const { modelId } = request.params;
  const { templateId = "executive-summary" } = request.body || {};

  const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return sendBadRequest(
      reply,
      `Unknown template: ${templateId}. Available: ${BUILTIN_TEMPLATES.map((t) => t.id).join(", ")}`,
    );
  }

  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: {
        include: {
          organization: {
            include: {
              memberships: { where: { userId: user.id, status: "ACTIVE" } },
            },
          },
        },
      },
      components: true,
      connections: true,
      threats: { include: { mitigations: true } },
    },
  });

  if (!model || model.project.organization.memberships.length === 0) {
    return sendNotFound(reply, "Threat model");
  }

  const reportData = buildReportData(model, user);

  const html = generateReport(template, reportData);
  reply.header("Content-Type", "text/html; charset=utf-8");
  reply.header(
    "Content-Disposition",
    `attachment; filename="${model.name.replace(/[^a-zA-Z0-9]/g, "_")}_report.html"`,
  );
  // Opened directly, the report still cannot run script or reach the API.
  reply.header(
    "Content-Security-Policy",
    "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  );
  return reply.send(html);
}

interface GenerateModel {
  name: string;
  components: Array<{
    name: string;
    type: string;
    trustLevel: string | null;
    nodeId: string;
  }>;
  connections: Array<{
    sourceComponentId: string;
    targetComponentId: string;
    protocol: string | null;
    encrypted: boolean;
  }>;
  threats: Array<{
    name: string;
    description: string | null;
    severity: string;
    status: string;
    strideCategories: string | null;
    componentNodeId: string | null;
    mitigations: Array<{
      id: string;
      description: string;
      status: string;
      priority: string;
    }>;
  }>;
}

/**
 * Assemble the ReportData payload consumed by the template engine.
 */
function buildReportData(
  model: GenerateModel,
  user: { name?: string | null; email?: string | null },
): ReportData {
  const threats = model.threats;
  const mitigations = threats.flatMap((t) => t.mitigations);
  const bySeverity: Record<string, number> = {};
  const byStride: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const t of threats) {
    bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    try {
      for (const c of JSON.parse(t.strideCategories || "[]"))
        byStride[c] = (byStride[c] || 0) + 1;
    } catch {
      // intentional — strideCategories parse failure silently skips entry
    }
  }

  return {
    modelName: model.name,
    generatedAt: new Date().toISOString(),
    generatedBy: user.name || user.email || "Unknown",
    connections: model.connections.map((c) => ({
      source: c.sourceComponentId,
      target: c.targetComponentId,
      protocol: c.protocol || undefined,
      encrypted: c.encrypted,
    })),
    components: model.components.map((c) => ({
      name: c.name,
      type: c.type,
      trustLevel: c.trustLevel || undefined,
      threatCount: threats.filter((t) => t.componentNodeId === c.nodeId).length,
    })),
    threats: threats.map((t) => ({
      name: t.name,
      description: t.description || undefined,
      severity: t.severity,
      status: t.status,
      strideCategory:
        (JSON.parse(t.strideCategories || "[]") as string[])[0] || "TAMPERING",
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
        threatName: parentThreat?.name || "Unknown",
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
          ? Math.round(
              (threats.filter((t) => t.status === "MITIGATED").length /
                threats.length) *
                100,
            )
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
