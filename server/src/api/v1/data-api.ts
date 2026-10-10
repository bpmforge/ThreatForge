/**
 * Public Data API v1
 *
 * Token-authenticated endpoints for CISO integrations and GRC tools.
 * Provides read access to threat models, threats, compliance status,
 * and risk summaries for external consumption.
 *
 * Auth: Bearer token (ftm_xxx) with appropriate scopes.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../db.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../../utils/api-response.js";
import {
  getFrameworkControls,
  getFrameworkCategories,
  getSupportedFrameworks,
  getFrameworkDisplayName,
} from "../../services/compliance/frameworks/index.js";
import { analyzeCompliance } from "../../services/compliance/compliance-service.js";
import { residualFraction } from "../../services/risk/residual-severity.js";
import { getAuthUser } from "../../utils/auth-helpers.js";
import { checkThreatModelAccess } from "../../services/access-control/access-control-service.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

const MEMBER_MODELS_ONLY = routeAuthz({
  handler: "lists only models in orgs where the caller is an active member",
});
const MODEL_VIEW = routeAuthz({ model: "view" });
const AUTHENTICATED = routeAuthz("authenticated");

export const dataApiRoutes: FastifyPluginAsync = async (server) => {
  // Every /:id route reads one threat model: refuse it unless the caller can
  // see that model (active member of its org, or a guest grant). Not-found and
  // no-access look the same so ids cannot be probed.
  server.addHook("preHandler", async (request, reply) => {
    const modelId = (request.params as { id?: string } | undefined)?.id;
    if (!modelId) return;
    const access = await checkThreatModelAccess(
      getAuthUser(request).id,
      modelId,
    );
    if (!access.hasAccess) {
      return sendNotFound(reply, "Threat model", modelId);
    }
  });

  // ---------------------------------------------------------------
  // GET /api/v1/threat-models — List threat models
  // Scope: read:models
  // ---------------------------------------------------------------
  server.get<{ Querystring: { projectId?: string } }>(
    "/threat-models",
    MEMBER_MODELS_ONLY,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();

      const where: Record<string, unknown> = {
        deletedAt: null,
        project: {
          deletedAt: null,
          organization: {
            deletedAt: null,
            memberships: { some: { userId: user.id, status: "ACTIVE" } },
          },
        },
      };
      if (request.query.projectId) {
        where.projectId = request.query.projectId;
      }

      const models = await prisma.threatModel.findMany({
        where,
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
          _count: { select: { threats: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      return sendSuccess(reply, {
        models: models.map((m) => ({
          id: m.id,
          name: m.name,
          version: m.version,
          status: m.status,
          tags: m.tags,
          threatCount: m._count.threats,
          projectId: m.projectId,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
      });
    },
  );

  // ---------------------------------------------------------------
  // GET /api/v1/threat-models/:id/threats — List threats with mitigations
  // Scope: read:threats
  // ---------------------------------------------------------------
  server.get<{ Params: { id: string } }>(
    "/threat-models/:id/threats",
    MODEL_VIEW,
    async (request, reply) => {
      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id: request.params.id },
        include: {
          threats: {
            include: {
              mitigations: {
                select: {
                  id: true,
                  description: true,
                  status: true,
                  priority: true,
                  strategy: true,
                  effectivenessScore: true,
                },
              },
              citations: {
                select: {
                  citationType: true,
                  section: { select: { anchor: true } },
                  referenceKind: true,
                  referenceId: true,
                  verificationStatus: true,
                },
              },
            },
          },
        },
      });

      if (!model) return sendNotFound(reply, "Threat model");

      return sendSuccess(reply, {
        modelId: model.id,
        modelName: model.name,
        threats: model.threats.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          severity: t.severity,
          status: t.status,
          strideCategories: JSON.parse(t.strideCategories || "[]"),
          componentNodeId: t.componentNodeId,
          connectionEdgeId: t.connectionEdgeId,
          cweIds: JSON.parse(t.cweIds || "[]"),
          owaspIds: JSON.parse(t.owaspIds || "[]"),
          mitigations: t.mitigations,
          verificationStatus: t.verificationStatus,
          citationAnchors: t.citations
            .filter((c) => c.citationType === "DOCUMENT" && c.section?.anchor)
            .map((c) => `§${c.section!.anchor}`),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      });
    },
  );

  // ---------------------------------------------------------------
  // GET /api/v1/threat-models/:id/compliance/:framework — Compliance analysis
  // Scope: read:models
  // ---------------------------------------------------------------
  server.get<{ Params: { id: string; framework: string } }>(
    "/threat-models/:id/compliance/:framework",
    MODEL_VIEW,
    async (request, reply) => {
      const { id, framework } = request.params;
      const supported = getSupportedFrameworks();

      if (!supported.includes(framework as (typeof supported)[number])) {
        return sendBadRequest(
          reply,
          `Unsupported framework: ${framework}. Supported: ${supported.join(", ")}`,
        );
      }

      const analysis = await analyzeCompliance(
        id,
        framework as Parameters<typeof analyzeCompliance>[1],
      );

      return sendSuccess(reply, analysis);
    },
  );

  // ---------------------------------------------------------------
  // GET /api/v1/threat-models/:id/risk-summary — Risk register export
  // Scope: read:models
  // ---------------------------------------------------------------
  server.get<{ Params: { id: string } }>(
    "/threat-models/:id/risk-summary",
    MODEL_VIEW,
    async (request, reply) => {
      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id: request.params.id },
        include: {
          threats: {
            include: { mitigations: true },
            orderBy: { severity: "asc" },
          },
        },
      });

      if (!model) return sendNotFound(reply, "Threat model");

      const severityWeight: Record<string, number> = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
        INFO: 0,
      };

      const threats = model.threats.map((t) => {
        const mitigationScores = t.mitigations
          .filter(
            (m) => m.effectivenessScore != null && m.status === "IMPLEMENTED",
          )
          .map((m) => m.effectivenessScore!);

        // Diminishing returns residual risk (shared model — see residual-severity.ts)
        const residualRisk = Math.round(
          residualFraction(mitigationScores) * 100,
        );

        return {
          riskId: t.id,
          threat: t.name,
          description: t.description,
          severity: t.severity,
          severityScore: severityWeight[t.severity] ?? 2,
          status: t.status,
          strideCategories: JSON.parse(t.strideCategories || "[]"),
          mitigationCount: t.mitigations.length,
          completedMitigations: t.mitigations.filter(
            (m) => m.status === "IMPLEMENTED",
          ).length,
          residualRiskPercent: residualRisk,
          treatmentDecision:
            t.status === "ACCEPTED"
              ? "ACCEPT"
              : t.status === "MITIGATED"
                ? "MITIGATE"
                : "NOT_IMPLEMENTED",
          verificationStatus: t.verificationStatus,
        };
      });

      const totalRisk = threats.reduce((s, t) => s + t.severityScore, 0);
      const avgResidual =
        threats.length > 0
          ? Math.round(
              threats.reduce((s, t) => s + t.residualRiskPercent, 0) /
                threats.length,
            )
          : 0;

      return sendSuccess(reply, {
        modelId: model.id,
        modelName: model.name,
        generatedAt: new Date().toISOString(),
        summary: {
          totalThreats: threats.length,
          critical: threats.filter((t) => t.severity === "CRITICAL").length,
          high: threats.filter((t) => t.severity === "HIGH").length,
          medium: threats.filter((t) => t.severity === "MEDIUM").length,
          low: threats.filter((t) => t.severity === "LOW").length,
          totalRiskScore: totalRisk,
          averageResidualRisk: avgResidual,
          verifiedThreats: threats.filter(
            (t) => t.verificationStatus === "VERIFIED",
          ).length,
          unverifiedThreats: threats.filter(
            (t) =>
              t.verificationStatus === "UNVERIFIED" ||
              t.verificationStatus === "PHANTOM",
          ).length,
          pendingVerification: threats.filter(
            (t) => t.verificationStatus === "PENDING" || !t.verificationStatus,
          ).length,
        },
        risks: threats,
      });
    },
  );

  // ---------------------------------------------------------------
  // GET /api/v1/compliance/frameworks — List all supported frameworks
  // Scope: read:models
  // ---------------------------------------------------------------
  server.get(
    "/compliance/frameworks",
    AUTHENTICATED,
    async (_request, reply) => {
      const frameworks = getSupportedFrameworks().map((f) => ({
        id: f,
        name: getFrameworkDisplayName(f),
        controlCount: getFrameworkControls(f).length,
        categoryCount: getFrameworkCategories(f).length,
      }));

      return sendSuccess(reply, { frameworks });
    },
  );
};
