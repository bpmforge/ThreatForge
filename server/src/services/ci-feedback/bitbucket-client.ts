/**
 * Bitbucket API Client
 *
 * Client for posting PR comments and build status.
 */

const BITBUCKET_API_BASE = "https://api.bitbucket.org/2.0";

export interface BitbucketClientConfig {
  username: string;
  appPassword: string;
  baseUrl?: string;
}

export class BitbucketClient {
  private auth: string;
  private baseUrl: string;

  constructor(config: BitbucketClientConfig) {
    this.auth = Buffer.from(
      `${config.username}:${config.appPassword}`,
    ).toString("base64");
    this.baseUrl = (config.baseUrl || BITBUCKET_API_BASE).replace(/\/$/, "");
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
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bitbucket API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /** Create PR comment */
  async createPRComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    content: string,
  ): Promise<{ id: number; content: { raw: string } }> {
    return this.request(
      "POST",
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
      {
        content: { raw: content },
      },
    );
  }

  /** Update PR comment */
  async updatePRComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    commentId: number,
    content: string,
  ): Promise<{ id: number }> {
    return this.request(
      "PUT",
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments/${commentId}`,
      {
        content: { raw: content },
      },
    );
  }

  /** Find existing comment by marker */
  async findCommentByMarker(
    workspace: string,
    repoSlug: string,
    prId: number,
    marker: string,
  ): Promise<{ id: number; content: { raw: string } } | null> {
    const result = await this.request<{
      values: Array<{ id: number; content: { raw: string } }>;
    }>(
      "GET",
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
    );
    return result.values.find((c) => c.content.raw.includes(marker)) || null;
  }

  /** Create build status */
  async createBuildStatus(
    workspace: string,
    repoSlug: string,
    commitSha: string,
    status: {
      state: "INPROGRESS" | "SUCCESSFUL" | "FAILED" | "STOPPED";
      key: string;
      name: string;
      url?: string;
      description?: string;
    },
  ): Promise<{ uuid: string }> {
    return this.request(
      "POST",
      `/repositories/${workspace}/${repoSlug}/commit/${commitSha}/statuses/build`,
      {
        state: status.state,
        key: status.key,
        name: status.name,
        url: status.url,
        description: status.description,
      },
    );
  }

  /** Get PR info */
  async getPullRequest(
    workspace: string,
    repoSlug: string,
    prId: number,
  ): Promise<{
    id: number;
    title: string;
    source: { commit: { hash: string }; branch: { name: string } };
    destination: { commit: { hash: string }; branch: { name: string } };
    links: { html: { href: string } };
  }> {
    return this.request(
      "GET",
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
    );
  }

  /** Get PR diff stat */
  async getPullRequestDiffstat(
    workspace: string,
    repoSlug: string,
    prId: number,
  ): Promise<{
    values: Array<{ new: { path: string }; old?: { path: string } }>;
  }> {
    return this.request(
      "GET",
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diffstat`,
    );
  }
}

/** Create Bitbucket client */
export function createBitbucketClient(
  username: string,
  appPassword: string,
  baseUrl?: string,
): BitbucketClient {
  return new BitbucketClient({ username, appPassword, baseUrl });
}
