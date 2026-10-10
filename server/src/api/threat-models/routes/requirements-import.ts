/**
 * Requirements Import Routes
 *
 * Three import paths for customer requirements:
 *   A. CSV bulk upload  — POST .../import/csv
 *   B. Framework import — POST .../import/framework
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, authorizeModelAction } from "../helpers.js";
import { sendSuccess, sendBadRequest } from "../../../utils/api-response.js";
import { FrameworkImportSchema } from "../schemas/requirements.js";
import {
  getFrameworkControls,
  getFrameworkDisplayName,
} from "../../../services/compliance/index.js";
import type { ComplianceFramework } from "../../../services/compliance/index.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

/** Parse CSV text into rows. Expects header: reqId,text,category */
function parseCsvRequirements(
  csv: string,
): Array<{ reqId: string; text: string; category?: string; error?: string }> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Detect if first line is a header
  const firstLower = lines[0].toLowerCase();
  const hasHeader =
    firstLower.includes("reqid") ||
    firstLower.includes("req_id") ||
    firstLower.includes("requirement");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    // Simple CSV split respecting quoted fields
    const cols = splitCsvLine(line);
    const reqId = cols[0]?.trim().replace(/^["']|["']$/g, "");
    const text = cols[1]?.trim().replace(/^["']|["']$/g, "");
    const category = cols[2]?.trim().replace(/^["']|["']$/g, "") || undefined;

    if (!reqId) return { reqId: "", text: text ?? "", error: "Missing reqId" };
    if (!text) return { reqId, text: "", error: "Missing text" };

    return { reqId, text, category };
  });
}

/** Split a single CSV line respecting double-quoted fields */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export const requirementsImportRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = await getPrisma();

  /**
   * POST /api/threat-models/:modelId/requirements/import/csv
   *
   * Accepts a CSV body (text/csv or application/octet-stream) with columns:
   *   reqId, text, category  (category is optional)
   *
   * Query params:
   *   preview=true  — parse and validate only, no DB writes
   *
   * Returns a preview of rows with per-row status: "new" | "duplicate" | "error"
   * On commit (preview=false or omitted), inserts all valid new rows.
   */
  fastify.post<{
    Params: { modelId: string };
    Querystring: { preview?: string };
    Body: string;
  }>(
    "/api/threat-models/:modelId/requirements/import/csv",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const csvText =
        typeof request.body === "string"
          ? request.body
          : Buffer.isBuffer(request.body)
            ? (request.body as Buffer).toString("utf8")
            : JSON.stringify(request.body);

      if (!csvText || csvText.trim().length === 0) {
        return sendBadRequest(reply, "CSV body is empty");
      }

      const parsed = parseCsvRequirements(csvText);
      if (parsed.length === 0) {
        return sendBadRequest(reply, "No rows found in CSV");
      }
      if (parsed.length > 500) {
        return sendBadRequest(reply, "CSV exceeds 500-row limit per import");
      }

      // Load existing reqIds to detect duplicates
      const existing = await prisma.requirement.findMany({
        where: { threatModelId: modelId, supersededAt: null },
        select: { reqId: true },
      });
      const existingIds = new Set(existing.map((r) => r.reqId));

      const preview = parsed.map((row) => {
        if (row.error) {
          return {
            reqId: row.reqId,
            text: row.text,
            category: row.category,
            status: "error" as const,
            error: row.error,
          };
        }
        if (existingIds.has(row.reqId)) {
          return {
            reqId: row.reqId,
            text: row.text,
            category: row.category,
            status: "duplicate" as const,
          };
        }
        return {
          reqId: row.reqId,
          text: row.text,
          category: row.category,
          status: "new" as const,
        };
      });

      const newRows = preview.filter((r) => r.status === "new");
      const errorRows = preview.filter((r) => r.status === "error");

      if (request.query.preview === "true") {
        return sendSuccess(reply, {
          preview,
          newCount: newRows.length,
          duplicateCount: preview.filter((r) => r.status === "duplicate")
            .length,
          errorCount: errorRows.length,
        });
      }

      // Commit
      if (newRows.length === 0) {
        return sendSuccess(reply, {
          created: 0,
          skipped: parsed.length,
          errors: errorRows,
        });
      }

      const result = await prisma.requirement.createMany({
        data: newRows.map((r) => ({
          reqId: r.reqId,
          text: r.text,
          category: r.category ?? null,
          source: "CSV" as const,
          docId: "CSV Import",
          threatModelId: modelId,
          createdById: user.id,
        })),
      });

      return sendSuccess(reply, {
        created: result.count,
        skipped: parsed.length - result.count - errorRows.length,
        errors: errorRows,
      });
    },
  );

  /**
   * POST /api/threat-models/:modelId/requirements/import/framework
   *
   * Import selected controls from a built-in compliance framework as requirements.
   * Body: { frameworkId: "HIPAA" | "PCI_DSS" | ..., controlIds: ["ctrl-id-1", ...] }
   *
   * If controlIds is empty or contains "*", imports all controls for the framework.
   */
  fastify.post<{ Params: { modelId: string }; Body: unknown }>(
    "/api/threat-models/:modelId/requirements/import/framework",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const parsed = FrameworkImportSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          parsed.error.issues[0]?.message ?? "Invalid body",
        );
      }

      const { frameworkId, controlIds } = parsed.data;
      const importAll = controlIds.includes("*");

      // Try built-in frameworks first
      const controls = getFrameworkControls(frameworkId as ComplianceFramework);
      let displayName = frameworkId;
      try {
        displayName = getFrameworkDisplayName(
          frameworkId as ComplianceFramework,
        );
      } catch {
        // custom framework — displayName stays as frameworkId
      }

      let selectedControls = controls;
      if (controls.length > 0 && !importAll) {
        const idSet = new Set(controlIds);
        selectedControls = controls.filter((c) => idSet.has(c.id));
      }

      // If no built-in controls found, check custom frameworks
      if (controls.length === 0) {
        const custom = await prisma.customComplianceFramework.findFirst({
          where: { shortName: frameworkId },
          include: {
            categories: {
              include: {
                controls: {
                  where: importAll
                    ? undefined
                    : { controlId: { in: controlIds } },
                },
              },
            },
          },
        });

        if (!custom) {
          return sendBadRequest(reply, `Framework '${frameworkId}' not found`);
        }

        displayName = custom.name;
        const allCustomRows = custom.categories.flatMap((cat) =>
          cat.controls.map((ctrl) => ({
            reqId: ctrl.controlId,
            text: `${ctrl.name}: ${ctrl.description}`,
            category: "compliance",
            source: "FRAMEWORK" as const,
            frameworkId,
            docId: custom.shortName,
            threatModelId: modelId,
            createdById: user.id,
          })),
        );

        const existingCustom = await prisma.requirement.findMany({
          where: { threatModelId: modelId },
          select: { reqId: true },
        });
        const existingCustomSet = new Set(existingCustom.map((r) => r.reqId));
        const newCustomRows = allCustomRows.filter(
          (r) => !existingCustomSet.has(r.reqId),
        );

        if (newCustomRows.length > 0) {
          await prisma.requirement.createMany({ data: newCustomRows });
        }

        return sendSuccess(reply, {
          created: newCustomRows.length,
          skipped: allCustomRows.length - newCustomRows.length,
          framework: displayName,
          total: allCustomRows.length,
        });
      }

      if (selectedControls.length === 0) {
        return sendBadRequest(
          reply,
          "No matching controls found for the provided controlIds",
        );
      }

      const allRows = selectedControls.map((ctrl) => ({
        reqId: ctrl.id,
        text: `${ctrl.name}: ${ctrl.description}`,
        category: "compliance",
        source: "FRAMEWORK" as const,
        frameworkId,
        docId: displayName,
        threatModelId: modelId,
        createdById: user.id,
      }));

      const existingBuiltin = await prisma.requirement.findMany({
        where: { threatModelId: modelId, supersededAt: null },
        select: { reqId: true },
      });
      const existingBuiltinSet = new Set(existingBuiltin.map((r) => r.reqId));
      const newRows = allRows.filter((r) => !existingBuiltinSet.has(r.reqId));

      if (newRows.length > 0) {
        await prisma.requirement.createMany({ data: newRows });
      }

      return sendSuccess(reply, {
        created: newRows.length,
        skipped: allRows.length - newRows.length,
        framework: displayName,
        total: allRows.length,
      });
    },
  );
};
