/**
 * Scan From GitHub Route
 *
 * POST /api/threat-models/:modelId/scan-from-github
 *
 * Fetches key source files from a public GitHub repo (no auth required for
 * public repos), runs the code control scanner, creates a "Security Controls
 * (Code Scan)" threat if one doesn't exist, then persists COMPLETED mitigations
 * with code evidence links.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import { canPerformAction } from "../../../services/access-control/access-control-service.js";
import { getAuthUser } from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
} from "../../../utils/api-response.js";
import {
  buildScanMitigationData,
  githubFetch,
  selectCodeFiles,
  fetchSourceFiles,
} from "../code-scan-helpers.js";
import { scanFiles } from "../../../services/code-scanner/scanner.js";

const ScanFromGithubSchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid owner format"),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid repo format"),
  branch: z
    .string()
    .max(255)
    .regex(/^[a-zA-Z0-9._/-]+$/, "Invalid branch format")
    .optional(),
  /** Optional personal access token for private repos */
  token: z.string().optional(),
});

export const scanFromGithubRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = await getPrisma();

  fastify.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/scan-from-github",
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

      const parsed = ScanFromGithubSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          parsed.error.issues[0]?.message ?? "Invalid input",
        );
      }

      const { owner, repo, branch = "HEAD", token } = parsed.data;
      const repoUrl = `https://github.com/${owner}/${repo}`;

      // --- Fetch repo tree ---
      const treeResult = await githubFetch(
        `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        token,
        "GitHub API",
      );
      if (!treeResult.ok || !treeResult.data) {
        const ghError = treeResult.error ?? "Unknown error";
        let message = `Failed to fetch repo tree: ${ghError}`;

        if (ghError.includes("401")) {
          message = token
            ? "GitHub token is invalid or expired. Generate a new token at github.com/settings/tokens with the 'repo' scope."
            : "This repository is private. Add a GitHub personal access token with the 'repo' scope in the Token field.";
        } else if (ghError.includes("403")) {
          message =
            "GitHub API rate limit exceeded. Add a personal access token to increase your limit, or wait a few minutes.";
        } else if (ghError.includes("404")) {
          message = `Repository ${owner}/${repo} not found. Check the URL, or add a token if it's a private repo.`;
        }

        return sendBadRequest(reply, message);
      }

      const codeFiles = selectCodeFiles(treeResult.data);

      if (codeFiles.length === 0) {
        return sendSuccess(reply, {
          created: 0,
          skipped: 0,
          controls: [],
          filesScanned: 0,
          message: "No source code files found in the repository",
        });
      }

      // --- Fetch file contents ---
      const sourceFiles = await fetchSourceFiles(
        codeFiles,
        owner,
        repo,
        branch,
        token,
        "GitHub API",
      );

      const controls = scanFiles(sourceFiles, repoUrl, branch);

      if (controls.length === 0) {
        return sendSuccess(reply, {
          created: 0,
          skipped: 0,
          controls: [],
          filesScanned: sourceFiles.length,
          message: "No security controls detected in the scanned files",
        });
      }

      // --- Find or create a "Security Controls (Code Scan)" threat ---
      const SCAN_THREAT_NAME = "Security Controls (Code Scan)";

      let scanThreat = await prisma.threat.findFirst({
        where: { threatModelId: modelId, name: SCAN_THREAT_NAME },
        select: { id: true },
      });

      if (!scanThreat) {
        scanThreat = await prisma.threat.create({
          data: {
            name: SCAN_THREAT_NAME,
            description:
              "Security controls detected automatically by scanning the source code repository. " +
              "These mitigations represent existing controls already implemented in the codebase.",
            severity: "INFO",
            status: "MITIGATED",
            category: "CODE_SCAN",
            source: "MANUAL",
            reviewStatus: "PENDING",
            threatModelId: modelId,
            createdById: user.id,
          },
          select: { id: true },
        });
      }

      // --- Deduplicate against existing mitigations ---
      const existing = await prisma.mitigation.findMany({
        where: { threatId: scanThreat.id },
        select: { description: true },
      });
      const existingSet = new Set(existing.map((m) => m.description.trim()));
      const toCreate = controls.filter(
        (c) => !existingSet.has(c.mitigationDescription.trim()),
      );

      if (toCreate.length === 0) {
        return sendSuccess(reply, {
          created: 0,
          skipped: controls.length,
          threatId: scanThreat.id,
          controls: [],
          filesScanned: sourceFiles.length,
          message: "All detected controls are already recorded",
        });
      }

      // --- Bulk-create mitigations ---
      const created = await prisma.$transaction(
        toCreate.map((control) =>
          prisma.mitigation.create({
            data: buildScanMitigationData(
              control,
              scanThreat!.id,
              user.id,
              "Pattern",
            ),
            select: {
              id: true,
              description: true,
              controlCategory: true,
            },
          }),
        ),
      );

      // Persist a Document record so this scan shows in the Docs tab
      await prisma.document
        .create({
          data: {
            name: `${owner}/${repo}`,
            type: "SOURCE_CODE",
            content: [
              `GitHub repository: ${repoUrl}`,
              `Branch: ${branch}`,
              `Files scanned: ${sourceFiles.length}`,
              `Controls found: ${controls.length} (${created.length} new)`,
              "",
              "Scanned files:",
              ...sourceFiles.map((f) => `  ${f.path}`),
            ].join("\n"),
            sizeBytes: sourceFiles.reduce((s, f) => s + f.content.length, 0),
            extractedAt: new Date(),
            extractionSummary: `Scanned ${sourceFiles.length} files, found ${created.length} security controls`,
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
        threatId: scanThreat.id,
        filesScanned: sourceFiles.length,
        controls: created.map((m, i) => ({
          ...m,
          file: toCreate[i].file,
          line: toCreate[i].line,
          evidenceUrl: toCreate[i].evidenceUrl,
        })),
      });
    },
  );
};
