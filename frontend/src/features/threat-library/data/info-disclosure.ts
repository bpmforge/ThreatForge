/**
 * Information Disclosure threats - unauthorized data exposure.
 */
import type { LibraryThreat } from "../types";

export const infoDisclosureThreats: LibraryThreat[] = [
  {
    id: "I001",
    name: "Data Breach",
    description:
      "Unauthorized access to sensitive data stored in databases or file systems.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["DATABASE", "FILE_SYSTEM", "DATA_STORE"],
    attackScenarios: [
      "SQL injection extracts entire database",
      "Misconfigured cloud storage exposes files",
    ],
    suggestedMitigations: [
      "Encrypt data at rest",
      "Implement field-level encryption for PII",
      "Apply principle of least privilege",
    ],
    references: ["CWE-200", "OWASP A01:2021"],
  },
  {
    id: "I002",
    name: "Sensitive Data in Logs",
    description: "Passwords, tokens, or PII accidentally logged and exposed.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "PROCESS"],
    attackScenarios: [
      "Passwords logged in plaintext during debugging",
      "API keys exposed in error messages",
    ],
    suggestedMitigations: [
      "Implement log sanitization",
      "Never log credentials or tokens",
      "Use structured logging with sensitive field masking",
    ],
    references: ["CWE-532", "OWASP A09:2021"],
  },
  {
    id: "I003",
    name: "Insecure Direct Object Reference (IDOR)",
    description:
      "Attacker accesses other users data by manipulating object identifiers.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP"],
    attackScenarios: [
      "Change user_id parameter to view other profiles",
      "Enumerate document IDs to access files",
    ],
    suggestedMitigations: [
      "Implement authorization checks on every request",
      "Use indirect references (UUIDs) instead of sequential IDs",
      "Validate user ownership of requested resources",
    ],
    references: ["CWE-639", "OWASP A01:2021"],
  },
  {
    id: "I004",
    name: "Information Leakage in Errors",
    description:
      "Detailed error messages reveal system internals to attackers.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "WEB_APP", "DATABASE"],
    attackScenarios: [
      "Stack traces reveal file paths and versions",
      "Database errors expose schema information",
    ],
    suggestedMitigations: [
      "Return generic error messages to users",
      "Log detailed errors server-side only",
      "Implement custom error pages",
    ],
    references: ["CWE-209", "OWASP A05:2021"],
  },
  {
    id: "I005",
    name: "Unencrypted Data in Transit",
    description:
      "Sensitive data transmitted without encryption can be intercepted.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["DATA_FLOW", "API", "WEB_APP"],
    attackScenarios: [
      "Network sniffer captures plaintext credentials",
      "Internal service communication intercepted",
    ],
    suggestedMitigations: [
      "Enforce TLS 1.2+ for all connections",
      "Implement HSTS headers",
      "Use mTLS for service-to-service communication",
    ],
    references: ["CWE-319", "OWASP A02:2021"],
  },
];
