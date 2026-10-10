/**
 * OWASP API Security Top 10 (2023) - Part 2 (API6-API10).
 */
import type { LibraryThreat } from "../types";

export const owaspApiPart2Threats: LibraryThreat[] = [
  {
    id: "API-6",
    name: "Unrestricted Access to Sensitive Flows (API6:2023)",
    description:
      "APIs exposing business flows without considering harm from excessive access.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP"],
    attackScenarios: [
      "Automated purchasing of limited items (scalping)",
      "High-frequency trading manipulation",
      "Automated comment/review spam",
      "Reservation abuse through mass bookings",
    ],
    suggestedMitigations: [
      "Identify business flows that could harm business if overused",
      "Implement device fingerprinting",
      "Use CAPTCHA or bot detection",
      "Block IPs from Tor exit nodes or known proxies",
      "Implement non-linear rate limiting",
    ],
    references: ["OWASP API6:2023", "CWE-799"],
  },
  {
    id: "API-7",
    name: "Server Side Request Forgery (API7:2023)",
    description:
      "SSRF when API fetches remote resources without validating user-supplied URI.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "PROCESS"],
    attackScenarios: [
      "Using API to probe internal networks",
      "Accessing cloud metadata endpoints",
      "Reading local files through file:// protocol",
      "Bypassing firewalls via the application server",
    ],
    suggestedMitigations: [
      "Isolate resource fetching in separate network",
      "Use allowlists for permitted remote origins",
      "Disable HTTP redirects",
      "Use a well-tested URL parser",
      "Do not return raw responses to clients",
    ],
    references: ["OWASP API7:2023", "CWE-918"],
  },
  {
    id: "API-8",
    name: "Security Misconfiguration (API8:2023)",
    description:
      "API and supporting systems not properly configured for security.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "PROCESS", "EXTERNAL_ENTITY"],
    attackScenarios: [
      "Missing TLS or weak cipher suites",
      "Verbose error messages exposing internals",
      "Unnecessary HTTP methods enabled",
      "Missing security headers (CORS misconfiguration)",
      "Permissive CORS policy",
    ],
    suggestedMitigations: [
      "Implement repeatable hardening process",
      "Review cloud service permissions",
      "Automate configuration effectiveness testing",
      "Use API gateways for consistent configuration",
      "Define and enforce CORS policies",
    ],
    references: ["OWASP API8:2023", "CWE-16"],
  },
  {
    id: "API-9",
    name: "Improper Inventory Management (API9:2023)",
    description: "Unmanaged API versions and endpoints creating security gaps.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "EXTERNAL_ENTITY"],
    attackScenarios: [
      "Old unpatched API versions still accessible",
      "Debug endpoints exposed in production",
      "Undocumented admin endpoints",
      "Forgotten or shadow APIs",
    ],
    suggestedMitigations: [
      "Inventory all API hosts and document them",
      "Document all aspects of each API version",
      "Generate documentation automatically (OpenAPI)",
      "Retire old API versions properly",
      "Require authentication for all APIs including internal ones",
    ],
    references: ["OWASP API9:2023", "CWE-1059"],
  },
  {
    id: "API-10",
    name: "Unsafe Consumption of APIs (API10:2023)",
    description:
      "Trusting data from third-party APIs without proper validation.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "PROCESS", "DATA_FLOW"],
    attackScenarios: [
      "Following redirects from third-party APIs blindly",
      "Not validating/sanitizing third-party API responses",
      "Not limiting resources for third-party integrations",
      "Not using TLS for third-party API communication",
    ],
    suggestedMitigations: [
      "Evaluate third-party API security posture",
      "Ensure all API interactions use TLS",
      "Validate and sanitize data from third-party APIs",
      "Maintain allowlist of known redirect locations",
      "Do not follow redirects blindly",
    ],
    references: ["OWASP API10:2023", "CWE-20"],
  },
];
