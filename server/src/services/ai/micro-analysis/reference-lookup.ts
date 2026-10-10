/**
 * Reference Data Lookup
 *
 * The KEY differentiator: for each component type + STRIDE category,
 * returns all relevant reference data from existing libraries so the
 * LLM has concrete examples instead of guessing.
 */
import {
  getThreatsForComponentAndCategory,
  getThreatsForComponentType,
} from "../../../data/threat-libraries/index.js";
import type {
  ThreatResearch,
  OWASPCategory,
  CWEEntry,
} from "../../threat-generation/threat-research.js";
import type { GeneratedThreat } from "../../threat-generation/stride-analyzer.js";
import type { CategoryReferenceData } from "./types.js";

// ---------------------------------------------------------------------------
// STRIDE → CWE mapping (which CWEs are most relevant per category)
// ---------------------------------------------------------------------------

const STRIDE_TO_CWE: Record<string, string[]> = {
  SPOOFING: [
    "CWE-287", // Improper Authentication
    "CWE-384", // Session Fixation
    "CWE-307", // Brute Force
    "CWE-290", // Authentication Bypass by Spoofing
    "CWE-295", // Improper Certificate Validation
    "CWE-346", // Origin Validation Error
  ],
  TAMPERING: [
    "CWE-20", // Improper Input Validation
    "CWE-89", // SQL Injection
    "CWE-79", // Cross-site Scripting
    "CWE-94", // Code Injection
    "CWE-352", // CSRF
    "CWE-345", // Insufficient Verification of Data Authenticity
  ],
  REPUDIATION: [
    "CWE-778", // Insufficient Logging
    "CWE-223", // Omission of Security-relevant Information
    "CWE-532", // Log Injection
    "CWE-779", // Logging of Excessive Data
  ],
  INFORMATION_DISCLOSURE: [
    "CWE-200", // Exposure of Sensitive Information
    "CWE-312", // Cleartext Storage of Sensitive Information
    "CWE-319", // Cleartext Transmission of Sensitive Information
    "CWE-209", // Error Message Information Leak
    "CWE-532", // Info Exposure Through Log Files
    "CWE-311", // Missing Encryption of Sensitive Data
  ],
  DENIAL_OF_SERVICE: [
    "CWE-400", // Uncontrolled Resource Consumption
    "CWE-770", // Allocation Without Limits
    "CWE-834", // Excessive Iteration
    "CWE-407", // Algorithmic Complexity
    "CWE-410", // Insufficient Resource Pool
  ],
  ELEVATION_OF_PRIVILEGE: [
    "CWE-269", // Improper Privilege Management
    "CWE-862", // Missing Authorization
    "CWE-863", // Incorrect Authorization
    "CWE-639", // IDOR
    "CWE-918", // SSRF
    "CWE-250", // Execution with Unnecessary Privileges
  ],
};

/**
 * PASTA, kill-chain and MITRE-keyed categories. The STRIDE maps only
 * matched six category names, so every other methodology got an empty CWE and
 * OWASP section. Ids reuse the STRIDE set where they fit; new ids are named in
 * CWE_NAMES below.
 */
