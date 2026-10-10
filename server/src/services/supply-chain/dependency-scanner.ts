/**
 * Supply Chain Dependency Scanner
 *
 * Parses dependency files (package.json, requirements.txt, go.mod)
 * and cross-references with NVD for known vulnerabilities.
 */

import { getNvdApiKey } from "../nvd/nvd-api-key.js";
import logger from "../../utils/logger.js";

export interface Dependency {
  name: string;
  version: string;
  ecosystem: "npm" | "pypi" | "go" | "maven" | "cargo";
}

interface VulnerableDependency {
  dependency: Dependency;
  cves: Array<{
    id: string;
    severity: string;
    cvss?: number;
    description: string;
  }>;
  /** NONE = NVD returned no CVEs; UNKNOWN = not verified (see unknownReason). */
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE" | "UNKNOWN";
  /** Set only when riskLevel is UNKNOWN. */
  unknownReason?: "lookup_failed" | "not_checked";
}

export interface SupplyChainReport {
  totalDependencies: number;
  vulnerableDependencies: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  /** Dependencies whose NVD lookup failed or was skipped. */
  unknownCount: number;
  dependencies: VulnerableDependency[];
  scannedAt: string;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/** Parse package.json dependencies */
function parsePackageJson(content: string): Dependency[] {
  try {
    const pkg = JSON.parse(content);
    const deps: Dependency[] = [];
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      deps.push({
        name,
        version: String(version).replace(/^[\^~>=<]/, ""),
        ecosystem: "npm",
      });
    }
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      deps.push({
        name,
        version: String(version).replace(/^[\^~>=<]/, ""),
        ecosystem: "npm",
      });
    }
    return deps;
  } catch {
    return [];
  }
}

/** Parse requirements.txt */
function parseRequirementsTxt(content: string): Dependency[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => {
      const match = line.match(
        /^([a-zA-Z0-9_.-]+)\s*(?:==|>=|<=|~=|!=)\s*([0-9][^\s;#]*)/,
      );
      if (match)
        return {
          name: match[1],
          version: match[2],
          ecosystem: "pypi" as const,
        };
      const nameOnly = line.match(/^([a-zA-Z0-9_.-]+)/);
      if (nameOnly)
        return {
          name: nameOnly[1],
          version: "latest",
          ecosystem: "pypi" as const,
        };
      return null;
    })
    .filter((d) => d !== null) as Dependency[];
}

/** Parse go.mod */
function parseGoMod(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);
  if (requireBlock) {
    const lines = requireBlock[1]
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(v[\d.]+)/);
      if (match) {
        deps.push({ name: match[1], version: match[2], ecosystem: "go" });
      }
    }
  }
  return deps;
}

/** Parse pom.xml (basic) */
function parsePomXml(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const depPattern =
    /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*(?:<version>([^<]+)<\/version>)?/g;
  let match;
  while ((match = depPattern.exec(content)) !== null) {
    deps.push({
      name: `${match[1]}:${match[2]}`,
      version: match[3] || "unknown",
      ecosystem: "maven",
    });
  }
  return deps;
}

/** Parse Cargo.toml */
function parseCargoToml(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const depSection = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
  if (depSection) {
    const lines = depSection[1]
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(\S+)\s*=\s*"([^"]+)"/);
      if (match) {
        deps.push({ name: match[1], version: match[2], ecosystem: "cargo" });
      }
    }
  }
  return deps;
}

// ---------------------------------------------------------------------------
// NVD Lookup
// ---------------------------------------------------------------------------

const NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const NVD_TIMEOUT = 5000;

/**
 * The NVD lookup failed (network error, timeout or non-OK status, including
 * rate limiting). Thrown instead of returning no CVEs, so the caller marks
 * the dependency UNKNOWN rather than NONE.
 */
class NvdLookupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NvdLookupError";
  }
}

