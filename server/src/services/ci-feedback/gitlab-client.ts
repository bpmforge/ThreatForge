/**
 * GitLab API Client
 *
 * Client for posting MR comments and pipeline status.
 */
import { timingSafeEqual } from "node:crypto";

const GITLAB_API_BASE = "https://gitlab.com/api/v4";

export interface GitLabClientConfig {
  token: string;
  baseUrl?: string;
}

export class GitLabClient {
  private token: string;
  private baseUrl: string;

  constructor(config: GitLabClientConfig) {
    this.token = config.token;
    this.baseUrl = (config.baseUrl || GITLAB_API_BASE).replace(/\/$/, "");
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
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitLab API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /** Create MR note (comment) */
  async createMRNote(
    projectId: string | number,
    mrIid: number,
    body: string,
  ): Promise<{ id: number; body: string }> {
    const encodedId = encodeURIComponent(String(projectId));
    return this.request(
      "POST",
      `/projects/${encodedId}/merge_requests/${mrIid}/notes`,
      { body },
    );
  }

  /** Update MR note */
  async updateMRNote(
    projectId: string | number,
    mrIid: number,
    noteId: number,
    body: string,
  ): Promise<{ id: number }> {
    const encodedId = encodeURIComponent(String(projectId));
    return this.request(
      "PUT",
      `/projects/${encodedId}/merge_requests/${mrIid}/notes/${noteId}`,
      { body },
    );
  }

  /** Find existing note by marker */
  async findNoteByMarker(
    projectId: string | number,
    mrIid: number,
    marker: string,
  ): Promise<{ id: number; body: string } | null> {
    const encodedId = encodeURIComponent(String(projectId));
    const notes = await this.request<Array<{ id: number; body: string }>>(
      "GET",
      `/projects/${encodedId}/merge_requests/${mrIid}/notes`,
    );
    return notes.find((n) => n.body.includes(marker)) || null;
  }

  /** Create commit status */
  async createCommitStatus(
    projectId: string | number,
    sha: string,
    status: {
      state: "pending" | "running" | "success" | "failed" | "canceled";
      name: string;
      targetUrl?: string;
      description?: string;
    },
  ): Promise<{ id: number }> {
    const encodedId = encodeURIComponent(String(projectId));
    return this.request("POST", `/projects/${encodedId}/statuses/${sha}`, {
      state: status.state,
      name: status.name,
      target_url: status.targetUrl,
      description: status.description,
    });
  }

  /** Get MR info */
  async getMergeRequest(
    projectId: string | number,
    mrIid: number,
  ): Promise<{
    iid: number;
    title: string;
    sha: string;
    source_branch: string;
    target_branch: string;
    web_url: string;
  }> {
    const encodedId = encodeURIComponent(String(projectId));
    return this.request(
      "GET",
      `/projects/${encodedId}/merge_requests/${mrIid}`,
    );
  }

  /** Get MR changes */
  async getMergeRequestChanges(
    projectId: string | number,
    mrIid: number,
  ): Promise<{ changes: Array<{ new_path: string; old_path: string }> }> {
    const encodedId = encodeURIComponent(String(projectId));
    return this.request(
      "GET",
      `/projects/${encodedId}/merge_requests/${mrIid}/changes`,
    );
  }
}

/** Create GitLab client from token */
export function createGitLabClient(
  token: string,
  baseUrl?: string,
): GitLabClient {
  return new GitLabClient({ token, baseUrl });
}

/** Verify GitLab webhook token */
export function verifyGitLabToken(
  headerToken: string | undefined,
  expectedToken: string,
): boolean {
  if (!headerToken) return false;
  const given = Buffer.from(headerToken);
  const expected = Buffer.from(expectedToken);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
