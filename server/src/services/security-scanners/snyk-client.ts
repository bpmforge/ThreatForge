/**
 * Snyk API Client
 *
 * Client for integrating with Snyk's vulnerability scanning API.
 */

import type {
  ScannerFinding,
  SnykTestResult,
  SnykVulnerability,
  NormalizedSeverity,
} from "./types.js";

const SNYK_API_BASE = "https://snyk.io/api/v1";

interface SnykClientConfig {
  apiKey: string;
  orgId?: string;
}

export class SnykClient {
  private apiKey: string;
  private orgId?: string;

  constructor(config: SnykClientConfig) {
    this.apiKey = config.apiKey;
    this.orgId = config.orgId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${SNYK_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `token ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Snyk API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /** Get organization projects */
  async getProjects(): Promise<{ projects: { id: string; name: string }[] }> {
    const path = this.orgId ? `/org/${this.orgId}/projects` : "/projects";
    return this.request("GET", path);
  }

  /** Get issues for a project */
  async getProjectIssues(projectId: string): Promise<SnykTestResult> {
    const path = this.orgId
      ? `/org/${this.orgId}/project/${projectId}/issues`
      : `/project/${projectId}/issues`;
    return this.request("GET", path);
  }

  /** Test a package for vulnerabilities */
  async testPackage(
    ecosystem: "npm" | "pip" | "maven" | "nuget",
    packageName: string,
    version: string,
  ): Promise<SnykTestResult> {
    return this.request("GET", `/test/${ecosystem}/${packageName}/${version}`);
  }

  /** Normalize Snyk severity to our format */
  private normalizeSeverity(severity: string): NormalizedSeverity {
    switch (severity.toLowerCase()) {
      case "critical":
        return "CRITICAL";
      case "high":
        return "HIGH";
      case "medium":
        return "MEDIUM";
      case "low":
        return "LOW";
      default:
        return "INFO";
    }
  }

  /** Convert Snyk vulnerability to normalized finding */
  normalizeVulnerability(vuln: SnykVulnerability): ScannerFinding {
    return {
      externalId: vuln.id,
      scannerType: "SNYK",
      title: vuln.title,
      description: vuln.description,
      severity: this.normalizeSeverity(vuln.severity),
      category: "DEPENDENCY",
      cweIds: vuln.identifiers.CWE || [],
      cveIds: vuln.identifiers.CVE || [],
      componentName: vuln.packageName,
      componentVersion: vuln.version,
      fixAvailable: vuln.isUpgradable || vuln.isPatchable,
      fixVersion: vuln.fixedIn[0],
      remediation: vuln.isUpgradable
        ? `Upgrade to version ${vuln.fixedIn[0]}`
        : vuln.isPatchable
          ? "Apply available patch"
          : "No fix available - consider alternative package",
      externalUrl: `https://snyk.io/vuln/${vuln.id}`,
      firstSeen: new Date(),
      lastSeen: new Date(),
      rawData: vuln as unknown as Record<string, unknown>,
    };
  }

  /** Process test results into normalized findings */
  processTestResult(result: SnykTestResult): ScannerFinding[] {
    return result.vulnerabilities.map((v) => this.normalizeVulnerability(v));
  }
}

/** Create Snyk client from stored config */
export function createSnykClient(apiKey: string, orgId?: string): SnykClient {
  return new SnykClient({ apiKey, orgId });
}