const OTHER_METHODOLOGY_TO_CWE: Record<string, string[]> = {
  // PASTA
  BUSINESS_LOGIC: ["CWE-840", "CWE-841", "CWE-639", "CWE-362"],
  DATA_EXPOSURE: ["CWE-200", "CWE-312", "CWE-319", "CWE-311"],
  ACCESS_CONTROL: ["CWE-862", "CWE-863", "CWE-287", "CWE-269"],
  INJECTION: ["CWE-89", "CWE-79", "CWE-94", "CWE-78", "CWE-20"],
  SUPPLY_CHAIN: ["CWE-1104", "CWE-829", "CWE-494", "CWE-345"],
  INFRASTRUCTURE: ["CWE-16", "CWE-1188", "CWE-732", "CWE-284"],
  INSIDER_THREAT: ["CWE-269", "CWE-250", "CWE-778", "CWE-862"],
  AVAILABILITY: ["CWE-400", "CWE-770", "CWE-834", "CWE-410"],
  // Kill chain
  RECONNAISSANCE: ["CWE-200", "CWE-209", "CWE-538"],
  DELIVERY: ["CWE-434", "CWE-79", "CWE-94", "CWE-352"],
  EXPLOITATION: ["CWE-94", "CWE-78", "CWE-787", "CWE-1104"],
  INSTALLATION: ["CWE-732", "CWE-494", "CWE-829", "CWE-506"],
  COMMAND_AND_CONTROL: ["CWE-918", "CWE-319", "CWE-346", "CWE-295"],
  ACTIONS_ON_OBJECTIVES: ["CWE-200", "CWE-311", "CWE-285", "CWE-345"],
  // MITRE ATT&CK tactics
  INITIAL_ACCESS: ["CWE-287", "CWE-307", "CWE-798", "CWE-306"],
  EXECUTION: ["CWE-78", "CWE-94", "CWE-502", "CWE-77"],
  PERSISTENCE: ["CWE-732", "CWE-494", "CWE-506", "CWE-321"],
  PRIVILEGE_ESCALATION: ["CWE-269", "CWE-250", "CWE-863", "CWE-862"],
  DEFENSE_EVASION: ["CWE-778", "CWE-223", "CWE-117", "CWE-693"],
  CREDENTIAL_ACCESS: ["CWE-798", "CWE-522", "CWE-312", "CWE-257"],
  DISCOVERY: ["CWE-200", "CWE-209", "CWE-538"],
  LATERAL_MOVEMENT: ["CWE-287", "CWE-284", "CWE-863", "CWE-346"],
  COLLECTION: ["CWE-200", "CWE-312", "CWE-639", "CWE-862"],
  EXFILTRATION: ["CWE-200", "CWE-319", "CWE-918", "CWE-201"],
  IMPACT: ["CWE-400", "CWE-770", "CWE-345", "CWE-754"],
};

const CATEGORY_TO_CWE: Record<string, string[]> = {
  ...STRIDE_TO_CWE,
  ...OTHER_METHODOLOGY_TO_CWE,
};

/**
 * Canonical names for every id in the CWE maps above.
 *
 * These were already in this file — as trailing comments on the ids above,
 * readable by humans and invisible to the prompt. When the component-type CWE
 * lookup misses (CWE_BY_COMPONENT covers 5 of the 14 component types), the
 * fallback below emitted `{ id, name: id }`, which the prompt rendered as
 * "CWE-287: CWE-287" — a reference section that looks like data and carries no
 * meaning, while the system prompt demands citations by exact id and forbids
 * inventing them.
 *
 * Derived from the comments, so the two cannot drift.
 */
const CWE_NAMES: Record<string, string> = {
  "CWE-287": "Improper Authentication",
  "CWE-384": "Session Fixation",
  "CWE-307": "Brute Force",
  "CWE-290": "Authentication Bypass by Spoofing",
  "CWE-295": "Improper Certificate Validation",
  "CWE-346": "Origin Validation Error",
  "CWE-20": "Improper Input Validation",
  "CWE-89": "SQL Injection",
  "CWE-79": "Cross-site Scripting",
  "CWE-94": "Code Injection",
  "CWE-352": "CSRF",
  "CWE-345": "Insufficient Verification of Data Authenticity",
  "CWE-778": "Insufficient Logging",
  "CWE-223": "Omission of Security-relevant Information",
  "CWE-532": "Log Injection",
  "CWE-779": "Logging of Excessive Data",
  "CWE-200": "Exposure of Sensitive Information",
  "CWE-312": "Cleartext Storage of Sensitive Information",
  "CWE-319": "Cleartext Transmission of Sensitive Information",
  "CWE-209": "Error Message Information Leak",
  "CWE-311": "Missing Encryption of Sensitive Data",
  "CWE-400": "Uncontrolled Resource Consumption",
  "CWE-770": "Allocation Without Limits",
  "CWE-834": "Excessive Iteration",
  "CWE-407": "Algorithmic Complexity",
  "CWE-410": "Insufficient Resource Pool",
  "CWE-269": "Improper Privilege Management",
  "CWE-862": "Missing Authorization",
  "CWE-863": "Incorrect Authorization",
  "CWE-639": "IDOR",
  "CWE-918": "SSRF",
  "CWE-250": "Execution with Unnecessary Privileges",
  "CWE-840": "Business Logic Errors",
  "CWE-841": "Improper Enforcement of Behavioral Workflow",
  "CWE-362": "Race Condition",
  "CWE-78": "OS Command Injection",
  "CWE-1104": "Use of Unmaintained Third Party Components",
  "CWE-829": "Inclusion of Functionality from Untrusted Control Sphere",
  "CWE-494": "Download of Code Without Integrity Check",
  "CWE-16": "Configuration",
  "CWE-1188": "Insecure Default Initialization of Resource",
  "CWE-732": "Incorrect Permission Assignment for Critical Resource",
  "CWE-284": "Improper Access Control",
  "CWE-538":
    "Insertion of Sensitive Information into Externally-Accessible File",
  "CWE-434": "Unrestricted Upload of Dangerous File Type",
  "CWE-787": "Out-of-bounds Write",
  "CWE-506": "Embedded Malicious Code",
  "CWE-285": "Improper Authorization",
  "CWE-798": "Use of Hard-coded Credentials",
  "CWE-306": "Missing Authentication for Critical Function",
  "CWE-502": "Deserialization of Untrusted Data",
  "CWE-77": "Command Injection",
  "CWE-321": "Use of Hard-coded Cryptographic Key",
  "CWE-117": "Improper Output Neutralization for Logs",
  "CWE-693": "Protection Mechanism Failure",
  "CWE-522": "Insufficiently Protected Credentials",
  "CWE-257": "Storing Passwords in a Recoverable Format",
  "CWE-201": "Insertion of Sensitive Information Into Sent Data",
  "CWE-754": "Improper Check for Unusual or Exceptional Conditions",
};

