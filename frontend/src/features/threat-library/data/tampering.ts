/**
 * Tampering threats - unauthorized data modification.
 */
import type { LibraryThreat } from "../types";

export const tamperingThreats: LibraryThreat[] = [
  {
    id: "T001",
    name: "SQL Injection",
    description:
      "Attacker injects malicious SQL to modify database queries, potentially altering or deleting data.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["DATABASE", "API", "WEB_APP", "PROCESS"],
    attackScenarios: [
      "Union-based injection extracts or modifies data",
      "Blind SQL injection infers data through timing",
    ],
    suggestedMitigations: [
      "Use parameterized queries/prepared statements",
      "Implement input validation and sanitization",
      "Apply principle of least privilege to DB accounts",
    ],
    references: ["CWE-89", "OWASP A03:2021"],
  },
  {
    id: "T002",
    name: "Cross-Site Scripting (XSS)",
    description:
      "Attacker injects malicious scripts that execute in users browsers to modify page content.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "HIGH",
    applicableTo: ["WEB_APP", "API"],
    attackScenarios: [
      "Stored XSS persists in database and affects all users",
      "Reflected XSS via malicious URL parameters",
    ],
    suggestedMitigations: [
      "Encode output based on context (HTML, JS, URL)",
      "Implement Content Security Policy (CSP)",
      "Use modern frameworks with auto-escaping",
    ],
    references: ["CWE-79", "OWASP A03:2021"],
  },
  {
    id: "T003",
    name: "Parameter Tampering",
    description:
      "Attacker modifies request parameters to bypass validation or access unauthorized resources.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "WEB_APP", "PROCESS"],
    attackScenarios: [
      "Modify hidden form fields to change prices",
      "Alter query parameters to access other users data",
    ],
    suggestedMitigations: [
      "Validate all input server-side",
      "Use signed tokens for sensitive parameters",
      "Implement proper authorization checks",
    ],
    references: ["CWE-472", "OWASP A01:2021"],
  },
  {
    id: "T004",
    name: "Message Queue Poisoning",
    description:
      "Attacker injects malicious messages into queues to manipulate downstream processing.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "HIGH",
    applicableTo: ["QUEUE", "PROCESS"],
    attackScenarios: [
      "Inject commands through message content",
      "Modify message headers to redirect processing",
    ],
    suggestedMitigations: [
      "Validate and sanitize all message content",
      "Sign messages to ensure integrity",
      "Implement message authentication",
    ],
    references: ["CWE-94"],
  },
  {
    id: "T005",
    name: "Cache Poisoning",
    description:
      "Attacker manipulates cached content to serve malicious data to other users.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "HIGH",
    applicableTo: ["CACHE", "WEB_APP", "API"],
    attackScenarios: [
      "Web cache deception stores sensitive responses",
      "DNS cache poisoning redirects traffic",
    ],
    suggestedMitigations: [
      "Use cache keys that include all relevant parameters",
      "Set appropriate cache headers",
      "Validate cached content integrity",
    ],
    references: ["CWE-444"],
  },
];
