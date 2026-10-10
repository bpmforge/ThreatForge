/**
 * Threat Research Service
 *
 * Phase 2 of the context-aware pipeline. Looks up known threats
 * from OWASP, CWE, and NVD (CVE) databases WITHOUT calling an LLM.
 *
 * Works offline with local data. Online enrichment via NVD API when available.
 */
import { getNvdApiKey } from "../nvd/nvd-api-key.js";
import logger from "../../utils/logger.js";

export interface ThreatResearch {
  owasp: OWASPCategory[];
  cwes: CWEEntry[];
  cves: CVEEntry[];
  complianceRequirements: ComplianceRequirement[];
}

export interface OWASPCategory {
  id: string; // "A01:2021"
  name: string;
  description: string;
  relevance: string; // Why this applies to this component
}

export interface CWEEntry {
  id: string; // "CWE-89"
  name: string;
  description: string;
}

interface CVEEntry {
  id: string; // "CVE-2024-12345"
  description: string;
  severity: string;
  cvss?: number;
}

export interface ComplianceRequirement {
  framework: string;
  clause: string;
  requirement: string;
}

// =============================================================================
// OWASP Top 10 (2021) — Local Database
// =============================================================================

const OWASP_BY_COMPONENT: Record<
  string,
  Array<{ id: string; name: string; description: string; relevance: string }>
> = {
  DATABASE: [
    {
      id: "A03:2021",
      name: "Injection",
      description: "SQL, NoSQL, ORM injection via untrusted data",
      relevance: "Database processes queries that may contain user input",
    },
    {
      id: "A01:2021",
      name: "Broken Access Control",
      description: "Users act outside intended permissions",
      relevance: "Database stores data that requires access control",
    },
    {
      id: "A02:2021",
      name: "Cryptographic Failures",
      description: "Sensitive data exposure",
      relevance: "Database may store sensitive data without encryption",
    },
  ],
  API: [
    {
      id: "A01:2021",
      name: "Broken Access Control",
      description: "Missing function-level access control",
      relevance: "API endpoints require authorization checks",
    },
    {
      id: "A03:2021",
      name: "Injection",
      description: "Untrusted data sent to interpreter",
      relevance: "API accepts user input that flows to backend systems",
    },
    {
      id: "A07:2021",
      name: "Identification and Authentication Failures",
      description: "Broken authentication",
      relevance: "API must verify caller identity",
    },
    {
      id: "A04:2021",
      name: "Insecure Design",
      description: "Missing or ineffective controls",
      relevance: "API design must include rate limiting and validation",
    },
  ],
  WEB_APP: [
    {
      id: "A03:2021",
      name: "Injection",
      description: "XSS via untrusted data in HTML",
      relevance: "Web app renders user input in the browser",
    },
    {
      id: "A05:2021",
      name: "Security Misconfiguration",
      description: "Missing security headers",
      relevance: "Web app must set CSP, X-Frame-Options, etc.",
    },
    {
      id: "A08:2021",
      name: "Software and Data Integrity Failures",
      description: "Insecure deserialization, untrusted CDN",
      relevance: "Web app loads scripts and data from external sources",
    },
  ],
  AUTH_SERVICE: [
    {
      id: "A07:2021",
      name: "Identification and Authentication Failures",
      description: "Broken authentication mechanisms",
      relevance: "Auth service is the primary identity verification point",
    },
    {
      id: "A02:2021",
      name: "Cryptographic Failures",
      description: "Weak password hashing, token generation",
      relevance: "Auth service handles credentials and tokens",
    },
  ],
  OBJECT_STORAGE: [
    {
      id: "A01:2021",
      name: "Broken Access Control",
      description: "Public bucket, IDOR",
      relevance: "Storage bucket may be misconfigured for public access",
    },
    {
      id: "A02:2021",
      name: "Cryptographic Failures",
      description: "Unencrypted data at rest",
      relevance: "Storage may contain sensitive files without encryption",
    },
    {
      id: "A05:2021",
      name: "Security Misconfiguration",
      description: "Default permissions, logging disabled",
      relevance: "Storage requires explicit access policies",
    },
  ],
  CONTAINER: [
    {
      id: "A06:2021",
      name: "Vulnerable and Outdated Components",
      description: "Known CVEs in base image",
      relevance: "Container image may include vulnerable packages",
    },
    {
      id: "A05:2021",
      name: "Security Misconfiguration",
      description: "Running as root, excessive capabilities",
      relevance: "Container security requires restricted privileges",
    },
  ],
};

