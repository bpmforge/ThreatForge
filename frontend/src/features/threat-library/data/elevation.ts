/**
 * Elevation of Privilege threats - unauthorized capability gain.
 */
import type { LibraryThreat } from "../types";

export const elevationThreats: LibraryThreat[] = [
  {
    id: "E001",
    name: "Privilege Escalation",
    description:
      "Attacker gains higher privileges than authorized through exploitation.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API", "WEB_APP", "PROCESS", "ACTOR"],
    attackScenarios: [
      "Exploiting admin functionality accessible to regular users",
      "Role manipulation through parameter tampering",
    ],
    suggestedMitigations: [
      "Implement role-based access control (RBAC)",
      "Validate permissions server-side for every request",
      "Follow principle of least privilege",
    ],
    references: ["CWE-269", "OWASP A01:2021"],
  },
  {
    id: "E002",
    name: "Insecure Deserialization",
    description: "Malicious serialized objects execute code when deserialized.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API", "PROCESS", "QUEUE"],
    attackScenarios: [
      "Java serialization gadget chains execute arbitrary code",
      "Pickle exploitation in Python applications",
    ],
    suggestedMitigations: [
      "Avoid deserializing untrusted data",
      "Use safe serialization formats (JSON)",
      "Implement integrity checks on serialized data",
    ],
    references: ["CWE-502", "OWASP A08:2021"],
  },
  {
    id: "E003",
    name: "Command Injection",
    description:
      "Attacker executes system commands through vulnerable application.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API", "PROCESS", "WEB_APP"],
    attackScenarios: [
      "Shell metacharacters in user input",
      "Unescaped arguments to system calls",
    ],
    suggestedMitigations: [
      "Avoid calling shell commands with user input",
      "Use parameterized APIs instead of shell",
      "Whitelist allowed input values",
    ],
    references: ["CWE-78", "OWASP A03:2021"],
  },
  {
    id: "E004",
    name: "Broken Access Control",
    description:
      "Missing or inadequate access controls allow unauthorized actions.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "DATABASE"],
    attackScenarios: [
      "Accessing admin endpoints without authentication",
      "Modifying other users resources",
    ],
    suggestedMitigations: [
      "Deny by default, explicitly grant access",
      "Implement centralized access control",
      "Log and monitor access control failures",
    ],
    references: ["CWE-284", "OWASP A01:2021"],
  },
  {
    id: "E005",
    name: "Container Escape",
    description:
      "Attacker breaks out of container isolation to access host system.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["PROCESS", "EXTERNAL_ENTITY"],
    attackScenarios: [
      "Exploiting kernel vulnerabilities from container",
      "Misconfigured container with host access",
    ],
    suggestedMitigations: [
      "Keep container runtime updated",
      "Use rootless containers",
      "Implement seccomp and AppArmor profiles",
    ],
    references: ["CWE-269"],
  },
];
