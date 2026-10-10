/**
 * Create Threat Model From GitHub (1-click)
 *
 * POST /api/threat-models/create-from-github
 *
 * Accepts a GitHub repo URL, auto-creates a threat model named after the
 * repo, then immediately runs the code-security scanner and returns the
 * new model ID plus scan results.  Users land directly on the canvas.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import { checkProjectAccess } from "../../../services/access-control/access-control-service.js";
import { getAuthUser } from "../helpers.js";
import {
  sendSuccess,
  sendBadRequest,
  sendForbidden,
} from "../../../utils/api-response.js";
import {
  buildScanMitigationData,
  githubFetch,
  selectCodeFiles,
  fetchSourceFiles,
} from "../code-scan-helpers.js";
import { scanFiles } from "../../../services/code-scanner/scanner.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const CreateFromGithubSchema = z.object({
  repoUrl: z
    .string()
    .url()
    .refine((u) => u.includes("github.com"), "Must be a GitHub URL"),
  projectId: z.string().optional(),
  token: z.string().optional(),
  branch: z
    .string()
    .max(255)
    .regex(/^[a-zA-Z0-9._/-]+$/, "Invalid branch format")
    .optional(),
});

function parseGithubUrl(
  repoUrl: string,
): { owner: string; repo: string } | null {
  const match = repoUrl.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
  );
  if (!match || !match[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2] };
}

const CREATE_FROM_GITHUB_AUTHZ = routeAuthz({
  handler:
    "with body projectId: ACTIVE member of the project's org with edit permission (EDITOR+); without: uses the caller's first ACTIVE OWNER/ADMIN/EDITOR membership org",
});

export const createFromGithubRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = await getPrisma();

  fastify.post(
    "/api/threat-models/create-from-github",
    CREATE_FROM_GITHUB_AUTHZ,
    async (request, reply) => {
      const user = getAuthUser(request);

      const parsed = CreateFromGithubSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          parsed.error.issues[0]?.message ?? "Invalid input",
        );
      }

      const { repoUrl, projectId, token, branch = "HEAD" } = parsed.data;

      const coords = parseGithubUrl(repoUrl);
      if (!coords) {
        return sendBadRequest(reply, "Cannot parse owner/repo from URL");
      }
      const { owner, repo } = coords;

      // --- Find or create a project for this user ---
      let resolvedProjectId = projectId;
      if (resolvedProjectId) {
        // Creating a model in a project needs edit-level, ACTIVE membership
        // in that project's organization.
        const access = await checkProjectAccess(user.id, resolvedProjectId);
        if (!access.hasAccess) {
          return sendForbidden(reply, "Access denied to project");
        }
        if (!access.permissions.includes("edit")) {
          return sendForbidden(
            reply,
            `${access.role} role cannot create threat models in this project`,
          );
        }
      } else {
        const membership = await prisma.membership.findFirst({
          where: {
            userId: user.id,
            status: "ACTIVE",
            role: { in: ["OWNER", "ADMIN", "EDITOR"] },
          },
          select: { organizationId: true },
        });
        if (!membership) {
          return sendBadRequest(
            reply,
            "No organization found — create a project first",
          );
        }
        const defaultProject = await prisma.project.findFirst({
          where: { organizationId: membership.organizationId },
          select: { id: true },
        });
        if (defaultProject) {
          resolvedProjectId = defaultProject.id;
        } else {
          const newProject = await prisma.project.create({
            data: {
              name: "Default",
              organizationId: membership.organizationId,
              createdById: user.id,
            },
            select: { id: true },
          });
          resolvedProjectId = newProject.id;
        }
      }

      // --- Create the threat model ---
      const model = await prisma.threatModel.create({
        data: {
          name: `${owner}/${repo}`,
          projectId: resolvedProjectId,
          createdById: user.id,
        },
        select: { id: true },
      });

      // --- Fetch repo tree ---
      const treeResult = await githubFetch(
        `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        token,
        "GitHub",
      );
      if (!treeResult.ok || !treeResult.data) {
        const ghErr = treeResult.error ?? "Unknown error";
        let msg = `Created model but GitHub fetch failed: ${ghErr}`;
        if (ghErr.includes("404"))
          msg = `Repository ${owner}/${repo} not found. Model created — paste GitHub URL manually.`;
        if (ghErr.includes("401") || ghErr.includes("403"))
          msg = "Model created — add a GitHub token for private repos.";
        return sendSuccess(reply, {
          modelId: model.id,
          scanned: false,
          message: msg,
          created: 0,
          filesScanned: 0,
        });
      }

      const codeFiles = selectCodeFiles(treeResult.data);

      // --- Fetch file contents ---
      const sourceFiles = await fetchSourceFiles(
        codeFiles,
        owner,
        repo,
        branch,
        token,
      );

      const controls = scanFiles(sourceFiles, repoUrl, branch);

      if (controls.length === 0) {
        return sendSuccess(reply, {
          modelId: model.id,
          scanned: true,
          filesScanned: sourceFiles.length,
          created: 0,
          message:
            "Model created. No security controls detected in scanned files.",
        });
      }

      // --- Create scan threat + mitigations ---
      const scanThreat = await prisma.threat.create({
        data: {
          name: "Security Controls (Code Scan)",
          description:
            "Security controls detected automatically by scanning the source code repository.",
          severity: "INFO",
          status: "MITIGATED",
          category: "CODE_SCAN",
          source: "MANUAL",
          reviewStatus: "PENDING",
          threatModelId: model.id,
          createdById: user.id,
        },
        select: { id: true },
      });

      const created = await prisma.$transaction(
        controls.map((c) =>
          prisma.mitigation.create({
            data: buildScanMitigationData(c, scanThreat.id, user.id, "Pattern"),
            select: { id: true },
          }),
        ),
      );

      await prisma.document
        .create({
          data: {
            name: `${owner}/${repo}`,
            type: "SOURCE_CODE",
            content: `GitHub repository: ${repoUrl}\nBranch: ${branch}\nFiles scanned: ${sourceFiles.length}\nControls found: ${controls.length}`,
            sizeBytes: sourceFiles.reduce((s, f) => s + f.content.length, 0),
            extractedAt: new Date(),
            extractionSummary: `Scanned ${sourceFiles.length} files, found ${created.length} security controls`,
            extractedComponentCount: 0,
            extractedRequirementCount: 0,
            threatModelId: model.id,
            importedById: user.id,
          },
        })
        .catch(() => {});

      return sendSuccess(reply, {
        modelId: model.id,
        scanned: true,
        owner,
        repo,
        filesScanned: sourceFiles.length,
        created: created.length,
        message: `Model created with ${created.length} security controls from ${sourceFiles.length} files.`,
      });
    },
  );
};