async function searchNVD(
  depName: string,
  depVersion: string,
): Promise<VulnerableDependency["cves"]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NVD_TIMEOUT);
  try {
    const keyword = `${depName} ${depVersion}`;
    const params = new URLSearchParams({
      keywordSearch: keyword,
      resultsPerPage: "3",
    });

    const headers: Record<string, string> = { Accept: "application/json" };
    const apiKey = await getNvdApiKey();
    if (apiKey) headers["apiKey"] = apiKey;

    const res = await fetch(`${NVD_API}?${params}`, {
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new NvdLookupError(
        `NVD lookup for ${depName} failed with HTTP ${res.status}`,
      );
    }

    const data = (await res.json()) as {
      vulnerabilities?: Array<{
        cve: {
          id: string;
          descriptions: Array<{ lang: string; value: string }>;
          metrics?: {
            cvssMetricV31?: Array<{
              cvssData: { baseScore: number; baseSeverity: string };
            }>;
          };
        };
      }>;
    };

    return (data.vulnerabilities || []).slice(0, 3).map((v) => {
      const desc = v.cve.descriptions.find((d) => d.lang === "en")?.value || "";
      const cvss = v.cve.metrics?.cvssMetricV31?.[0]?.cvssData;
      return {
        id: v.cve.id,
        severity: cvss?.baseSeverity || "UNKNOWN",
        cvss: cvss?.baseScore,
        description: desc.length > 150 ? desc.slice(0, 147) + "..." : desc,
      };
    });
  } catch (error) {
    if (error instanceof NvdLookupError) throw error;
    throw new NvdLookupError(`NVD lookup for ${depName} failed`, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Auto-detect file type and parse dependencies */
export function parseDependencies(
  content: string,
  filename?: string,
): Dependency[] {
  const name = filename?.toLowerCase() || "";
  if (name.includes("package.json") || content.includes('"dependencies"'))
    return parsePackageJson(content);
  if (name.includes("requirements") || name.endsWith(".txt"))
    return parseRequirementsTxt(content);
  if (name.includes("go.mod") || content.includes("module "))
    return parseGoMod(content);
  if (name.includes("pom.xml") || content.includes("<groupId>"))
    return parsePomXml(content);
  if (name.includes("cargo.toml") || content.includes("[dependencies]"))
    return parseCargoToml(content);
  return [];
}

/** Map the highest CVSS score among a dependency's CVEs to a risk level. */
function riskFromCves(
  cves: VulnerableDependency["cves"],
): VulnerableDependency["riskLevel"] {
  const score = Math.max(0, ...cves.map((cve) => cve.cvss || 0));
  if (score >= 9) return "CRITICAL";
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

/**
 * Scan dependencies for known vulnerabilities.
 *
 * NONE means NVD was queried and returned no CVEs. A dependency whose lookup
 * failed, or that was past the `maxNVDCalls` cap and never looked up, is
 * UNKNOWN: it has not been verified either way.
 */
export async function scanDependencies(
  deps: Dependency[],
  maxNVDCalls: number = 10,
): Promise<SupplyChainReport> {
  const results: VulnerableDependency[] = [];
  let nvdCalls = 0;

  for (const dep of deps) {
    if (nvdCalls >= maxNVDCalls) {
      results.push({
        dependency: dep,
        cves: [],
        riskLevel: "UNKNOWN",
        unknownReason: "not_checked",
      });
      continue;
    }

    nvdCalls++;
    try {
      const cves = await searchNVD(dep.name, dep.version);
      results.push({ dependency: dep, cves, riskLevel: riskFromCves(cves) });
    } catch (error) {
      logger.warn({ err: error, dependency: dep.name }, "NVD lookup failed");
      results.push({
        dependency: dep,
        cves: [],
        riskLevel: "UNKNOWN",
        unknownReason: "lookup_failed",
      });
    }
  }

  return {
    totalDependencies: deps.length,
    vulnerableDependencies: results.filter((r) => r.cves.length > 0).length,
    criticalCount: results.filter((r) => r.riskLevel === "CRITICAL").length,
    highCount: results.filter((r) => r.riskLevel === "HIGH").length,
    mediumCount: results.filter((r) => r.riskLevel === "MEDIUM").length,
    unknownCount: results.filter((r) => r.riskLevel === "UNKNOWN").length,
    dependencies: results.sort(
      (a, b) => (b.cves[0]?.cvss || 0) - (a.cves[0]?.cvss || 0),
    ),
    scannedAt: new Date().toISOString(),
  };
}
