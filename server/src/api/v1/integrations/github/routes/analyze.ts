/**
 * GitHub Integration - Repository Analysis
 *
 * Reads key files from a GitHub repo and returns combined text suitable
 * for feeding into the AI extraction pipeline (POST /api/ai/extract).
 * The frontend already owns the text -> AI -> architecture -> canvas flow;
 * this endpoint is purely a "GitHub file reader".
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  canUseOrgCredentials,
} from "../../../helpers.js";
import type { GitHubConfig, GitHubCredentials } from "../schemas.js";
import { decryptAndParse, githubRequest } from "../helpers.js";
import {
  sendSuccess,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendInternalError,
} from "../../../../../utils/api-response.js";
import { AIService } from "../../../../../services/ai/ai-service.js";
import type { AISettings } from "../../../../../types/settings.js";
import { parseAISettings } from "../../../../../types/settings.js";
import {
  decryptValue,
  getKeyConfig,
} from "../../../../../services/encryption/index.js";
import { routeAuthz } from "../../../../../middleware/authz-policy.js";

const ORG_EDITOR = routeAuthz({ org: "EDITOR" });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Patterns that identify security-relevant / architecture-relevant files. */
const KEY_PATTERNS: RegExp[] = [
  /^README\.md$/i,
  /^ARCHITECTURE\.md$/i,
  /^SECURITY\.md$/i,
  /^THREAT[_-]MODEL\.md$/i,
  /^package\.json$/,
  /^Cargo\.toml$/,
  /^requirements\.txt$/,
  /^pyproject\.toml$/,
  /^go\.mod$/,
  /^Dockerfile$/i,
  /^docker-compose.*\.ya?ml$/,
  /^\.env\.example$/,
  /^src\/(index|main|app|server)\.[tj]sx?$/,
  /^src\/api\/.*\.[tj]s$/,
  /^prisma\/schema/,
  /^src\/middleware\/auth/,
  /^\.github\/workflows\/.*\.ya?ml$/,
  /^nginx\.conf$/,
  /^terraform\/.*\.tf$/,
  /^infra\/.*\.tf$/,
];

/** Maximum number of files whose content we fetch. */
const MAX_FILES = 20;

/** Maximum individual file size (bytes) we will fetch. GitHub API caps at 1 MB. */
const MAX_FILE_SIZE = 512_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether a tree path matches any key pattern. */
function isKeyFile(path: string): boolean {
  return KEY_PATTERNS.some((re) => re.test(path));
}

