/**
 * Threat Model API - Attestation / Sign-off Routes (#57, G3)
 *
 * A model-level sign-off record: a named user attests the model is complete as
 * of a point in time, optionally anchored to a release. The attestedAt of the
 * most recent record is the baseline for the delta-since-sign-off view (#61).
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { logAudit } from "../../../services/audit.js";
import {
  getAuthUser,
  canAccessThreatModel,
  authorizeModelAction,
} from "../helpers.js";
import { sendNotFound } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

export const attestationRoutes: FastifyPluginAsync = async (fastify) => {
  /** GET /api/threat-models/:id/attestations — list sign-offs, newest first. */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/attestations",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await canAccessThreatModel(user.id, id))) {
        return sendNotFound(reply, "Threat model");
      }

      const attestations = await prisma.threatModelAttestation.findMany({
        where: { threatModelId: id },
        orderBy: { attestedAt: "desc" },
        include: {
          attestedBy: { select: { id: true, name: true, email: true } },
        },
      });
      return { data: attestations };
    },
  );

  /** POST /api/threat-models/:id/attestations — create a sign-off (edit access). */
  fastify.post<{
    Params: { id: string };
    Body: { releaseRef?: string; summary?: string };
  }>(
    "/api/threat-models/:id/attestations",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const model = await prisma.threatModel.findUnique({
        where: { id },
        select: { name: true, project: { select: { organizationId: true } } },
      });
      if (!model) return sendNotFound(reply, "Threat model");

      const releaseRef = request.body?.releaseRef?.slice(0, 200) || null;
      const summary = request.body?.summary?.slice(0, 2000) || null;

      const attestation = await prisma.threatModelAttestation.create({
        data: { threatModelId: id, userId: user.id, releaseRef, summary },
        include: {
          attestedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await logAudit({
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: id,
        resourceName: model.name,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId: model.project.organizationId,
        changes: { attestation: { old: null, new: { releaseRef, summary } } },
        metadata: { ip: request.ip, userAgent: request.headers["user-agent"] },
      });

      return reply.status(201).send({ data: attestation });
    },
  );
};
