/**
 * Scanner results routes
 *
 * Findings, statistics, history, status updates, and component mapping.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../../../utils/api-response.js";
import {
  getProjectFindings,
  getScanHistory,
  getFindingStats,
  mapFindingsToComponents,
} from "../../../services/security-scanners/index.js";
import { getPrisma } from "../../../db.js";
import type {
  ScannerType,
  NormalizedSeverity,
} from "../../../services/security-scanners/types.js";
import { authorizeProject } from "../index.js";
import { authorizeMemberModelAction } from "../../threat-models/helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

// Validation schemas
const GetFindingsSchema = z.object({
  scannerType: z
    .enum([
      "SNYK",
      "SONARQUBE",
      "CHECKMARX",
      "VERACODE",
      "OWASP_ZAP",
      "BURP",
      "CUSTOM",
    ])
    .optional(),
  severity: z
    .array(z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]))
    .optional(),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "FIXED", "DISMISSED", "FALSE_POSITIVE"])
    .optional(),
});

const UpdateFindingStatusSchema = z.object({
  status: z.enum([
    "OPEN",
    "IN_PROGRESS",
    "FIXED",
    "DISMISSED",
    "FALSE_POSITIVE",
  ]),
  dismissReason: z.string().optional(),
});

const MapToComponentSchema = z.object({
  componentId: z.string().min(1),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  mappingReason: z.string().optional(),
});

const PROJECT_VIEW = routeAuthz({
  handler: "org role with view on the project",
});
const PROJECT_EDIT = routeAuthz({
  handler: "org role with edit on the project",
});
const MEMBER_MODEL_VIEW = routeAuthz({
  handler: "org member (not a guest) with view on the model",
});
const MEMBER_MODEL_EDIT = routeAuthz({
  handler: "org member (not a guest) with edit on the model",
});

export async function scannerResultsRoutes(fastify: FastifyInstance) {
  /** GET /api/projects/:projectId/scanners/findings - Get project findings */
  fastify.get<{
    Params: { projectId: string };
    Querystring: Record<string, string>;
  }>(
    "/api/projects/:projectId/scanners/findings",
    PROJECT_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "view"))) {
        return reply;
      }

      const parsed = GetFindingsSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      const findings = await getProjectFindings(projectId, {
        scannerType: parsed.data.scannerType as ScannerType | undefined,
        severity: parsed.data.severity as NormalizedSeverity[] | undefined,
        status: parsed.data.status,
      });

      return sendSuccess(reply, findings);
    },
  );

  /** GET /api/projects/:projectId/scanners/findings/stats - Get finding statistics */
  fastify.get<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/scanners/findings/stats",
    PROJECT_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "view"))) {
        return reply;
      }

      const stats = await getFindingStats(projectId);
      return sendSuccess(reply, stats);
    },
  );

  /** GET /api/projects/:projectId/scanners/history - Get scan history */
  fastify.get<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/scanners/history",
    PROJECT_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "view"))) {
        return reply;
      }

      const history = await getScanHistory(projectId);
      return sendSuccess(reply, history);
    },
  );

  /** PATCH /api/projects/:projectId/scanners/findings/:findingId/status - Update finding status */
  fastify.patch<{ Params: { projectId: string; findingId: string } }>(
    "/api/projects/:projectId/scanners/findings/:findingId/status",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId, findingId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = UpdateFindingStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }

      const prisma = await getPrisma();
      const existing = await prisma.scannerFinding.findFirst({
        where: { id: findingId, projectId },
        select: { id: true },
      });
      if (!existing) {
        return sendNotFound(reply, "Finding");
      }

      const finding = await prisma.scannerFinding.update({
        where: { id: findingId },
        data: {
          status: parsed.data.status,
          dismissedById:
            parsed.data.status === "DISMISSED" ||
            parsed.data.status === "FALSE_POSITIVE"
              ? user.id
              : null,
          dismissedAt:
            parsed.data.status === "DISMISSED" ||
            parsed.data.status === "FALSE_POSITIVE"
              ? new Date()
              : null,
          dismissReason: parsed.data.dismissReason,
        },
      });

      return sendSuccess(reply, finding);
    },
  );

  /** POST /api/projects/:projectId/scanners/findings/:findingId/map - Map finding to component */
  fastify.post<{ Params: { projectId: string; findingId: string } }>(
    "/api/projects/:projectId/scanners/findings/:findingId/map",
    PROJECT_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { projectId, findingId } = request.params;

      if (!(await authorizeProject(reply, user.id, projectId, "edit"))) {
        return reply;
      }

      const parsed = MapToComponentSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parsed.error.flatten(),
        });
      }

      const prisma = await getPrisma();
      const [finding, component] = await Promise.all([
        prisma.scannerFinding.findFirst({
          where: { id: findingId, projectId },
          select: { id: true },
        }),
        prisma.component.findFirst({
          where: { id: parsed.data.componentId, threatModel: { projectId } },
          select: { id: true },
        }),
      ]);
      if (!finding) {
        return sendNotFound(reply, "Finding");
      }
      if (!component) {
        return sendNotFound(reply, "Component");
      }

      const mapping = await prisma.findingComponentMap.upsert({
        where: {
          findingId_componentId: {
            findingId,
            componentId: parsed.data.componentId,
          },
        },
        update: {
          confidence: parsed.data.confidence,
          mappingReason: parsed.data.mappingReason || "Manual mapping",
          verifiedById: user.id,
          verifiedAt: new Date(),
          isCorrect: true,
        },
        create: {
          findingId,
          componentId: parsed.data.componentId,
          confidence: parsed.data.confidence,
          mappingReason: parsed.data.mappingReason || "Manual mapping",
          verifiedById: user.id,
          verifiedAt: new Date(),
          isCorrect: true,
        },
      });

      return sendSuccess(reply, mapping);
    },
  );

  /** POST /api/threat-models/:modelId/scanners/auto-map - Auto-map findings to components */
  fastify.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/scanners/auto-map",
    MEMBER_MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      // Writes component mappings; members only (project-wide findings).
      if (
        !(await authorizeMemberModelAction(reply, user.id, modelId, "edit"))
      ) {
        return reply;
      }
      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        select: { projectId: true },
      });
      if (!model) return sendNotFound(reply, "Threat model");

      // Get all findings for this project
      const findings = await getProjectFindings(model.projectId);

      // Map to components
      const mappings = await mapFindingsToComponents(modelId, findings);

      // Store mappings
      for (const mapping of mappings) {
        const finding = await prisma.scannerFinding.findFirst({
          where: { externalId: mapping.findingId, projectId: model.projectId },
        });

        if (finding) {
          await prisma.findingComponentMap.upsert({
            where: {
              findingId_componentId: {
                findingId: finding.id,
                componentId: mapping.componentId,
              },
            },
            update: {
              confidence: mapping.confidence,
              mappingReason: mapping.mappingReason,
            },
            create: {
              findingId: finding.id,
              componentId: mapping.componentId,
              confidence: mapping.confidence,
              mappingReason: mapping.mappingReason,
            },
          });
        }
      }

      return sendSuccess(reply, {
        mappingsCreated: mappings.length,
        mappings,
      });
    },
  );

  /** GET /api/threat-models/:modelId/scanners/findings - Get findings mapped to model */
  fastify.get<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/scanners/findings",
    MEMBER_MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      // Project-wide scanner findings: members only.
      if (
        !(await authorizeMemberModelAction(reply, user.id, modelId, "view"))
      ) {
        return reply;
      }
      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        select: { projectId: true },
      });
      if (!model) return sendNotFound(reply, "Threat model");

      const findings = await prisma.scannerFinding.findMany({
        where: { threatModelId: modelId },
        include: {
          componentMappings: true,
        },
        orderBy: [{ severity: "asc" }, { lastSeen: "desc" }],
      });

      return sendSuccess(reply, findings);
    },
  );
}
