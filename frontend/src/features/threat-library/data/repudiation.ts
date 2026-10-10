/**
 * Repudiation threats - denying actions without proof.
 */
import type { LibraryThreat } from "../types";

export const repudiationThreats: LibraryThreat[] = [
  {
    id: "R001",
    name: "Insufficient Logging",
    description:
      "Lack of audit trails allows users to deny performing actions.",
    strideCategories: ["REPUDIATION"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "WEB_APP", "DATABASE", "PROCESS"],
    attackScenarios: [
      "User denies making unauthorized transaction",
      "Admin denies modifying critical configuration",
    ],
    suggestedMitigations: [
      "Implement comprehensive audit logging",
      "Log user identity, timestamp, action, and outcome",
      "Store logs in tamper-proof storage",
    ],
    references: ["CWE-778", "OWASP A09:2021"],
  },
  {
    id: "R002",
    name: "Log Tampering",
    description:
      "Attacker modifies or deletes logs to hide malicious activity.",
    strideCategories: ["REPUDIATION"],
    defaultSeverity: "HIGH",
    applicableTo: ["FILE_SYSTEM", "DATABASE", "PROCESS"],
    attackScenarios: [
      "Attacker with shell access deletes log entries",
      "Insider modifies logs to cover tracks",
    ],
    suggestedMitigations: [
      "Use append-only log storage",
      "Ship logs to remote SIEM immediately",
      "Implement log integrity verification",
    ],
    references: ["CWE-117"],
  },
  {
    id: "R003",
    name: "Missing Digital Signatures",
    description:
      "Lack of cryptographic signatures on transactions allows denial of authorship.",
    strideCategories: ["REPUDIATION"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "PROCESS", "DATA_FLOW"],
    attackScenarios: [
      "User denies signing a contract",
      "Service denies sending a particular message",
    ],
    suggestedMitigations: [
      "Implement digital signatures for critical operations",
      "Use non-repudiation protocols",
      "Timestamp signed operations",
    ],
    references: ["CWE-354"],
  },
  {
    id: "R004",
    name: "Weak Authentication Logging",
    description:
      "Failed to log authentication events prevents tracing unauthorized access.",
    strideCategories: ["REPUDIATION"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["WEB_APP", "API", "ACTOR"],
    attackScenarios: [
      "Attacker denies logging in from suspicious location",
      "Cannot prove when account was compromised",
    ],
    suggestedMitigations: [
      "Log all login attempts with IP and user agent",
      "Log password resets and MFA changes",
      "Alert on suspicious authentication patterns",
    ],
    references: ["CWE-778", "OWASP A09:2021"],
  },
];
