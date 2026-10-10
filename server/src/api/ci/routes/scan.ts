/**
 * CI/CD API - Scan Routes
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { getPrisma } from "../../../db.js";
import { CreateScanSchema, type Severity } from "../schemas.js";
import {
  verifyApiKey,
  getAuthUser,
  runThreatScan,
  type Finding,
} from "../helpers.js";
import {
  sendSuccess,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
  sendInternalError,
  sendUnauthorized,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

/** Scan reads authenticate with an org CI API key instead of a session. */
const SCAN_READ_OPTIONS = {
  config: {
    skipAuth: true,
    authz: {
      public:
        "org CI API key (Bearer, any scope); scan must be in the key's org",
    },
  },
};

/** The org context of the request's `Bearer ftm_…` CI key, or null. */
async function ciKeyFromRequest(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyApiKey(authHeader.substring(7));
}

export const scanRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/ci/scan
   * Trigger a threat model scan for CI/CD
   */
  fastify.post(
    "/api/ci/scan",
    {
      config: {
        skipAuth: true,
        authz: {
          public:
            "org CI API key (Bearer) with ci:scan scope; model must be in the key's org",
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return sendUnauthorized(reply, "API key required");
      }

      const apiKey = authHeader.substring(7);
      const keyContext = await verifyApiKey(apiKey);

      if (!keyContext) {
        return sendUnauthorized(reply, "Invalid or expired API key");
      }

      if (!keyContext.scopes.includes("ci:scan")) {
        return sendForbidden(reply, "API key lacks ci:scan scope");
      }

      const parseResult = CreateScanSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Invalid request body", {
          details: parseResult.error.issues,
        });
      }

      const data = parseResult.data;
      const prisma = await getPrisma();

      const threatModel = await prisma.threatModel.findUnique({
        where: { id: data.threatModelId },
        include: { project: { select: { organizationId: true } } },
      });

      if (!threatModel) {
        return sendNotFound(reply, "Threat model");
      }

      if (threatModel.project.organizationId !== keyContext.organizationId) {
        return sendForbidden(
          reply,
          "Threat model not in authorized organization",
        );
      }

      const scan = await prisma.cIScan.create({
        data: {
          threatModelId: data.threatModelId,
          repositoryId: data.repositoryId,
          commitSha: data.commitSha,
          prNumber: data.prNumber,
          baseBranch: data.baseBranch,
          headBranch: data.headBranch,
          sourceType: data.sourceType,
          failOnSeverity: data.failOnSeverity,
          status: "IN_PROGRESS",
        },
      });

      try {
        const { findings, counts } = await runThreatScan(data.threatModelId);
        const shouldFail = checkSeverityThreshold(data.failOnSeverity, counts);

        const updatedScan = await prisma.cIScan.update({
          where: { id: scan.id },
          data: {
            status: "COMPLETED",
            findingsCount: findings.length,
            criticalCount: counts.critical,
            highCount: counts.high,
            mediumCount: counts.medium,
            lowCount: counts.low,
            infoCount: counts.info,
            findings: JSON.stringify(findings),
            scanCompletedAt: new Date(),
          },
        });

        return sendSuccess(reply, {
          scanId: updatedScan.id,
          status: updatedScan.status,
          conclusion: shouldFail ? "failure" : "success",
          summary: { total: findings.length, ...counts },
          findings: findings.slice(0, 50),
          scanUrl: `/api/ci/scans/${updatedScan.id}`,
          threatModelId: data.threatModelId,
          repositoryId: data.repositoryId,
          commitSha: data.commitSha,
          completedAt: updatedScan.scanCompletedAt,
        });
      } catch (error) {
        await prisma.cIScan.update({
          where: { id: scan.id },
          data: { status: "FAILED" },
        });
        fastify.log.error({ error, scanId: scan.id }, "CI scan failed");
        return sendInternalError(reply, "Failed to complete scan");
      }
    },
  );

  /**
   * GET /api/ci/scans/:scanId
   * Get scan status and results
   */
  fastify.get<{ Params: { scanId: string } }>(
    "/api/ci/scans/:scanId",
    SCAN_READ_OPTIONS,
    async (request, reply) => {
      const keyContext = await ciKeyFromRequest(request);
      if (!keyContext) {
        return sendUnauthorized(reply, "Valid CI API key required");
      }

      const prisma = await getPrisma();
      const scan = await prisma.cIScan.findUnique({
        where: { id: request.params.scanId },
        include: {
          threatModel: {
            include: {
              project: { select: { organizationId: true, name: true } },
            },
          },
        },
      });

      if (!scan) {
        return sendNotFound(reply, "Scan");
      }

      if (
        scan.threatModel.project.organizationId !== keyContext.organizationId
      ) {
        return sendForbidden(reply, "Scan not in authorized organization");
      }

      const findings = JSON.parse(scan.findings) as Finding[];

      return sendSuccess(reply, {
        scanId: scan.id,
        status: scan.status,
        threatModelId: scan.threatModelId,
        threatModelName: scan.threatModel.name,
        projectName: scan.threatModel.project.name,
        repositoryId: scan.repositoryId,
        prNumber: scan.prNumber,
        commitSha: scan.commitSha,
        baseBranch: scan.baseBranch,
        headBranch: scan.headBranch,
        sourceType: scan.sourceType,
        summary: {
          total: scan.findingsCount,
          critical: scan.criticalCount,
          high: scan.highCount,
          medium: scan.mediumCount,
          low: scan.lowCount,
          info: scan.infoCount,
        },
        findings,
        scanStartedAt: scan.scanStartedAt,
        scanCompletedAt: scan.scanCompletedAt,
        createdAt: scan.createdAt,
      });
    },
  );

  /**
   * GET /api/ci/scans
   * List scans for a threat model (requires user auth)
   */
  fastify.get<{
    Querystring: { threatModelId: string; page?: string; limit?: string };
  }>(
    "/api/ci/scans",
    routeAuthz({
      handler: "ACTIVE member of the model's org (guests refused)",
    }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();

      const { threatModelId, page: pageStr, limit: limitStr } = request.query;
      const page = parseInt(pageStr || "1", 10);
      const limit = Math.min(parseInt(limitStr || "20", 10), 100);
      const skip = (page - 1) * limit;

      const threatModel = await prisma.threatModel.findUnique({
        where: { id: threatModelId },
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
        },
      });

      if (
        !threatModel ||
        threatModel.project.organization.memberships.length === 0
      ) {
        return sendForbidden(reply, "Access denied to threat model");
      }

      const [scans, total] = await Promise.all([
        prisma.cIScan.findMany({
          where: { threatModelId },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            status: true,
            repositoryId: true,
            prNumber: true,
            commitSha: true,
            sourceType: true,
            findingsCount: true,
            criticalCount: true,
            highCount: true,
            scanStartedAt: true,
            scanCompletedAt: true,
            createdAt: true,
          },
        }),
        prisma.cIScan.count({ where: { threatModelId } }),
      ]);

      return sendSuccess(reply, {
        data: scans,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * GET /api/ci/scans/:scanId/diff
   * Get diff analysis between current scan and previous scan
   */
  fastify.get<{ Params: { scanId: string } }>(
    "/api/ci/scans/:scanId/diff",
    SCAN_READ_OPTIONS,
    async (request, reply) => {
      const keyContext = await ciKeyFromRequest(request);
      if (!keyContext) {
        return sendUnauthorized(reply, "Valid CI API key required");
      }

      const prisma = await getPrisma();
      const currentScan = await prisma.cIScan.findUnique({
        where: { id: request.params.scanId },
        include: {
          threatModel: {
            include: { project: { select: { organizationId: true } } },
          },
        },
      });

      if (!currentScan) {
        return sendNotFound(reply, "Scan");
      }

      if (
        currentScan.threatModel.project.organizationId !==
        keyContext.organizationId
      ) {
        return sendForbidden(reply, "Scan not in authorized organization");
      }

      const previousScan = await prisma.cIScan.findFirst({
        where: {
          threatModelId: currentScan.threatModelId,
          id: { not: currentScan.id },
          status: "COMPLETED",
          baseBranch: currentScan.baseBranch,
        },
        orderBy: { createdAt: "desc" },
      });

      const currentFindings = JSON.parse(currentScan.findings) as Finding[];

      if (!previousScan) {
        return sendSuccess(reply, {
          hasPrevious: false,
          currentScanId: currentScan.id,
          diff: {
            newThreats: currentFindings,
            resolvedThreats: [],
            unchangedThreats: [],
          },
        });
      }

      const previousFindings = JSON.parse(previousScan.findings) as Finding[];
      const previousIds = new Set(previousFindings.map((f) => f.threatId));
      const currentIds = new Set(currentFindings.map((f) => f.threatId));

      const newThreats = currentFindings.filter(
        (f) => !previousIds.has(f.threatId),
      );
      const resolvedThreats = previousFindings.filter(
        (f) => !currentIds.has(f.threatId),
      );
      const unchangedThreats = currentFindings.filter((f) =>
        previousIds.has(f.threatId),
      );

      return sendSuccess(reply, {
        hasPrevious: true,
        currentScanId: currentScan.id,
        previousScanId: previousScan.id,
        previousScanDate: previousScan.createdAt,
        diff: {
          newThreats,
          resolvedThreats,
          unchangedThreats,
          summary: {
            added: newThreats.length,
            removed: resolvedThreats.length,
            unchanged: unchangedThreats.length,
          },
        },
      });
    },
  );
};

/** Check if scan should fail based on severity threshold */
function checkSeverityThreshold(
  failOnSeverity: Severity | undefined,
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  },
): boolean {
  if (!failOnSeverity) return false;
  const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
  const thresholdIndex = severityOrder.indexOf(failOnSeverity);
  return (
    (counts.critical > 0 && thresholdIndex >= 0) ||
    (counts.high > 0 && thresholdIndex >= 1) ||
    (counts.medium > 0 && thresholdIndex >= 2) ||
    (counts.low > 0 && thresholdIndex >= 3) ||
    (counts.info > 0 && thresholdIndex >= 4)
  );
}
