/**
 * OWASP Top 10 (2021) threats - Part 2 (A05-A10).
 */
import type { LibraryThreat } from "../types";

export const owaspTop10Part2Threats: LibraryThreat[] = [
  {
    id: "OWASP-A05",
    name: "Security Misconfiguration (A05:2021)",
    description:
      "Missing security hardening or improperly configured permissions.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "DATABASE", "PROCESS", "EXTERNAL_ENTITY"],
    attackScenarios: [
      "Unnecessary features enabled (ports, services, pages)",
      "Default accounts/passwords unchanged",
      "Error handling reveals stack traces",
      "Security settings in frameworks not set to secure values",
      "Missing security headers",
    ],
    suggestedMitigations: [
      "Implement repeatable hardening process",
      "Remove unnecessary features, components, documentation",
      "Review and update configurations as part of patch management",
      "Use segmented application architecture",
      "Send security directives to clients (Security Headers)",
    ],
    references: ["OWASP A05:2021", "CWE-16", "CWE-611"],
  },
  {
    id: "OWASP-A06",
    name: "Vulnerable Components (A06:2021)",
    description: "Using components with known vulnerabilities.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "PROCESS"],
    attackScenarios: [
      "Running outdated or vulnerable library versions",
      "Not knowing versions of all dependencies",
      "Using unsupported or unmaintained software",
      "Not scanning for vulnerabilities regularly",
    ],
    suggestedMitigations: [
      "Remove unused dependencies and features",
      "Continuously inventory component versions (SBOM)",
      "Monitor CVE databases for vulnerabilities",
      "Only obtain components from official sources over secure links",
      "Monitor for unmaintained libraries without security patches",
    ],
    references: ["OWASP A06:2021", "CWE-1035", "CWE-1104"],
  },
  {
    id: "OWASP-A07",
    name: "Auth Failures (A07:2021)",
    description:
      "Broken authentication allowing attackers to compromise credentials.",
    strideCategories: ["SPOOFING"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API", "WEB_APP", "ACTOR"],
    attackScenarios: [
      "Credential stuffing with known breached passwords",
      "Brute force attacks on default/weak passwords",
      "Session fixation attacks",
      "Missing or ineffective multi-factor authentication",
      "Session IDs exposed in URL",
    ],
    suggestedMitigations: [
      "Implement multi-factor authentication",
      "Do not ship with default credentials",
      "Check passwords against top 10000 worst passwords",
      "Align password policies with NIST 800-63b",
      "Limit failed login attempts with progressive delays",
      "Use server-side secure session manager",
    ],
    references: ["OWASP A07:2021", "CWE-287", "CWE-384"],
  },
  {
    id: "OWASP-A08",
    name: "Software/Data Integrity Failures (A08:2021)",
    description: "Code and infrastructure without integrity verification.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "PROCESS", "DATA_FLOW"],
    attackScenarios: [
      "Using plugins/libraries from untrusted sources",
      "Insecure CI/CD pipeline allowing unauthorized code",
      "Auto-update without sufficient integrity verification",
      "Insecure deserialization of untrusted data",
    ],
    suggestedMitigations: [
      "Use digital signatures to verify software/data from expected source",
      "Ensure libraries from trusted repositories",
      "Use software supply chain security tool (OWASP Dependency-Check)",
      "Ensure CI/CD pipeline has proper segregation and access control",
      "Ensure unsigned/unencrypted serialized data not sent to untrusted clients",
    ],
    references: ["OWASP A08:2021", "CWE-494", "CWE-502", "CWE-829"],
  },
  {
    id: "OWASP-A09",
    name: "Logging/Monitoring Failures (A09:2021)",
    description:
      "Insufficient logging and monitoring enabling undetected attacks.",
    strideCategories: ["REPUDIATION"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "WEB_APP", "DATABASE", "PROCESS"],
    attackScenarios: [
      "Auditable events not logged (logins, failed logins, transactions)",
      "Warnings and errors generate no or unclear log messages",
      "Logs not monitored for suspicious activity",
      "Logs only stored locally",
      "No alerting thresholds or response escalation",
    ],
    suggestedMitigations: [
      "Log all login, access control, and server-side validation failures",
      "Generate logs in format easily consumed by log management solutions",
      "Ensure high-value transactions have audit trail with integrity controls",
      "Establish effective monitoring and alerting",
      "Establish incident response and recovery plan",
    ],
    references: ["OWASP A09:2021", "CWE-117", "CWE-223", "CWE-778"],
  },
  {
    id: "OWASP-A10",
    name: "SSRF (A10:2021)",
    description:
      "Server-Side Request Forgery when fetching remote resources without validation.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "PROCESS"],
    attackScenarios: [
      "Accessing internal services behind firewall via web app",
      "Reading local files via file:// protocol",
      "Scanning internal ports using server as proxy",
      "Accessing cloud metadata services (169.254.169.254)",
    ],
    suggestedMitigations: [
      "Segment remote resource access in separate networks",
      "Enforce deny-by-default firewall policies",
      "Sanitize and validate all client-supplied input data",
      "Do not send raw responses to clients",
      "Disable HTTP redirections",
      "Use allowlist for URL schemas, ports, and destinations",
    ],
    references: ["OWASP A10:2021", "CWE-918"],
  },
];