// ---------------------------------------------------------------------------
// STRIDE → OWASP Top 10 mapping
// ---------------------------------------------------------------------------

const STRIDE_TO_OWASP: Record<string, string[]> = {
  SPOOFING: ["A07:2021"], // Identification and Authentication Failures
  TAMPERING: ["A03:2021", "A08:2021"], // Injection, Software/Data Integrity
  REPUDIATION: ["A09:2021"], // Security Logging and Monitoring Failures
  INFORMATION_DISCLOSURE: ["A02:2021", "A01:2021"], // Crypto Failures, Broken Access Control
  DENIAL_OF_SERVICE: ["A05:2021", "A06:2021"], // Security Misconfiguration, Vulnerable Components
  ELEVATION_OF_PRIVILEGE: ["A01:2021", "A04:2021"], // Broken Access Control, Insecure Design
};

// PASTA, kill-chain and MITRE-keyed categories (not covered by the STRIDE maps).
const OTHER_METHODOLOGY_TO_OWASP: Record<string, string[]> = {
  BUSINESS_LOGIC: ["A04:2021"],
  DATA_EXPOSURE: ["A02:2021", "A01:2021"],
  ACCESS_CONTROL: ["A01:2021", "A07:2021"],
  INJECTION: ["A03:2021"],
  SUPPLY_CHAIN: ["A06:2021", "A08:2021"],
  INFRASTRUCTURE: ["A05:2021"],
  INSIDER_THREAT: ["A01:2021", "A09:2021"],
  AVAILABILITY: ["A05:2021", "A04:2021"],
  RECONNAISSANCE: ["A05:2021", "A01:2021"],
  DELIVERY: ["A03:2021", "A08:2021"],
  EXPLOITATION: ["A06:2021", "A03:2021"],
  INSTALLATION: ["A08:2021", "A05:2021"],
  COMMAND_AND_CONTROL: ["A10:2021", "A09:2021"],
  ACTIONS_ON_OBJECTIVES: ["A01:2021", "A02:2021"],
  INITIAL_ACCESS: ["A07:2021", "A05:2021"],
  EXECUTION: ["A03:2021", "A08:2021"],
  PERSISTENCE: ["A08:2021", "A05:2021"],
  PRIVILEGE_ESCALATION: ["A01:2021", "A04:2021"],
  DEFENSE_EVASION: ["A09:2021"],
  CREDENTIAL_ACCESS: ["A07:2021", "A02:2021"],
  DISCOVERY: ["A01:2021", "A05:2021"],
  LATERAL_MOVEMENT: ["A01:2021", "A07:2021"],
  COLLECTION: ["A01:2021", "A02:2021"],
  EXFILTRATION: ["A02:2021", "A10:2021"],
  IMPACT: ["A04:2021", "A05:2021"],
};