// =============================================================================
// CWE Top 25 — Mapped to Component Types
// =============================================================================

const CWE_BY_COMPONENT: Record<string, CWEEntry[]> = {
  DATABASE: [
    {
      id: "CWE-89",
      name: "SQL Injection",
      description:
        "Improper neutralization of special elements in SQL commands",
    },
    {
      id: "CWE-311",
      name: "Missing Encryption of Sensitive Data",
      description: "Data transmitted or stored without encryption",
    },
    {
      id: "CWE-200",
      name: "Exposure of Sensitive Information",
      description:
        "Application reveals sensitive information to unauthorized actors",
    },
  ],
  API: [
    {
      id: "CWE-862",
      name: "Missing Authorization",
      description: "No authorization check on function that should require it",
    },
    {
      id: "CWE-20",
      name: "Improper Input Validation",
      description: "Input not properly validated before processing",
    },
    {
      id: "CWE-352",
      name: "CSRF",
      description: "Cross-site request forgery via missing anti-forgery tokens",
    },
    {
      id: "CWE-918",
      name: "SSRF",
      description: "Server-side request forgery via user-controlled URLs",
    },
  ],
  WEB_APP: [
    {
      id: "CWE-79",
      name: "XSS",
      description:
        "Cross-site scripting via improper neutralization of user input",
    },
    {
      id: "CWE-1275",
      name: "Sensitive Cookie Without SameSite",
      description: "Cookie set without SameSite attribute",
    },
  ],
  AUTH_SERVICE: [
    {
      id: "CWE-287",
      name: "Improper Authentication",
      description: "Actor claims identity without sufficient proof",
    },
    {
      id: "CWE-384",
      name: "Session Fixation",
      description: "Session identifier not regenerated after authentication",
    },
    {
      id: "CWE-307",
      name: "Improper Restriction of Excessive Authentication Attempts",
      description: "No brute-force protection on login",
    },
    {
      id: "CWE-916",
      name: "Weak Password Hashing",
      description: "Password stored with weak hash algorithm",
    },
  ],
  OBJECT_STORAGE: [
    {
      id: "CWE-732",
      name: "Incorrect Permission Assignment",
      description: "Resource created with overly permissive access rights",
    },
    {
      id: "CWE-434",
      name: "Unrestricted Upload",
      description: "File upload without type validation",
    },
  ],
};

// =============================================================================
// Compliance Requirements — By Framework + Data Type
// =============================================================================

/**
 * COMPLIANCE_REQUIREMENTS keys its `dataTypes` on four canonical CLASSES —
 * PII, PHI, Financial, Credentials — but a component's `dataTypes` are free
 * text typed by whoever drew the canvas ("payment tokens", "password hashes",
 * "shipping addresses"). Matching those two by string equality only ever hits
 * on the literal word "PII", so PCI-DSS and HIPAA could not fire for any
 * realistically-labelled component: the go-forward fixture's Billing Service
 * is declared PCI-DSS with dataTypes ["payment tokens", "invoice records"]
 * and matched zero clauses.
 *
 * This maps free text onto the classes. Substring, case-insensitive, and
 * deliberately conservative — a missed mapping loses a clause, a wrong one
 * asserts a compliance obligation that does not apply, which is worse.
 */
