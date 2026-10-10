/**
 * CI/CD Feedback Service
 *
 * Orchestrates posting scan results to GitHub, GitLab, etc.
 */

import { getPrisma } from "../../db.js";
import { createGitHubClient } from "./github-client.js";
import { createGitLabClient } from "./gitlab-client.js";
import { createBitbucketClient } from "./bitbucket-client.js";
import {
  generatePRComment,
  generateCheckRunSummary,
  COMMENT_MARKER,
} from "./comment-generator.js";
import type { Finding, ScanSummary, CIProvider, Severity } from "./types.js";

interface ScanResult {
  scanId: string;
  threatModelId: string;
  threatModelName: string;
  projectName: string;
  repositoryId: string;
  prNumber?: number;
  commitSha: string;
  findings: Finding[];
  summary: ScanSummary;
  conclusion: "success" | "failure";
  scanUrl: string;
}

interface FeedbackConfig {
  provider: CIProvider;
  token: string;
  baseUrl?: string;
  postPRComment?: boolean;
  createCheckRun?: boolean;
  updateCommitStatus?: boolean;
}

/** Parse repository ID into owner/repo */
function parseRepoId(repositoryId: string): { owner: string; repo: string } {
  const [owner, repo] = repositoryId.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository ID: ${repositoryId}`);
  }
  return { owner, repo };
}

/** Post scan results to GitHub */
async function postGitHubFeedback(
  result: ScanResult,
  config: FeedbackConfig,
): Promise<{
  commentUrl?: string;
  checkRunUrl?: string;
  statusUrl?: string;
}> {
  const client = createGitHubClient(config.token, config.baseUrl);
  const { owner, repo } = parseRepoId(result.repositoryId);
  const urls: {
    commentUrl?: string;
    checkRunUrl?: string;
    statusUrl?: string;
  } = {};

  // Create or update PR comment
  if (config.postPRComment && result.prNumber) {
    const commentBody = generatePRComment(
      result.findings,
      result.summary,
      result.threatModelName,
      result.scanUrl,
      result.conclusion,
    );

    // Check for existing comment
    const existingComment = await client.findCommentByMarker(
      owner,
      repo,
      result.prNumber,
      COMMENT_MARKER,
    );

    if (existingComment) {
      await client.updatePRComment(
        owner,
        repo,
        existingComment.id,
        commentBody,
      );
      urls.commentUrl = `https://github.com/${owner}/${repo}/pull/${result.prNumber}#issuecomment-${existingComment.id}`;
    } else {
      const comment = await client.createPRComment({
        owner,
        repo,
        prNumber: result.prNumber,
        body: commentBody,
      });
      urls.commentUrl = comment.html_url;
    }
  }

  // Create check run
  if (config.createCheckRun) {
    const { title, summary, text } = generateCheckRunSummary(
      result.findings,
      result.summary,
      result.threatModelName,
    );

    const checkRun = await client.createCheckRun({
      owner,
      repo,
      name: "ThreatForge",
      headSha: result.commitSha,
      status: "completed",
      conclusion: result.conclusion,
      title,
      summary,
      text,
    });

    urls.checkRunUrl = checkRun.html_url;
  }

  // Update commit status
  if (config.updateCommitStatus) {
    await client.createCommitStatus(owner, repo, result.commitSha, {
      state: result.conclusion === "success" ? "success" : "failure",
      targetUrl: result.scanUrl,
      description:
        result.conclusion === "success"
          ? "Threat model scan passed"
          : `${result.summary.critical + result.summary.high} critical/high threats`,
      context: "ThreatForge",
    });
  }

  return urls;
}

/** Post scan results to GitLab */
async function postGitLabFeedback(
  result: ScanResult,
  config: FeedbackConfig,
): Promise<{
  noteUrl?: string;
  statusUrl?: string;
}> {
  const client = createGitLabClient(config.token, config.baseUrl);
  const projectId = result.repositoryId; // GitLab uses project ID or path
  const urls: { noteUrl?: string; statusUrl?: string } = {};

  // Create or update MR note (comment)
  if (config.postPRComment && result.prNumber) {
    const commentBody = generatePRComment(
      result.findings,
      result.summary,
      result.threatModelName,
      result.scanUrl,
      result.conclusion,
    );

    const existingNote = await client.findNoteByMarker(
      projectId,
      result.prNumber,
      COMMENT_MARKER,
    );

    if (existingNote) {
      await client.updateMRNote(
        projectId,
        result.prNumber,
        existingNote.id,
        commentBody,
      );
      urls.noteUrl = `${config.baseUrl || "https://gitlab.com"}/${projectId}/-/merge_requests/${result.prNumber}#note_${existingNote.id}`;
    } else {
      const note = await client.createMRNote(
        projectId,
        result.prNumber,
        commentBody,
      );
      urls.noteUrl = `${config.baseUrl || "https://gitlab.com"}/${projectId}/-/merge_requests/${result.prNumber}#note_${note.id}`;
    }
  }

  // Update commit status
  if (config.updateCommitStatus || config.createCheckRun) {
    const state = result.conclusion === "success" ? "success" : "failed";
    await client.createCommitStatus(projectId, result.commitSha, {
      state,
      name: "ThreatForge",
      targetUrl: result.scanUrl,
      description:
        result.conclusion === "success"
          ? "Threat model scan passed"
          : `${result.summary.critical + result.summary.high} critical/high threats`,
    });
  }

  return urls;
}

