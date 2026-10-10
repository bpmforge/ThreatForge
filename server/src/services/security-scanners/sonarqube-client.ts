/**
 * SonarQube API Client
 *
 * Client for integrating with SonarQube/SonarCloud code quality and security analysis.
 */

import type {
  ScannerFinding,
  SonarQubeIssue,
  SonarQubeSearchResult,
  NormalizedSeverity,
  FindingCategory,
} from "./types.js";

interface SonarQubeClientConfig {
  baseUrl: string;
  token: string;
}

export class SonarQubeClient {
  private baseUrl: string;
  private token: string;

  constructor(config: SonarQubeClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
  }

  private async request<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      redirect: "manual",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.token}:`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `SonarQube API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /** Get all projects */
  async getProjects(): Promise<{
    components: { key: string; name: string }[];
  }> {
    return this.request("/api/projects/search");
  }

  /** Get issues for a project */
  async getProjectIssues(
    projectKey: string,
    types?: string[],
    severities?: string[],
    page = 1,
    pageSize = 100,
  ): Promise<SonarQubeSearchResult> {
    const params: Record<string, string> = {
      componentKeys: projectKey,
      p: String(page),
      ps: String(pageSize),
    };

    if (types?.length) {
      params.types = types.join(",");
    }
    if (severities?.length) {
      params.severities = severities.join(",");
    }

    return this.request("/api/issues/search", params);
  }

  /** Get all issues for a project (handles pagination) */
  async getAllProjectIssues(
    projectKey: string,
    types?: string[],
  ): Promise<SonarQubeIssue[]> {
    const allIssues: SonarQubeIssue[] = [];
    let page = 1;
    const pageSize = 100;
    let totalFetched = 0;

    while (true) {
      const result = await this.getProjectIssues(
        projectKey,
        types,
        undefined,
        page,
        pageSize,
      );
      allIssues.push(...result.issues);
      totalFetched += result.issues.length;

      if (totalFetched >= result.total) {
        break;
      }
      page++;
    }

    return allIssues;
  }

  /** Get security hotspots */
  async getSecurityHotspots(
    projectKey: string,
    page = 1,
    pageSize = 100,
  ): Promise<{ hotspots: SonarQubeIssue[]; paging: { total: number } }> {
    return this.request("/api/hotspots/search", {
      projectKey,
      p: String(page),
      ps: String(pageSize),
    });
  }

  /** Normalize SonarQube severity */
  private normalizeSeverity(severity: string): NormalizedSeverity {
    switch (severity) {
      case "BLOCKER":
      case "CRITICAL":
        return "CRITICAL";
      case "MAJOR":
        return "HIGH";
      case "MINOR":
        return "MEDIUM";
      case "INFO":
        return "LOW";
      default:
        return "INFO";
    }
  }

  /** Normalize SonarQube issue type */
  private normalizeCategory(type: string): FindingCategory {
    switch (type) {
      case "VULNERABILITY":
        return "VULNERABILITY";
      case "SECURITY_HOTSPOT":
        return "SECURITY_HOTSPOT";
      case "BUG":
        return "BUG";
      case "CODE_SMELL":
        return "CODE_SMELL";
      default:
        return "VULNERABILITY";
    }
  }

  /** Extract CWE from rule tags */
  private extractCweIds(tags: string[]): string[] {
    return tags
      .filter((tag) => tag.startsWith("cwe-"))
      .map((tag) => `CWE-${tag.replace("cwe-", "")}`);
  }

  /** Extract OWASP category from tags */
  private extractOwaspCategory(tags: string[]): string | undefined {
    const owaspTag = tags.find((tag) => tag.startsWith("owasp-"));
    return owaspTag?.replace("owasp-", "OWASP ").toUpperCase();
  }

  /** Convert SonarQube issue to normalized finding */
  normalizeIssue(issue: SonarQubeIssue): ScannerFinding {
    // Extract file path from component (format: project:path/to/file)
    const filePath = issue.component.includes(":")
      ? issue.component.split(":").slice(1).join(":")
      : issue.component;

    return {
      externalId: issue.key,
      scannerType: "SONARQUBE",
      title: issue.message,
      description: issue.message,
      severity: this.normalizeSeverity(issue.severity),
      category: this.normalizeCategory(issue.type),
      cweIds: this.extractCweIds(issue.tags),
      cveIds: [],
      owaspCategory: this.extractOwaspCategory(issue.tags),
      filePath,
      lineNumber: issue.line,
      remediation: issue.debt ? `Estimated fix time: ${issue.debt}` : undefined,
      firstSeen: new Date(issue.creationDate),
      lastSeen: new Date(issue.updateDate),
      rawData: issue as unknown as Record<string, unknown>,
    };
  }

  /** Process issues into normalized findings */
  processIssues(issues: SonarQubeIssue[]): ScannerFinding[] {
    return issues.map((issue) => this.normalizeIssue(issue));
  }
}

/** Create SonarQube client from config */
export function createSonarQubeClient(
  baseUrl: string,
  token: string,
): SonarQubeClient {
  return new SonarQubeClient({ baseUrl, token });
}