const DATA_CLASS_PATTERNS: Record<string, RegExp> = {
  Financial: /payment|card|charge|invoice|billing|transaction|bank|ledger/i,
  Credentials:
    /password|credential|secret|token|api[ _-]?key|session|mfa|otp|refresh|private[ _-]?key/i,
  PII: /\bpii\b|personal|email|phone|address|customer|name|birth|ssn|national[ _-]?id/i,
  PHI: /\bphi\b|health|medical|patient|diagnos|clinical|prescription/i,
};

/**
 * Expand free-text data types with the canonical classes they imply, keeping
 * the originals so an already-canonical value still matches.
 */
export function expandDataClasses(dataTypes: string[]): string[] {
  const out = new Set(dataTypes);
  for (const dt of dataTypes) {
    for (const [cls, pattern] of Object.entries(DATA_CLASS_PATTERNS)) {
      if (pattern.test(dt)) out.add(cls);
    }
  }
  return [...out];
}

const COMPLIANCE_REQUIREMENTS: Record<
  string,
  Array<{ clause: string; requirement: string; dataTypes: string[] }>
> = {
  HIPAA: [
    {
      clause: "§164.312(a)(2)(iv)",
      requirement: "Encrypt ePHI at rest and in transit",
      dataTypes: ["PHI"],
    },
    {
      clause: "§164.312(b)",
      requirement: "Implement audit controls for PHI access",
      dataTypes: ["PHI"],
    },
    {
      clause: "§164.312(c)(1)",
      requirement: "Protect ePHI from improper alteration",
      dataTypes: ["PHI"],
    },
    {
      clause: "§164.312(d)",
      requirement: "Authenticate persons seeking access to ePHI",
      dataTypes: ["PHI"],
    },
  ],
  "PCI-DSS": [
    {
      clause: "Req 3.4",
      requirement: "Render PAN unreadable anywhere it is stored",
      dataTypes: ["Financial"],
    },
    {
      clause: "Req 4.1",
      requirement: "Use strong cryptography for cardholder data transmission",
      dataTypes: ["Financial"],
    },
    {
      clause: "Req 6.5",
      requirement: "Address common coding vulnerabilities (OWASP Top 10)",
      dataTypes: ["Financial"],
    },
    {
      clause: "Req 8.1",
      requirement: "Assign unique IDs to each person with computer access",
      dataTypes: ["Financial"],
    },
  ],
  SOC2: [
    {
      clause: "CC6.1",
      requirement: "Logical and physical access controls",
      dataTypes: ["PII", "Financial", "Credentials"],
    },
    {
      clause: "CC6.6",
      requirement: "Restrict access to confidential information",
      dataTypes: ["PII", "Credentials"],
    },
    {
      clause: "CC7.2",
      requirement: "Monitor system components for anomalies",
      dataTypes: ["PII", "Financial"],
    },
  ],
  GDPR: [
    {
      clause: "Art. 25",
      requirement: "Data protection by design and by default",
      dataTypes: ["PII"],
    },
    {
      clause: "Art. 32",
      requirement:
        "Implement appropriate technical and organizational measures",
      dataTypes: ["PII"],
    },
    {
      clause: "Art. 33",
      requirement: "Notification of personal data breach within 72 hours",
      dataTypes: ["PII"],
    },
  ],
};

// =============================================================================
// Public API
// =============================================================================

// =============================================================================
// NVD API Integration
// =============================================================================

const NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const NVD_TIMEOUT_MS = 5000;

/** Map component types to NVD keyword search terms */
const NVD_KEYWORDS: Record<string, string[]> = {
  DATABASE: ["sql injection", "database"],
  API: ["api", "rest"],
  API_GATEWAY: ["api gateway"],
  WEB_APP: ["cross-site scripting", "web application"],
  AUTH_SERVICE: ["authentication bypass"],
  AWS_S3: ["s3 bucket", "aws s3"],
  AWS_LAMBDA: ["aws lambda", "serverless"],
  AWS_RDS: ["aws rds", "database"],
  AWS_COGNITO: ["cognito", "authentication"],
  CONTAINER: ["container escape", "docker"],
  KUBERNETES: ["kubernetes", "k8s"],
};

