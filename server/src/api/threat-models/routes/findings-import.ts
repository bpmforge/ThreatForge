/**
 * Pentest Findings Import Route
 *
 * POST /api/threat-models/:modelId/import-findings
 *
 * Accepts a Burp Suite XML or OWASP ZAP JSON report (raw text body) and
 * creates already-confirmed threats — bypassing the AI review queue.
 * See docs/plans/PENTEST_IMPORT.md.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, authorizeModelAction } from "../helpers.js";
import { sendSuccess, sendBadRequest } from "../../../utils/api-response.js";
import {
  importFindings,
  type PentestSource,
} from "../../../services/import/pentest-importer.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

export const findingsImportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { modelId: string };
    Querystring: { format?: PentestSource };
    Body: string;
  }>(
    "/api/threat-models/:modelId/import-findings",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;
      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const raw =
        typeof request.body === "string"
          ? request.body
          : Buffer.isBuffer(request.body)
            ? (request.body as Buffer).toString("utf8")
            : "";
      if (!raw.trim()) {
        return sendBadRequest(reply, "Request body is empty");
      }
      if (raw.length > 10 * 1024 * 1024) {
        return sendBadRequest(reply, "Report exceeds 10MB limit");
      }

      const result = importFindings(raw, request.query.format);
      if (result.findings.length === 0) {
        return sendBadRequest(
          reply,
          result.warnings.join("; ") || "No findings parsed from report",
        );
      }

      const prisma = await getPrisma();
      const existing = await prisma.threat.findMany({
        where: { threatModelId: modelId },
        select: { name: true },
      });
      const seen = new Set(existing.map((t) => t.name.toLowerCase()));

      const toCreate = result.findings.filter((f) => {
        const key = f.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const skippedDuplicates = result.findings.length - toCreate.length;

      const created = await prisma.$transaction(
        toCreate.map((f) =>
          prisma.threat.create({
            data: {
              threatModelId: modelId,
              name: f.name,
              description: f.description,
              severity: f.severity,
              strideCategories: JSON.stringify([f.strideCategory]),
              cweIds: JSON.stringify(f.cweId ? [f.cweId] : []),
              status: "OPEN",
              source: "MANUAL",
              reviewStatus: "ACCEPTED",
              createdById: user.id,
            },
          }),
        ),
      );

      return sendSuccess(reply, {
        importedCount: created.length,
        skippedDuplicates,
        source: result.source,
        warnings: result.warnings,
        threats: created,
      });
    },
  );
};
