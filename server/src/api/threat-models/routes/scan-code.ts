/**
 * Scan Code Route
 *
 * POST /api/threat-models/:modelId/scan-code
 *
 * Accepts an array of source files, runs the code control scanner,
 * and persists the findings as COMPLETED mitigations linked to the
 * specified threat.  Each mitigation gets a "code" evidence link
 * pointing at the source line (GitHub permalink when repoUrl is given).
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import { canPerformAction } from "../../../services/access-control/access-control-service.js";
import { getAuthUser } from "../helpers.js";
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
} from "../../../utils/api-response.js";
import { buildScanMitigationData } from "../code-scan-helpers.js";
import { scanFiles } from "../../../services/code-scanner/scanner.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

const ScanCodeSchema = z.object({
  /** The threat to attach new mitigations to */
  threatId: z.string().min(1),
  /** Optional GitHub repo base URL for evidence link generation */
  repoUrl: z.string().url().optional(),
  /** Branch name for GitHub permalink (default: "main") */
  branch: z.string().optional(),
  /** Source files to scan */
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
      }),
    )
    .min(1)
    .max(500),
});

export const scanCodeRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = await getPrisma();

  /**
   * POST /api/threat-models/:modelId/scan-code
   *
   * Scans provided source files for security controls and creates
   * COMPLETED mitigations for each detected control.
   */
  fastify.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/scan-code",
    MODEL_EDIT,
    async (request, reply) => {
      const user = await getAuthUser(request);
      const { modelId } = request.params;

      const actionCheck = await canPerformAction(user.id, modelId, "edit");
      if (!actionCheck.allowed) {
        if (!actionCheck.access?.hasAccess) {
          return sendNotFound(reply, "Threat model");
        }
        return sendForbidden(reply, actionCheck.error);
      }

      const parsed = ScanCodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          parsed.error.issues[0]?.message ?? "Invalid input",
        );
      }

      const { threatId, repoUrl, branch = "main", files } = parsed.data;

      // Verify threat belongs to this model
      const threat = await prisma.threat.findFirst({
        where: { id: threatId, threatModelId: modelId },
        select: { id: true },
      });
      if (!threat) {
        return sendBadRequest(reply, "Threat not found in this model");
      }

      const controls = scanFiles(files, repoUrl, branch);

      if (controls.length === 0) {
        return sendSuccess(reply, {
          created: 0,
          skipped: 0,
          controls: [],
          message: "No security controls detected in the provided files",
        });
      }

      // Deduplicate: skip patterns already mitigated on this threat
      const existingMitigations = await prisma.mitigation.findMany({
        where: { threatId },
        select: { controlCategory: true, description: true },
      });
      const existingDescriptions = new Set(
        existingMitigations.map((m) => m.description.trim()),
      );

      const toCreate = controls.filter(
        (c) => !existingDescriptions.has(c.mitigationDescription.trim()),
      );

      if (toCreate.length === 0) {
        return sendSuccess(reply, {
          created: 0,
          skipped: controls.length,
          controls: [],
          message: "All detected controls are already mitigated",
        });
      }

      // Bulk-create mitigations in a transaction
      const created = await prisma.$transaction(
        toCreate.map((control) =>
          prisma.mitigation.create({
            data: buildScanMitigationData(
              control,
              threatId,
              user.id,
              "Detected pattern",
            ),
            select: {
              id: true,
              description: true,
              controlCategory: true,
              status: true,
            },
          }),
        ),
      );

      // Persist a Document record so this scan shows in the Docs tab
      const scanName =
        files.length === 1
          ? files[0].path
          : `Code Upload (${files.length} files)`;
      await prisma.document
        .create({
          data: {
            name: scanName,
            type: "SOURCE_CODE",
            content: [
              `Code scan: ${files.length} files`,
              repoUrl ? `Repository: ${repoUrl}` : "",
              `Controls found: ${controls.length} (${created.length} new)`,
              "",
              "Scanned files:",
              ...files.map((f) => `  ${f.path}`),
            ]
              .filter(Boolean)
              .join("\n"),
            sizeBytes: files.reduce((s, f) => s + f.content.length, 0),
            extractedAt: new Date(),
            extractionSummary: `Scanned ${files.length} files, found ${created.length} security controls`,
            extractedComponentCount: 0,
            extractedRequirementCount: 0,
            threatModelId: modelId,
            importedById: user.id,
          },
        })
        .catch(() => {});

      return sendSuccess(reply, {
        created: created.length,
        skipped: controls.length - toCreate.length,
        controls: created.map((m, i) => ({
          ...m,
          file: toCreate[i].file,
          line: toCreate[i].line,
          patternId: toCreate[i].patternId,
          evidenceUrl: toCreate[i].evidenceUrl,
        })),
      });
    },
  );
};