interface NVDResponse {
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
}

/**
 * Search NVD for CVEs related to a technology/component.
 * Returns empty array on failure (graceful degradation).
 */
async function searchNVD(
  keyword: string,
  technologyVersion?: string,
): Promise<CVEEntry[]> {
  try {
    const params = new URLSearchParams({
      keywordSearch: technologyVersion
        ? `${keyword} ${technologyVersion}`
        : keyword,
      resultsPerPage: "5",
    });

    const apiKey = await getNvdApiKey();
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers["apiKey"] = apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NVD_TIMEOUT_MS);

    const res = await fetch(`${NVD_API_BASE}?${params}`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn({ status: res.status }, "NVD API returned non-OK status");
      return [];
    }

    const data = (await res.json()) as NVDResponse;
    if (!data.vulnerabilities?.length) return [];

    return data.vulnerabilities.slice(0, 5).map((v) => {
      const desc =
        v.cve.descriptions.find((d) => d.lang === "en")?.value ||
        v.cve.descriptions[0]?.value ||
        "";
      const cvss = v.cve.metrics?.cvssMetricV31?.[0]?.cvssData;
      return {
        id: v.cve.id,
        description: desc.length > 200 ? desc.slice(0, 197) + "..." : desc,
        severity: cvss?.baseSeverity || "UNKNOWN",
        cvss: cvss?.baseScore,
      };
    });
  } catch (err) {
    logger.debug(
      { err, keyword },
      "NVD lookup failed (offline or rate-limited)",
    );
    return [];
  }
}

/**
 * Research known threats for a component based on its type, data, and compliance context.
 * OWASP/CWE are local lookups. CVEs come from NVD API when available.
 */
export async function researchThreats(params: {
  componentType: string;
  dataTypes: string[];
  complianceFrameworks: string[];
  technologyVersion?: string;
}): Promise<ThreatResearch> {
  const typeKey = params.componentType.toUpperCase().replace(/[-\s]/g, "_");

  // OWASP mapping
  const owasp = OWASP_BY_COMPONENT[typeKey] || [];

  // CWE mapping
  const cwes = CWE_BY_COMPONENT[typeKey] || [];

  // Compliance requirements based on data types
  const complianceRequirements: ComplianceRequirement[] = [];
  const dataClasses = expandDataClasses(params.dataTypes);
  for (const framework of params.complianceFrameworks) {
    const reqs = COMPLIANCE_REQUIREMENTS[framework] || [];
    for (const req of reqs) {
      if (req.dataTypes.some((dt) => dataClasses.includes(dt))) {
        complianceRequirements.push({
          framework,
          clause: req.clause,
          requirement: req.requirement,
        });
      }
    }
  }

  // CVEs — search NVD API (gracefully degrades if offline/rate-limited)
  let cves: CVEEntry[] = [];
  const keywords = NVD_KEYWORDS[typeKey];
  if (keywords?.length) {
    const results = await Promise.all(
      keywords.slice(0, 2).map((kw) => searchNVD(kw, params.technologyVersion)),
    );
    const seen = new Set<string>();
    for (const batch of results) {
      for (const cve of batch) {
        if (!seen.has(cve.id)) {
          seen.add(cve.id);
          cves.push(cve);
        }
      }
    }
    cves = cves.slice(0, 10); // Cap at 10
  }

  logger.debug(
    {
      componentType: typeKey,
      owaspCount: owasp.length,
      cweCount: cwes.length,
      complianceCount: complianceRequirements.length,
    },
    "Threat research complete",
  );

  return { owasp, cwes, cves, complianceRequirements };
}