/** Post scan results to Bitbucket */
async function postBitbucketFeedback(
  result: ScanResult,
  config: FeedbackConfig & { username: string },
): Promise<{
  commentUrl?: string;
  statusUrl?: string;
}> {
  const [workspace, repoSlug] = result.repositoryId.split("/");
  if (!workspace || !repoSlug) {
    throw new Error(`Invalid Bitbucket repository ID: ${result.repositoryId}`);
  }

  const client = createBitbucketClient(
    config.username,
    config.token,
    config.baseUrl,
  );
  const urls: { commentUrl?: string; statusUrl?: string } = {};

  // Create or update PR comment
  if (config.postPRComment && result.prNumber) {
    const commentBody = generatePRComment(
      result.findings,
      result.summary,
      result.threatModelName,
      result.scanUrl,
      result.conclusion,
    );

    const existingComment = await client.findCommentByMarker(
      workspace,
      repoSlug,
      result.prNumber,
      COMMENT_MARKER,
    );

    if (existingComment) {
      await client.updatePRComment(
        workspace,
        repoSlug,
        result.prNumber,
        existingComment.id,
        commentBody,
      );
      urls.commentUrl = `https://bitbucket.org/${workspace}/${repoSlug}/pull-requests/${result.prNumber}`;
    } else {
      const _comment = await client.createPRComment(
        workspace,
        repoSlug,
        result.prNumber,
        commentBody,
      );
      urls.commentUrl = `https://bitbucket.org/${workspace}/${repoSlug}/pull-requests/${result.prNumber}`;
    }
  }

  // Create build status
  if (config.updateCommitStatus || config.createCheckRun) {
    const state = result.conclusion === "success" ? "SUCCESSFUL" : "FAILED";
    await client.createBuildStatus(workspace, repoSlug, result.commitSha, {
      state,
      key: "threatforge",
      name: "ThreatForge",
      url: result.scanUrl,
      description:
        result.conclusion === "success"
          ? "Threat model scan passed"
          : `${result.summary.critical + result.summary.high} critical/high threats`,
    });
  }

  return urls;
}

