/**
 * Threat model inheritance — pull threats from a parent model.
 *
 * POST /api/threat-models/:id/set-parent   { parentModelId }
 * POST /api/threat-models/:id/inherit-threats
 *
 * NOTE: requires `npx prisma db push && npx prisma generate` after
 * the parentModelId column is added to the schema.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  getAuthUser,
  canAccessThreatModel,
  authorizeModelAction,
} from "../helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

export const inheritRoutes: FastifyPluginAsync = async (server) => {
  /** Set the parent model for inheritance */
  server.post<{
    Params: { id: string };
    Body: { parentModelId: string | null };
  }>(
    "/api/threat-models/:id/set-parent",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      const { parentModelId } = request.body;

      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const model = await prisma.threatModel.findFirst({
        where: { id, deletedAt: null },
      });
      if (!model) return sendNotFound(reply, "Model");

      if (parentModelId) {
        if (parentModelId === id)
          return sendBadRequest(reply, "A model cannot inherit from itself");
        // The parent's threats get copied into :id, so the caller must be able
        // to read the parent.
        if (!(await canAccessThreatModel(user.id, parentModelId)))
          return sendNotFound(reply, "Parent model");
        const parent = await prisma.threatModel.findFirst({
          where: { id: parentModelId, deletedAt: null },
        });
        if (!parent) return sendNotFound(reply, "Parent model");
      }

      // Use raw SQL until `prisma generate` picks up the new column
      await prisma.$executeRawUnsafe(
        `UPDATE threat_models SET "parentModelId" = $1 WHERE id = $2`,
        parentModelId ?? null,
        id,
      );

      return sendSuccess(reply, { id, parentModelId: parentModelId ?? null });
    },
  );

  /** Copy OPEN threats from parent into this model (skipping name duplicates) */
  server.post<{ Params: { id: string } }>(
    "/api/threat-models/:id/inherit-threats",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const prisma = await getPrisma();

      // Get parentModelId via raw query (new column, not in generated client yet)
      const rows = await prisma.$queryRawUnsafe<
        { parentModelId: string | null }[]
      >(
        `SELECT "parentModelId" FROM threat_models WHERE id = $1 AND "deletedAt" IS NULL`,
        id,
      );
      if (!rows.length) return sendNotFound(reply, "Model");
      const { parentModelId } = rows[0]!;
      if (!parentModelId)
        return sendBadRequest(
          reply,
          "No parent model set — call set-parent first",
        );
      // Re-check: access to the parent may have been revoked since set-parent.
      if (!(await canAccessThreatModel(user.id, parentModelId)))
        return sendNotFound(reply, "Parent model");

      const parent = await prisma.threatModel.findFirst({
        where: { id: parentModelId, deletedAt: null },
        include: {
          threats: {
            where: { status: { in: ["OPEN", "MITIGATED"] } },
          },
        },
      });
      if (!parent) return sendNotFound(reply, "Parent model");

      const existing = await prisma.threat.findMany({
        where: { threatModelId: id },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));

      const toInherit = parent.threats.filter(
        (t) => !existingNames.has(t.name.toLowerCase()),
      );
      if (toInherit.length === 0) {
        return sendSuccess(reply, {
          inherited: 0,
          message: "All parent threats already exist in this model",
        });
      }

      for (const threat of toInherit) {
        const inheritedDesc = threat.description
          ? `${threat.description}\n\n[Inherited from: ${parent.name}]`
          : `[Inherited from: ${parent.name}]`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.threat as any).create({
          data: {
            threatModelId: id,
            name: threat.name,
            description: inheritedDesc,
            category: threat.category ?? undefined,
            severity: threat.severity,
          },
        });
      }

      return sendSuccess(reply, {
        inherited: toInherit.length,
        message: `Inherited ${toInherit.length} threat${toInherit.length !== 1 ? "s" : ""} from ${parent.name}`,
      });
    },
  );
};
