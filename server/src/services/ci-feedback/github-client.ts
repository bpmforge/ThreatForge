/**
 * GitHub API Client
 *
 * Client for posting PR comments and check runs.
 */

import type {
  GitHubClientConfig,
  CreateCheckRunRequest,
  CreatePRCommentRequest,
  CheckConclusion,
} from "./types.js";

const GITHUB_API_BASE = "https://api.github.com";

export class GitHubClient {
  private token: string;
  private baseUrl: string;

  constructor(config: GitHubClientConfig) {
    this.token = config.token;
    this.baseUrl = (config.baseUrl || GITHUB_API_BASE).replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      redirect: "manual",
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /** Create or update a check run */
  async createCheckRun(
    req: CreateCheckRunRequest,
  ): Promise<{ id: number; html_url: string }> {
    return this.request("POST", `/repos/${req.owner}/${req.repo}/check-runs`, {
      name: req.name,
      head_sha: req.headSha,
      status: req.status,
      conclusion: req.conclusion,
      output: req.title
        ? {
            title: req.title,
            summary: req.summary || "",
            text: req.text,
            annotations: req.annotations,
          }
        : undefined,
    });
  }

  /** Update an existing check run */
  async updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    updates: {
      status?: "queued" | "in_progress" | "completed";
      conclusion?: CheckConclusion;
      title?: string;
      summary?: string;
      text?: string;
    },
  ): Promise<{ id: number }> {
    return this.request(
      "PATCH",
      `/repos/${owner}/${repo}/check-runs/${checkRunId}`,
      {
        status: updates.status,
        conclusion: updates.conclusion,
        output: updates.title
          ? {
              title: updates.title,
              summary: updates.summary || "",
              text: updates.text,
            }
          : undefined,
      },
    );
  }

  /** Create a PR comment */
  async createPRComment(
    req: CreatePRCommentRequest,
  ): Promise<{ id: number; html_url: string }> {
    return this.request(
      "POST",
      `/repos/${req.owner}/${req.repo}/issues/${req.prNumber}/comments`,
      {
        body: req.body,
      },
    );
  }

  /** Update a PR comment */
  async updatePRComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ): Promise<{ id: number }> {
    return this.request(
      "PATCH",
      `/repos/${owner}/${repo}/issues/comments/${commentId}`,
      {
        body,
      },
    );
  }

  /** Find existing comment by marker */
  async findCommentByMarker(
    owner: string,
    repo: string,
    prNumber: number,
    marker: string,
  ): Promise<{ id: number; body: string } | null> {
    const comments = await this.request<Array<{ id: number; body: string }>>(
      "GET",
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    );

    return comments.find((c) => c.body.includes(marker)) || null;
  }

  /** Get commit status */
  async getCommitStatus(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<{
    state: string;
    statuses: Array<{ state: string; context: string }>;
  }> {
    return this.request("GET", `/repos/${owner}/${repo}/commits/${ref}/status`);
  }

  /** Create commit status */
  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    status: {
      state: "error" | "failure" | "pending" | "success";
      targetUrl?: string;
      description?: string;
      context: string;
    },
  ): Promise<{ id: number }> {
    return this.request("POST", `/repos/${owner}/${repo}/statuses/${sha}`, {
      state: status.state,
      target_url: status.targetUrl,
      description: status.description,
      context: status.context,
    });
  }

  /** Get PR info */
  async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<{
    number: number;
    title: string;
    head: { sha: string; ref: string };
    base: { sha: string; ref: string };
    html_url: string;
  }> {
    return this.request("GET", `/repos/${owner}/${repo}/pulls/${prNumber}`);
  }

  /** Get PR files */
  async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<
    Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
    }>
  > {
    return this.request(
      "GET",
      `/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    );
  }
}

/** Create GitHub client from token */
export function createGitHubClient(
  token: string,
  baseUrl?: string,
): GitHubClient {
  return new GitHubClient({ token, baseUrl });
}