/** Process a completed scan and post feedback */
export async function processScanFeedback(
  scanId: string,
  config: FeedbackConfig,
): Promise<{ success: boolean; urls: Record<string, string>; error?: string }> {
  const prisma = await getPrisma();

  const scan = await prisma.cIScan.findUnique({
    where: { id: scanId },
    include: {
      threatModel: {
        include: {
          project: { select: { name: true, organizationId: true } },
        },
      },
    },
  });

  if (!scan) {
    return { success: false, urls: {}, error: "Scan not found" };
  }

  if (scan.status !== "COMPLETED") {
    return { success: false, urls: {}, error: "Scan not completed" };
  }

  const findings = JSON.parse(scan.findings) as Finding[];
  const summary: ScanSummary = {
    total: scan.findingsCount,
    critical: scan.criticalCount,
    high: scan.highCount,
    medium: scan.mediumCount,
    low: scan.lowCount,
    info: scan.infoCount,
    open: findings.filter((f) => f.status === "OPEN").length,
    mitigated: findings.filter((f) => f.status === "MITIGATED").length,
  };

  // Determine conclusion based on fail threshold
  let conclusion: "success" | "failure" = "success";
  if (scan.failOnSeverity) {
    const severityOrder: Severity[] = [
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
      "INFO",
    ];
    const thresholdIndex = severityOrder.indexOf(
      scan.failOnSeverity as Severity,
    );

    const openBySeverity = {
      CRITICAL: findings.filter(
        (f) => f.severity === "CRITICAL" && f.status === "OPEN",
      ).length,
      HIGH: findings.filter((f) => f.severity === "HIGH" && f.status === "OPEN")
        .length,
      MEDIUM: findings.filter(
        (f) => f.severity === "MEDIUM" && f.status === "OPEN",
      ).length,
      LOW: findings.filter((f) => f.severity === "LOW" && f.status === "OPEN")
        .length,
      INFO: findings.filter((f) => f.severity === "INFO" && f.status === "OPEN")
        .length,
    };

    for (let i = 0; i <= thresholdIndex; i++) {
      if (openBySeverity[severityOrder[i]] > 0) {
        conclusion = "failure";
        break;
      }
    }
  }

  const result: ScanResult = {
    scanId: scan.id,
    threatModelId: scan.threatModelId,
    threatModelName: scan.threatModel.name,
    projectName: scan.threatModel.project.name,
    repositoryId: scan.repositoryId,
    prNumber: scan.prNumber ?? undefined,
    commitSha: scan.commitSha,
    findings,
    summary,
    conclusion,
    scanUrl: `${process.env.APP_URL || "http://localhost:3000"}/models/${scan.threatModelId}/scans/${scan.id}`,
  };

  try {
    let urls: Record<string, string | undefined> = {};

    if (config.provider === "GITHUB") {
      urls = await postGitHubFeedback(result, config);
    } else if (config.provider === "GITLAB") {
      urls = await postGitLabFeedback(result, config);
    } else if (config.provider === "BITBUCKET") {
      // Bitbucket requires username - extract from token if in format user:token
      const username =
        (config as FeedbackConfig & { username?: string }).username ||
        config.token.split(":")[0];
      const appPassword = config.token.includes(":")
        ? config.token.split(":")[1]
        : config.token;
      urls = await postBitbucketFeedback(result, {
        ...config,
        token: appPassword,
        username,
      });
    } else {
      return {
        success: false,
        urls: {},
        error: `Provider ${config.provider} not supported yet`,
      };
    }

    // Update scan with feedback URLs
    await prisma.cIScan.update({
      where: { id: scanId },
      data: {
        prCommentUrl: urls.commentUrl || urls.noteUrl,
        checkRunId: urls.checkRunUrl || urls.statusUrl,
      },
    });

    return { success: true, urls: urls as Record<string, string> };
  } catch (error) {
    return {
      success: false,
      urls: {},
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** Webhook handler for GitHub events */
export async function handleGitHubWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<{ processed: boolean; action?: string }> {
  const _prisma = await getPrisma();

  // Handle check_suite events (auto-trigger scans)
  if (event === "check_suite") {
    const action = payload.action as string;

    if (action === "requested" || action === "rerequested") {
      // Could auto-trigger a scan here if configured
      return { processed: true, action: "scan_triggered" };
    }
  }

  // Handle pull_request events
  if (event === "pull_request") {
    const action = payload.action as string;

    if (action === "opened" || action === "synchronize") {
      // PR opened or new commits pushed - could trigger scan
      return { processed: true, action: "pr_updated" };
    }
  }

  // Handle issue_comment events (for /rerun commands)
  if (event === "issue_comment") {
    const action = payload.action as string;
    const comment = payload.comment as { body: string } | undefined;

    if (action === "created" && comment?.body.includes("/threat-model-scan")) {
      // Could parse command and re-run scan
      return { processed: true, action: "rerun_requested" };
    }
  }

  return { processed: false };
}

/** Webhook handler for GitLab events */
export async function handleGitLabWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<{ processed: boolean; action?: string }> {
  // Handle merge_request events
  if (event === "Merge Request Hook") {
    const action = (payload.object_attributes as Record<string, unknown>)
      ?.action as string;

    if (action === "open" || action === "update") {
      // MR opened or updated - could trigger scan
      return { processed: true, action: "mr_updated" };
    }
  }

  // Handle pipeline events
  if (event === "Pipeline Hook") {
    const status = (payload.object_attributes as Record<string, unknown>)
      ?.status as string;

    if (status === "pending" || status === "running") {
      return { processed: true, action: "pipeline_started" };
    }
  }

  // Handle note (comment) events for /rerun commands
  if (event === "Note Hook") {
    const noteableType = payload.object_attributes
      ? (payload.object_attributes as Record<string, unknown>).noteable_type
      : undefined;
    const body = payload.object_attributes
      ? ((payload.object_attributes as Record<string, unknown>).note as string)
      : undefined;

    if (
      noteableType === "MergeRequest" &&
      body?.includes("/threat-model-scan")
    ) {
      return { processed: true, action: "rerun_requested" };
    }
  }

  return { processed: false };
}

/** Webhook handler for Bitbucket events */
export async function handleBitbucketWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<{ processed: boolean; action?: string }> {
  // Handle pullrequest events
  if (event === "pullrequest:created" || event === "pullrequest:updated") {
    return { processed: true, action: "pr_updated" };
  }

  // Handle repo:push events
  if (event === "repo:push") {
    return { processed: true, action: "push_received" };
  }

  // Handle pullrequest:comment_created for /rerun commands
  if (event === "pullrequest:comment_created") {
    const content = (payload.comment as Record<string, unknown>)?.content as
      | Record<string, unknown>
      | undefined;
    const raw = content?.raw as string | undefined;

    if (raw?.includes("/threat-model-scan")) {
      return { processed: true, action: "rerun_requested" };
    }
  }

  return { processed: false };
}