const CATEGORY_TO_OWASP: Record<string, string[]> = {
  ...STRIDE_TO_OWASP,
  ...OTHER_METHODOLOGY_TO_OWASP,
};

/** Fallback names so a mapped OWASP id renders even when research lacks it. */
const OWASP_NAMES: Record<string, string> = {
  "A01:2021": "Broken Access Control",
  "A02:2021": "Cryptographic Failures",
  "A03:2021": "Injection",
  "A04:2021": "Insecure Design",
  "A05:2021": "Security Misconfiguration",
  "A06:2021": "Vulnerable and Outdated Components",
  "A07:2021": "Identification and Authentication Failures",
  "A08:2021": "Software and Data Integrity Failures",
  "A09:2021": "Security Logging and Monitoring Failures",
  "A10:2021": "Server-Side Request Forgery",
};

// ---------------------------------------------------------------------------
// Component type normalization (libraries use lowercase, DB uses uppercase)
// ---------------------------------------------------------------------------

const TYPE_NORMALIZE: Record<string, string> = {
  DATABASE: "database",
  API: "api",
  API_GATEWAY: "api-gateway",
  SERVICE: "service",
  CACHE: "cache",
  QUEUE: "queue",
  EXTERNAL_USER: "external-entity",
  EXTERNAL_SYSTEM: "external-service",
  LOAD_BALANCER: "load-balancer",
  FIREWALL: "firewall",
  FILE_STORAGE: "object-storage",
  PROCESS: "process",
  FUNCTION: "serverless",
  INTERNAL_USER: "actor",
};

function normalizeType(type: string): string {
  return TYPE_NORMALIZE[type] || type.toLowerCase().replace(/_/g, "-");
}

// ---------------------------------------------------------------------------
// Main lookup function
// ---------------------------------------------------------------------------

/**
 * Look up all reference data for a specific component type + STRIDE category.
 * Returns threat templates, CWEs, OWASP entries, compliance reqs, and rule-based seeds.
 */
export function lookupCategoryReferences(
  componentType: string,
  category: string,
  research: ThreatResearch,
  ruleBasedThreats: GeneratedThreat[],
): CategoryReferenceData {
  const normalizedType = normalizeType(componentType);

  // 1. Threat templates from libraries (by component type + category)
  let templates = getThreatsForComponentAndCategory(normalizedType, category);
  // Broaden search if nothing found with exact type
  if (templates.length === 0) {
    templates = getThreatsForComponentType(normalizedType).filter(
      (t) => t.strideCategory === category,
    );
  }

  // 2. Filter CWEs relevant to this STRIDE category
  const relevantCweIds = new Set(CATEGORY_TO_CWE[category] || []);
  const cwes: CWEEntry[] = research.cwes.filter((c) =>
    relevantCweIds.has(c.id),
  );
  // If research didn't have these CWEs, add minimal entries from our map
  if (cwes.length === 0 && relevantCweIds.size > 0) {
    for (const id of [...relevantCweIds].slice(0, 3)) {
      cwes.push({
        id,
        name: CWE_NAMES[id] ?? id,
        description: CWE_NAMES[id]
          ? `${id}: ${CWE_NAMES[id]}`
          : `See ${id} in CWE database`,
      });
    }
  }

  // 3. Filter OWASP entries relevant to this category
  // Render the mapped entries even when the component-scoped research
  // list lacks them — the prompt demands OWASP citations by exact id.
  const owaspEntries: OWASPCategory[] = [];
  for (const id of CATEGORY_TO_OWASP[category] || []) {
    const fromResearch = research.owasp.find((o) => o.id === id);
    if (fromResearch) {
      owaspEntries.push(fromResearch);
    } else if (OWASP_NAMES[id]) {
      owaspEntries.push({
        id,
        name: OWASP_NAMES[id],
        description: `${id}: ${OWASP_NAMES[id]}`,
        relevance: `Commonly associated with ${category}`,
      });
    }
  }

  // 4. Compliance requirements (already component-scoped from research)
  const complianceReqs = research.complianceRequirements;

  // 5. Rule-based seeds filtered to this category
  const ruleBasedSeeds = ruleBasedThreats.filter(
    (t) => t.strideCategory === category,
  );

  return {
    threatTemplates: templates,
    cwes,
    owaspEntries,
    complianceReqs,
    ruleBasedSeeds,
  };
}
