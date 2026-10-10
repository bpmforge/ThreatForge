/**
 * Scanner configuration routes
 *
 * Run scans via Snyk, SonarQube, and OWASP ZAP.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendInternalError,
} from "../../../utils/api-response.js";
import {
  runSnykScan,
  runSonarQubeScan,
  importZapScan,
  persistScanResults,
} from "../../../services/security-scanners/index.js";
import { authorizeProject } from "../index.js";
import { getPrisma } from "../../../db.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { checkTenantBaseUrl } from "../../../services/ai/private-host-policy.js";

// Validation schemas
const RunSnykScanSchema = z.object({
  snykProjectId: z.string().min(1),
  apiKey: z.string().min(1),
  orgId: z.string().optional(),
  threatModelId: z.string().optional(),
});

const RunSonarQubeScanSchema = z.object({
  sonarProjectKey: z.string().min(1),
  baseUrl: z.string().url(),
  token: z.string().min(1),
  threatModelId: z.string().optional(),
});

const ImportZapScanSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  targetUrl: z.string().url().optional(),
  threatModelId: z.string().optional(),
});

/** Project-scoped: an ACTIVE org member whose role grants edit. */
const PROJECT_EDIT = routeAuthz({
  handler: "org role with edit on the project",
});

/**
 * Scan results attach to `threatModelId`; it must be a model of the project in
 * the URL, or one tenant's scan lands in another tenant's model.
 */
async function modelInProject(
  threatModelId: string | undefined,
  projectId: string,
): Promise<boolean> {
  if (!threatModelId) return true;
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findFirst({
    where: { id: threatModelId, projectId },
    select: { id: true },
  });
  return model !== null;
}

export async function scannerConfigurationRoutes(fastify: FastifyInstance) {
  /** POST /api/projects/:projectId/scanners/snyk/scan - Run Snyk scan */
  fastify.post<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/scanners/snyk/scan",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = RunSnykScanSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }
      if (!(await modelInProject(parsed.data.threatModelId, projectId))) {
        return sendNotFound(reply, "Threat model");
      }

      try {
        const findings = await runSnykScan(
          projectId,
          parsed.data.snykProjectId,
          parsed.data.apiKey,
          parsed.data.orgId,
        );

        const scanRun = await persistScanResults(
          projectId,
          parsed.data.threatModelId,
          "SNYK",
          findings,
        );

        return sendSuccess(reply, {
          scanRun,
          findingsCount: findings.length,
          findings: findings.slice(0, 10), // Return first 10 for preview
        });
      } catch (error) {
        return sendInternalError(
          reply,
          error instanceof Error ? error.message : "Scan failed",
        );
      }
    },
  );

  /** POST /api/projects/:projectId/scanners/sonarqube/scan - Run SonarQube scan */
  fastify.post<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/scanners/sonarqube/scan",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = RunSonarQubeScanSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }
      const urlError = await checkTenantBaseUrl(parsed.data.baseUrl);
      if (urlError) return sendBadRequest(reply, urlError);
      if (!(await modelInProject(parsed.data.threatModelId, projectId))) {
        return sendNotFound(reply, "Threat model");
      }

      try {
        const findings = await runSonarQubeScan(
          projectId,
          parsed.data.sonarProjectKey,
          parsed.data.baseUrl,
          parsed.data.token,
        );

        const scanRun = await persistScanResults(
          projectId,
          parsed.data.threatModelId,
          "SONARQUBE",
          findings,
        );

        return sendSuccess(reply, {
          scanRun,
          findingsCount: findings.length,
          findings: findings.slice(0, 10),
        });
      } catch (error) {
        return sendInternalError(
          reply,
          error instanceof Error ? error.message : "Scan failed",
        );
      }
    },
  );

  /** POST /api/projects/:projectId/scanners/zap/import - Import ZAP scan */
  fastify.post<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/scanners/zap/import",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = ImportZapScanSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }
      const urlError = await checkTenantBaseUrl(parsed.data.baseUrl);
      if (urlError) return sendBadRequest(reply, urlError);
      if (!(await modelInProject(parsed.data.threatModelId, projectId))) {
        return sendNotFound(reply, "Threat model");
      }

      try {
        const findings = await importZapScan(
          projectId,
          parsed.data.baseUrl,
          parsed.data.apiKey,
          parsed.data.targetUrl,
        );

        const scanRun = await persistScanResults(
          projectId,
          parsed.data.threatModelId,
          "OWASP_ZAP",
          findings,
        );

        return sendSuccess(reply, {
          scanRun,
          findingsCount: findings.length,
          findings: findings.slice(0, 10),
        });
      } catch (error) {
        return sendInternalError(
          reply,
          error instanceof Error ? error.message : "Import failed",
        );
      }
    },
  );
}
