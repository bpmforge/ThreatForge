/**
 * OWASP Essential Threats
 * Key threats from OWASP Top 10 Web, API, and Mobile.
 */
import type { CatalogThreat } from "../types";

export const owaspEssentialThreats: CatalogThreat[] = [
  // === OWASP Web Top 10 (2021) - Key items ===
  {
    id: "OWASP-WEB-A01",
    source: "BUILT_IN",
    name: "Broken Access Control",
    description:
      "Access control enforces policy such that users cannot act outside of their intended permissions.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    applicableTo: ["API", "WEB_APP", "DATABASE"],
    attackScenarios: [
      "Bypassing access control checks by modifying URL/parameters",
      "Viewing/editing other users data",
      "Accessing API without proper authentication",
    ],
    mitigations: [
      "Deny by default except for public resources",
      "Implement access control mechanisms once and re-use",
      "Log access control failures and alert admins",
    ],
    references: [
      { source: "OWASP", id: "A01:2021" },
      { source: "CWE", id: "CWE-284" },
    ],
    tags: ["owasp-top10", "access-control"],
    externalUrl: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
  },
  {
    id: "OWASP-WEB-A02",
    source: "BUILT_IN",
    name: "Cryptographic Failures",
    description:
      "Failures related to cryptography leading to exposure of sensitive data.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    applicableTo: ["API", "WEB_APP", "DATABASE", "DATA_FLOW"],
    attackScenarios: [
      "Data transmitted in clear text",
      "Old/weak cryptographic algorithms used",
      "Default/weak crypto keys",
    ],
    mitigations: [
      "Classify data and identify sensitive data",
      "Encrypt all sensitive data at rest",
      "Use TLS 1.2+ for data in transit",
    ],
    references: [
      { source: "OWASP", id: "A02:2021" },
      { source: "CWE", id: "CWE-327" },
    ],
    tags: ["owasp-top10", "cryptography"],
    externalUrl: "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/",
  },
  {
    id: "OWASP-WEB-A03",
    source: "BUILT_IN",
    name: "Injection",
    description:
      "User-supplied data is not validated, filtered, or sanitized by the application.",
    strideCategories: [
      "TAMPERING",
      "INFORMATION_DISCLOSURE",
      "ELEVATION_OF_PRIVILEGE",
    ],
    severity: "CRITICAL",
    applicableTo: ["API", "WEB_APP", "DATABASE"],
    attackScenarios: [
      "SQL injection",
      "NoSQL injection",
      "Command injection",
      "LDAP injection",
    ],
    mitigations: [
      "Use safe APIs with parameterized queries",
      "Positive server-side input validation",
      "Escape special characters",
    ],
    references: [
      { source: "OWASP", id: "A03:2021" },
      { source: "CWE", id: "CWE-89" },
    ],
    tags: ["owasp-top10", "injection"],
    externalUrl: "https://owasp.org/Top10/A03_2021-Injection/",
  },
  {
    id: "OWASP-WEB-A05",
    source: "BUILT_IN",
    name: "Security Misconfiguration",
    description:
      "Missing security hardening, improperly configured permissions, unnecessary features enabled.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    applicableTo: ["SERVER", "CONTAINER", "DATABASE", "API"],
    attackScenarios: [
      "Default accounts/passwords enabled",
      "Unnecessary features enabled",
      "Error messages reveal sensitive info",
    ],
    mitigations: [
      "Repeatable hardening process",
      "Minimal platform without unnecessary features",
      "Review configurations regularly",
    ],
    references: [
      { source: "OWASP", id: "A05:2021" },
      { source: "CWE", id: "CWE-16" },
    ],
    tags: ["owasp-top10", "configuration"],
    externalUrl: "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
  },
  {
    id: "OWASP-WEB-A07",
    source: "BUILT_IN",
    name: "Identification and Authentication Failures",
    description:
      "Confirmation of user identity, authentication, and session management is critical.",
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    applicableTo: ["WEB_APP", "API", "ACTOR"],
    attackScenarios: [
      "Credential stuffing attacks",
      "Brute force attacks",
      "Session fixation",
    ],
    mitigations: [
      "Implement multi-factor authentication",
      "Implement weak password checks",
      "Limit failed login attempts",
    ],
    references: [
      { source: "OWASP", id: "A07:2021" },
      { source: "CWE", id: "CWE-287" },
    ],
    tags: ["owasp-top10", "authentication"],
    externalUrl:
      "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/",
  },

  // === OWASP API Security Top 10 (2023) - Key items ===
  {
    id: "OWASP-API-01",
    source: "BUILT_IN",
    name: "Broken Object Level Authorization",
    description:
      "APIs expose endpoints handling object identifiers, creating attack surface for access control.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    applicableTo: ["API"],
    attackScenarios: [
      "Accessing other users objects by changing IDs",
      "Mass data extraction via IDOR",
      "Horizontal privilege escalation",
    ],
    mitigations: [
      "Implement proper authorization for every function accessing data",
      "Use random, unpredictable values as GUIDs for record IDs",
      "Write tests to evaluate authorization logic",
    ],
    references: [
      { source: "OWASP", id: "API1:2023" },
      { source: "CWE", id: "CWE-639" },
    ],
    tags: ["owasp-api", "authorization"],
    externalUrl:
      "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/",
  },
  {
    id: "OWASP-API-02",
    source: "BUILT_IN",
    name: "Broken Authentication",
    description:
      "Authentication mechanisms implemented incorrectly allow attackers to compromise authentication.",
    strideCategories: ["SPOOFING"],
    severity: "CRITICAL",
    applicableTo: ["API"],
    attackScenarios: [
      "Weak JWT implementation",
      "API keys exposed in URLs",
      "Missing authentication on endpoints",
    ],
    mitigations: [
      "Use standard authentication libraries",
      "Implement proper token validation",
      "Protect API keys and tokens",
    ],
    references: [
      { source: "OWASP", id: "API2:2023" },
      { source: "CWE", id: "CWE-287" },
    ],
    tags: ["owasp-api", "authentication"],
    externalUrl:
      "https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/",
  },
  {
    id: "OWASP-API-03",
    source: "BUILT_IN",
    name: "Broken Object Property Level Authorization",
    description:
      "APIs allow manipulation of object properties the user should not have access to.",
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    applicableTo: ["API"],
    attackScenarios: [
      "Mass assignment vulnerabilities",
      "Excessive data exposure in responses",
      "Modifying protected properties",
    ],
    mitigations: [
      "Validate and sanitize user input",
      "Avoid using generic methods for property binding",
      "Only return data necessary for the client",
    ],
    references: [
      { source: "OWASP", id: "API3:2023" },
      { source: "CWE", id: "CWE-915" },
    ],
    tags: ["owasp-api", "authorization"],
    externalUrl:
      "https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/",
  },
  {
    id: "OWASP-API-04",
    source: "BUILT_IN",
    name: "Unrestricted Resource Consumption",
    description:
      "API does not limit or restrict resources consumed by a single request.",
    strideCategories: ["DENIAL_OF_SERVICE"],
    severity: "HIGH",
    applicableTo: ["API"],
    attackScenarios: [
      "Large payload attacks",
      "Excessive queries",
      "Resource-intensive operations",
    ],
    mitigations: [
      "Implement rate limiting",
      "Limit request payload size",
      "Implement pagination",
    ],
    references: [
      { source: "OWASP", id: "API4:2023" },
      { source: "CWE", id: "CWE-770" },
    ],
    tags: ["owasp-api", "dos"],
    externalUrl:
      "https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/",
  },
  {
    id: "OWASP-API-05",
    source: "BUILT_IN",
    name: "Broken Function Level Authorization",
    description:
      "APIs rely on the client to enforce user level or admin access.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    applicableTo: ["API"],
    attackScenarios: [
      "Accessing admin endpoints as regular user",
      "Changing HTTP method to bypass checks",
      "Manipulating request to access privileged functions",
    ],
    mitigations: [
      "Deny all access by default",
      "Implement consistent authorization module",
      "Review API endpoints for function level issues",
    ],
    references: [
      { source: "OWASP", id: "API5:2023" },
      { source: "CWE", id: "CWE-285" },
    ],
    tags: ["owasp-api", "authorization"],
    externalUrl:
      "https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/",
  },

  // === OWASP Mobile Top 10 - Key items ===
  {
    id: "OWASP-MOB-M1",
    source: "BUILT_IN",
    name: "Improper Credential Usage",
    description:
      "Hardcoded credentials, insecure credential storage, or credential leakage in mobile apps.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    applicableTo: ["MOBILE_APP"],
    attackScenarios: [
      "API keys in mobile app binary",
      "Credentials stored in plaintext",
      "Credentials logged to device logs",
    ],
    mitigations: [
      "Use secure credential storage APIs",
      "Never hardcode credentials",
      "Implement certificate pinning",
    ],
    references: [
      { source: "OWASP", id: "M1:2024" },
      { source: "CWE", id: "CWE-798" },
    ],
    tags: ["owasp-mobile", "credentials"],
    externalUrl: "https://owasp.org/www-project-mobile-top-10/",
  },
  {
    id: "OWASP-MOB-M4",
    source: "BUILT_IN",
    name: "Insufficient Input/Output Validation",
    description:
      "Failure to validate input and encode output in mobile apps leads to injection attacks.",
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    applicableTo: ["MOBILE_APP", "API"],
    attackScenarios: [
      "SQL injection via mobile input",
      "XSS in webviews",
      "Path traversal attacks",
    ],
    mitigations: [
      "Validate all input from external sources",
      "Encode output appropriately",
      "Use parameterized queries",
    ],
    references: [
      { source: "OWASP", id: "M4:2024" },
      { source: "CWE", id: "CWE-20" },
    ],
    tags: ["owasp-mobile", "validation"],
    externalUrl: "https://owasp.org/www-project-mobile-top-10/",
  },
  {
    id: "OWASP-MOB-M8",
    source: "BUILT_IN",
    name: "Security Misconfiguration",
    description:
      "Mobile app security settings improperly configured leading to vulnerabilities.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "MEDIUM",
    applicableTo: ["MOBILE_APP"],
    attackScenarios: [
      "Debug mode enabled in production",
      "Backup allowed exposing data",
      "Export of sensitive components",
    ],
    mitigations: [
      "Disable debug features in production",
      "Configure proper app permissions",
      "Review security settings regularly",
    ],
    references: [
      { source: "OWASP", id: "M8:2024" },
      { source: "CWE", id: "CWE-16" },
    ],
    tags: ["owasp-mobile", "configuration"],
    externalUrl: "https://owasp.org/www-project-mobile-top-10/",
  },
];
