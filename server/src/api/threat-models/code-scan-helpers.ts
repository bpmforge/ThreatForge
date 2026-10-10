/**
 * Shared helpers for the code-scan routes (scan-code, scan-from-github,
 * create-from-github): GitHub REST fetch, source-file selection from a repo
 * tree, base64 content download, and the mitigation record built per
 * detected control.
 */
import type { DetectedControl } from "../../services/code-scanner/scanner.js";

const GITHUB_API = "https://api.github.com";
const MAX_FILES = 30;
const MAX_FILE_BYTES = 256_000;

/** Patterns that surface security-relevant source code. */
const CODE_PATTERNS: RegExp[] = [
  /\.[tj]sx?$/,
  /\.py$/,
  /\.go$/,
  /\.rb$/,
  /\.java$/,
  /\.cs$/,
  /\.php$/,
  /^src\/(middleware|auth|security|routes|api)\//,
  /^app\/(middleware|auth|security|routes|api)\//,
  /server\.[tj]sx?$/,
  /app\.[tj]sx?$/,
  /index\.[tj]sx?$/,
  /main\.[tj]sx?$/,
];

export interface GithubTreeEntry {
  path: string;
  type: string;
  size?: number;
}

export interface GithubFetchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** GET a GitHub REST path. `errorLabel` prefixes HTTP-status errors. */
export async function githubFetch(
  url: string,
  token?: string,
  errorLabel = "GitHub",
): Promise<GithubFetchResult> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(`${GITHUB_API}${url}`, { headers });
    if (!res.ok)
      return {
        ok: false,
        error: `${errorLabel} ${res.status}: ${res.statusText}`,
      };
    return { ok: true, data: await res.json() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Pick the scannable source blobs out of a git tree response. */
export function selectCodeFiles(treeData: unknown): GithubTreeEntry[] {
  const tree = (treeData as { tree: GithubTreeEntry[] }).tree;
  return tree
    .filter(
      (e) =>
        e.type === "blob" &&
        (e.size ?? 0) <= MAX_FILE_BYTES &&
        CODE_PATTERNS.some((re) => re.test(e.path)),
    )
    .slice(0, MAX_FILES);
}

/** Download and decode the given files; unreadable files are skipped. */
export async function fetchSourceFiles(
  codeFiles: GithubTreeEntry[],
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  errorLabel?: string,
): Promise<{ path: string; content: string }[]> {
  const sourceFiles: { path: string; content: string }[] = [];
  for (const file of codeFiles) {
    const r = await githubFetch(
      `/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
      token,
      errorLabel,
    );
    if (!r.ok || !r.data) continue;
    const raw = r.data as { content?: string; encoding?: string };
    if (raw.encoding !== "base64" || !raw.content) continue;
    try {
      sourceFiles.push({
        path: file.path,
        content: Buffer.from(raw.content.replace(/\n/g, ""), "base64").toString(
          "utf-8",
        ),
      });
    } catch {
      // skip undecodable files
    }
  }
  return sourceFiles;
}

/**
 * `data` for the IMPLEMENTED mitigation recorded for one detected control.
 * `notesLabel` prefixes the implementation note ("Pattern" or
 * "Detected pattern") and is the only wording that differs between routes.
 */
export function buildScanMitigationData(
  control: DetectedControl,
  threatId: string,
  userId: string,
  notesLabel: string,
) {
  return {
    description: control.mitigationDescription,
    status: "IMPLEMENTED" as const,
    priority: "MEDIUM" as const,
    effectivenessScore: 0.65,
    threatId,
    createdById: userId,
    controlCategory: control.controlCategory,
    evidenceLinks: JSON.stringify(
      control.evidenceUrl
        ? [
            {
              type: "code",
              url: control.evidenceUrl,
              title: `${control.evidenceTitle} (${control.file}:${control.line})`,
            },
          ]
        : [],
    ),
    ...(control.cwe
      ? {
          implementationNotes: `${notesLabel}: ${control.patternName} — ${control.cwe}`,
        }
      : {}),
  };
}