/** Build a simple tree listing string from the full list of paths. */
function buildTreeListing(paths: string[]): string {
  // Show up to 200 entries so the listing stays readable.
  const lines = paths.slice(0, 200).map((p) => `  ${p}`);
  if (paths.length > 200) {
    lines.push(`  ... and ${paths.length - 200} more files`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreeEntry {
  path: string;
  type: string; // "blob" | "tree"
  size?: number;
}

interface TreeResponse {
  tree: TreeEntry[];
  truncated: boolean;
}

interface ContentResponse {
  content: string;
  encoding: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const analyzeRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /** POST /analyze - Read key files from a GitHub repo for threat analysis */
  server.post<{
    Params: { orgId: string };
    Body: {
      owner: string;
      repo: string;
      branch?: string;
      autoExtract?: boolean;
    };
  }>("/analyze", ORG_EDITOR, async (request, reply) => {
    const user = getAuthUser(request);
    const { orgId } = request.params;

    // --- Auth ---
    const access = await checkOrganizationAccess(user.id, orgId);
    if (!canUseOrgCredentials(access))
      return sendForbidden(reply, "Editor role or higher required");

    // --- Validate body ---
    const { owner, repo, branch } = request.body;
    if (
      !owner ||
      typeof owner !== "string" ||
      !repo ||
      typeof repo !== "string"
    ) {
      return sendBadRequest(reply, "owner and repo are required strings");
    }

    // --- Retrieve GitHub integration ---
    const integration = await prisma.integration.findFirst({
      where: {
        organizationId: orgId,
        type: "GITHUB_ISSUES",
        status: "ACTIVE",
      },
    });
    if (!integration) return sendNotFound(reply, "GitHub integration");

    const config = decryptAndParse<GitHubConfig>(integration.config);
    const credentials = decryptAndParse<GitHubCredentials>(
      integration.credentials,
    );
    if (!config || !credentials) {
      return sendInternalError(reply, "Failed to decrypt configuration");
    }

    // --- Resolve branch (default to repo's default branch) ---
    const ref = branch || "HEAD";

    // --- Fetch repo tree ---
    const treeResult = await githubRequest(
      config,
      credentials,
      "GET",
      `/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    );

    if (!treeResult.ok) {
      return sendBadRequest(
        reply,
        `Failed to fetch repository tree: ${treeResult.error}`,
      );
    }

    const treeData = treeResult.data as TreeResponse;
    const allPaths = treeData.tree
      .filter((e) => e.type === "blob")
      .map((e) => e.path);

    // --- Filter to key files ---
    const keyFiles = allPaths.filter((p) => isKeyFile(p)).slice(0, MAX_FILES);

    if (keyFiles.length === 0) {
      // Still return the tree so the user can see what's there
      return sendSuccess(reply, {
        text: `# Repository: ${owner}/${repo}\n\n## File Structure\n${buildTreeListing(allPaths)}\n\nNo key architecture files were found automatically. You may need to paste relevant code manually.`,
        filesAnalyzed: [] as string[],
        repoStructure: buildTreeListing(allPaths),
      });
    }

    // --- Fetch content of each key file ---
    const fileContents: { path: string; content: string }[] = [];

    for (const filePath of keyFiles) {
      const contentResult = await githubRequest(
        config,
        credentials,
        "GET",
        `/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`,
      );

      if (!contentResult.ok) continue;

      const contentData = contentResult.data as ContentResponse;
      if (contentData.size > MAX_FILE_SIZE) continue;

      try {
        const decoded = Buffer.from(contentData.content, "base64").toString(
          "utf-8",
        );
        fileContents.push({ path: filePath, content: decoded });
      } catch {
        // Skip files that fail to decode
      }
    }

    // --- Build combined text ---
    const repoStructure = buildTreeListing(allPaths);
    const sections: string[] = [
      `# Repository: ${owner}/${repo}`,
      "",
      "## File Structure",
      repoStructure,
    ];

    for (const file of fileContents) {
      sections.push("");
      sections.push(`## File: ${file.path}`);
      sections.push("```");
      sections.push(file.content);
      sections.push("```");
    }

    const text = sections.join("\n");

    const result: Record<string, unknown> = {
      text,
      filesAnalyzed: fileContents.map((f) => f.path),
      repoStructure,
    };

    // Auto-extract architecture using AI if requested
    if (request.body.autoExtract) {
      try {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { aiSettings: true },
        });

        const settings: AISettings = parseAISettings(org?.aiSettings);

        if (settings.enabled && settings.provider !== "none") {
          // Decrypt API key if needed
          if (settings.encryptedApiKey && !settings.apiKey) {
            const keyConfig = await getKeyConfig(orgId);
            const decrypted = decryptValue(
              settings.encryptedApiKey,
              keyConfig ?? undefined,
            );
            if (decrypted) settings.apiKey = decrypted;
          }

          const aiService = new AIService(settings, orgId);
          const extraction = await aiService.extractArchitecture(text);
          result.extraction = extraction;
          result.autoExtracted = true;
        }
      } catch (err) {
        // Non-blocking — return raw text even if AI fails
        result.extractionError =
          err instanceof Error ? err.message : "AI extraction failed";
        result.autoExtracted = false;
      }
    }

    return sendSuccess(reply, result);
  });
};
