/**
 * OWASP Top 10 (2021) threats mapped to STRIDE categories.
 */
import type { LibraryThreat } from "../types";

export const owaspTop10Threats: LibraryThreat[] = [
  {
    id: "OWASP-A01",
    name: "Broken Access Control (A01:2021)",
    description:
      "Failures in access control allowing users to act outside intended permissions.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API", "WEB_APP", "DATABASE"],
    attackScenarios: [
      "Bypassing access control by modifying URL or API requests",
      "Viewing or editing other users accounts",
      "Privilege escalation from user to admin",
      "Accessing API with missing access controls for POST, PUT, DELETE",
    ],
    suggestedMitigations: [
      "Deny access by default except for public resources",
      "Implement access control mechanisms once and reuse throughout app",
      "Enforce record ownership rather than accepting user input",
      "Disable web server directory listing",
      "Log access control failures and alert admins",
    ],
    references: ["OWASP A01:2021", "CWE-284", "CWE-285", "CWE-639"],
  },
  {
    id: "OWASP-A02",
    name: "Cryptographic Failures (A02:2021)",
    description:
      "Failures related to cryptography leading to sensitive data exposure.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "DATABASE", "DATA_FLOW"],
    attackScenarios: [
      "Transmitting data in clear text (HTTP, SMTP, FTP)",
      "Using old or weak cryptographic algorithms",
      "Using default or weak crypto keys",
      "Not enforcing encryption via security headers",
    ],
    suggestedMitigations: [
      "Classify and encrypt sensitive data at rest",
      "Use TLS 1.2+ for all data in transit",
      "Disable caching for sensitive data responses",
      "Use strong adaptive salted hashing for passwords (Argon2, bcrypt)",
      "Use authenticated encryption instead of just encryption",
    ],
    references: ["OWASP A02:2021", "CWE-259", "CWE-327", "CWE-331"],
  },
  {
    id: "OWASP-A03",
    name: "Injection (A03:2021)",
    description:
      "User-supplied data not validated/sanitized allowing hostile data injection.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API", "WEB_APP", "DATABASE", "PROCESS"],
    attackScenarios: [
      "SQL injection via unsanitized user input",
      "NoSQL injection in document databases",
      "OS command injection through shell commands",
      "LDAP injection in directory services",
      "Expression Language injection",
    ],
    suggestedMitigations: [
      "Use safe APIs that avoid interpreter entirely (parameterized queries)",
      "Use positive server-side input validation",
      "Escape special characters for remaining dynamic queries",
      "Use LIMIT and other SQL controls to prevent mass disclosure",
    ],
    references: ["OWASP A03:2021", "CWE-79", "CWE-89", "CWE-78"],
  },
  {
    id: "OWASP-A04",
    name: "Insecure Design (A04:2021)",
    description:
      "Missing or ineffective control design leading to security weaknesses.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "PROCESS", "DATA_STORE"],
    attackScenarios: [
      "Business logic flaws enabling fraud",
      "Missing rate limiting on sensitive operations",
      "Credential recovery allowing account enumeration",
      "Missing anti-automation controls",
    ],
    suggestedMitigations: [
      "Establish secure development lifecycle with AppSec professionals",
      "Use threat modeling for authentication and access control",
      "Write unit and integration tests for security controls",
      "Segregate tier layers based on exposure and protection needs",
      "Limit resource consumption by user or service",
    ],
    references: ["OWASP A04:2021", "CWE-209", "CWE-256", "CWE-501"],
  },
];
