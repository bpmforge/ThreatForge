/**
 * Compliance Evidence API
 *
 * CRUD for control implementations and evidence artifacts.
 * Enables audit-grade tracking: which controls are addressed,
 * what evidence supports them, who verified.
 */
import type { FastifyPluginAsync } from "fastify";
import type { ImplementationStatus, EvidenceType } from "@prisma/client";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
} from "../utils/api-response.js";
import {
  authorizeModelAction as authorize,
  requireActiveOrgMemberOfModel,
} from "./threat-models/helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";

export const complianceEvidenceRoutes: FastifyPluginAsync = async (server) => {
  // ---------------------------------------------------------------
  // GET /api/threat-models/:modelId/compliance-evidence/:framework
  // List all control implementations for a model + framework
  // ---------------------------------------------------------------
  server.get<{ Params: { modelId: string; framework: string } }>(
    "/api/threat-models/:modelId/compliance-evidence/:framework",
    routeAuthz({ model: "view" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, framework } = request.params;
      if (!(await authorize(reply, user.id, modelId, "view"))) return reply;
      const prisma = await getPrisma();

      const implementations = await prisma.controlImplementation.findMany({
        where: { threatModelId: modelId, framework },
        include: {
          evidence: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { controlId: "asc" },
      });

      return sendSuccess(reply, { implementations });
    },
  );

  // ---------------------------------------------------------------
  // PUT /api/threat-models/:modelId/compliance-evidence/:framework/:controlId
  // Create or update a control implementation
  // ---------------------------------------------------------------
  server.put<{
    Params: { modelId: string; framework: string; controlId: string };
    Body: {
      controlName?: string;
      status?: string;
      actualCoverage?: number;
      ownerId?: string;
      dueDate?: string;
      notes?: string;
    };
  }>(
    "/api/threat-models/:modelId/compliance-evidence/:framework/:controlId",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const { modelId, framework, controlId } = request.params;
      const user = getAuthUser(request);
      if (!(await authorize(reply, user.id, modelId, "edit"))) return reply;
      if (
        !(await requireActiveOrgMemberOfModel(
          reply,
          modelId,
          request.body.ownerId,
          "Owner",
        ))
      ) {
        return reply;
      }
      const prisma = await getPrisma();

      const impl = await prisma.controlImplementation.upsert({
        where: {
          threatModelId_framework_controlId: {
            threatModelId: modelId,
            framework,
            controlId,
          },
        },
        create: {
          threatModelId: modelId,
          framework,
          controlId,
          controlName: request.body.controlName || controlId,
          status:
            (request.body.status as ImplementationStatus) || "NOT_STARTED",
          actualCoverage: request.body.actualCoverage,
          ownerId: request.body.ownerId,
          dueDate: request.body.dueDate
            ? new Date(request.body.dueDate)
            : undefined,
          notes: request.body.notes,
          createdById: user.id,
        },
        update: {
          ...(request.body.controlName && {
            controlName: request.body.controlName,
          }),
          ...(request.body.status && {
            status: request.body.status as ImplementationStatus,
          }),
          ...(request.body.actualCoverage !== undefined && {
            actualCoverage: request.body.actualCoverage,
          }),
          ...(request.body.ownerId !== undefined && {
            ownerId: request.body.ownerId,
          }),
          ...(request.body.dueDate !== undefined && {
            dueDate: request.body.dueDate
              ? new Date(request.body.dueDate)
              : null,
          }),
          ...(request.body.notes !== undefined && {
            notes: request.body.notes,
          }),
        },
      });

      return sendSuccess(reply, impl);
    },
  );

  // ---------------------------------------------------------------
  // POST /api/threat-models/:modelId/compliance-evidence/:framework/:controlId/verify
  // Mark a control as verified by a reviewer
  // ---------------------------------------------------------------
  server.post<{
    Params: { modelId: string; framework: string; controlId: string };
  }>(
    "/api/threat-models/:modelId/compliance-evidence/:framework/:controlId/verify",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const { modelId, framework, controlId } = request.params;
      const user = getAuthUser(request);
      if (!(await authorize(reply, user.id, modelId, "edit"))) return reply;
      const prisma = await getPrisma();

      const impl = await prisma.controlImplementation.update({
        where: {
          threatModelId_framework_controlId: {
            threatModelId: modelId,
            framework,
            controlId,
          },
        },
        data: {
          status: "VERIFIED",
          verifiedById: user.id,
          verifiedAt: new Date(),
        },
      });

      return sendSuccess(reply, impl);
    },
  );

  // ---------------------------------------------------------------
  // POST /api/threat-models/:modelId/compliance-evidence/:framework/:controlId/evidence
  // Add evidence to a control implementation
  // ---------------------------------------------------------------
  server.post<{
    Params: { modelId: string; framework: string; controlId: string };
    Body: {
      evidenceType: string;
      title: string;
      description?: string;
      url?: string;
    };
  }>(
    "/api/threat-models/:modelId/compliance-evidence/:framework/:controlId/evidence",
    routeAuthz({ model: "edit" }),
    async (request, reply) => {
      const { modelId, framework, controlId } = request.params;
      const user = getAuthUser(request);
      if (!(await authorize(reply, user.id, modelId, "edit"))) return reply;
      const prisma = await getPrisma();

      // Ensure implementation exists
      let impl = await prisma.controlImplementation.findUnique({
        where: {
          threatModelId_framework_controlId: {
            threatModelId: modelId,
            framework,
            controlId,
          },
        },
      });

      if (!impl) {
        impl = await prisma.controlImplementation.create({
          data: {
            threatModelId: modelId,
            framework,
            controlId,
            controlName: controlId,
            status: "IN_PROGRESS",
            createdById: user.id,
          },
        });
      }

      const evidence = await prisma.controlEvidence.create({
        data: {
          implementationId: impl.id,
          evidenceType: request.body.evidenceType as EvidenceType,
          title: request.body.title,
          description: request.body.description,
          url: request.body.url,
          createdById: user.id,
        },
      });

      return sendCreated(reply, evidence);
    },
  );

  // ---------------------------------------------------------------
  // DELETE /api/compliance-evidence/evidence/:evidenceId
  // Remove evidence from a control
  // ---------------------------------------------------------------
  server.delete<{ Params: { evidenceId: string } }>(
    "/api/compliance-evidence/evidence/:evidenceId",
    routeAuthz({
      handler:
        "'delete' permission (canPerformAction) on the threat model that owns the evidence row; 404 when the evidence does not exist",
    }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { evidenceId } = request.params;

      // Evidence ids are global; authorize against the model that owns it.
      const evidence = await prisma.controlEvidence.findUnique({
        where: { id: evidenceId },
        select: { implementation: { select: { threatModelId: true } } },
      });
      if (!evidence) return sendNotFound(reply, "Evidence");
      const modelId = evidence.implementation.threatModelId;
      if (!(await authorize(reply, user.id, modelId, "delete"))) return reply;

      await prisma.controlEvidence.delete({ where: { id: evidenceId } });
      return sendSuccess(reply, { deleted: true });
    },
  );
};
