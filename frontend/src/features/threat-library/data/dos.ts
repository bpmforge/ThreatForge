/**
 * Denial of Service threats - availability attacks.
 */
import type { LibraryThreat } from "../types";

export const dosThreats: LibraryThreat[] = [
  {
    id: "D001",
    name: "DDoS Attack",
    description:
      "Distributed attack overwhelms service with traffic, causing unavailability.",
    strideCategories: ["DENIAL_OF_SERVICE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "WEB_APP", "EXTERNAL_ENTITY"],
    attackScenarios: [
      "Botnet floods service with requests",
      "Amplification attack using DNS or NTP",
    ],
    suggestedMitigations: [
      "Use CDN with DDoS protection",
      "Implement rate limiting",
      "Deploy auto-scaling infrastructure",
    ],
    references: ["CWE-400"],
  },
  {
    id: "D002",
    name: "Resource Exhaustion",
    description:
      "Attacker consumes server resources (CPU, memory, disk) causing service degradation.",
    strideCategories: ["DENIAL_OF_SERVICE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "PROCESS", "DATABASE"],
    attackScenarios: [
      "Complex regex causes ReDoS",
      "Large file upload exhausts disk space",
      "Memory leak exploitation",
    ],
    suggestedMitigations: [
      "Set resource limits and quotas",
      "Implement request size limits",
      "Use timeout controls",
    ],
    references: ["CWE-400", "CWE-770"],
  },
  {
    id: "D003",
    name: "Application-Layer DoS",
    description:
      "Targeted attacks on expensive operations cause service slowdown.",
    strideCategories: ["DENIAL_OF_SERVICE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "WEB_APP", "DATABASE"],
    attackScenarios: [
      "Repeated expensive search queries",
      "Triggering heavy background jobs",
    ],
    suggestedMitigations: [
      "Rate limit expensive operations",
      "Implement query complexity limits",
      "Use caching for expensive computations",
    ],
    references: ["CWE-400"],
  },
  {
    id: "D004",
    name: "Queue Flooding",
    description:
      "Overwhelming message queues causes backlog and processing delays.",
    strideCategories: ["DENIAL_OF_SERVICE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["QUEUE", "PROCESS"],
    attackScenarios: [
      "Rapid message submission overwhelms workers",
      "Large messages consume queue storage",
    ],
    suggestedMitigations: [
      "Implement queue depth limits",
      "Set message size limits",
      "Use dead letter queues for failed processing",
    ],
    references: ["CWE-400"],
  },
  {
    id: "D005",
    name: "Database Connection Exhaustion",
    description:
      "Exhausting database connection pool denies service to legitimate requests.",
    strideCategories: ["DENIAL_OF_SERVICE"],
    defaultSeverity: "HIGH",
    applicableTo: ["DATABASE", "API", "PROCESS"],
    attackScenarios: [
      "Slow queries hold connections open",
      "Connection leak in application code",
    ],
    suggestedMitigations: [
      "Configure connection pool limits",
      "Implement query timeouts",
      "Monitor and alert on connection usage",
    ],
    references: ["CWE-400"],
  },
];
