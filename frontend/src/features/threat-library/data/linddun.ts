/**
 * LINDDUN privacy threat data.
 * LINDDUN: Linkability, Identifiability, Non-repudiation, Detectability,
 * Disclosure of information, Unawareness, Non-compliance.
 */
import type { LibraryThreat } from "../types";

export const linddunThreats: LibraryThreat[] = [
  // Linkability
  {
    id: "linddun-l-1",
    name: "User Behaviour Linkability",
    description:
      "Attacker correlates multiple sessions or data points to build a user profile even without direct identifiers.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["WEB_APP", "API", "MOBILE_APP", "DATABASE"],
    attackScenarios: [
      "Cross-session correlation via persistent device fingerprint",
      "Linking pseudonymous records using quasi-identifiers across services",
    ],
    suggestedMitigations: [
      "Implement unlinkable pseudonyms per session",
      "Use differential privacy on analytics exports",
      "Avoid persistent tracking identifiers",
    ],
    references: ["LINDDUN:L", "GDPR Art.5(1)(c)"],
  },
  {
    id: "linddun-l-2",
    name: "Cross-Service Identity Linkage",
    description:
      "Data shared between services enables linking records across databases to re-identify individuals.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "DATABASE", "MICROSERVICE"],
    attackScenarios: [
      "Shared customer IDs across partner APIs allow cross-service profiling",
    ],
    suggestedMitigations: [
      "Use different pseudonyms per service boundary",
      "Minimise data shared with third parties",
      "Apply anonymisation before data sharing",
    ],
    references: ["LINDDUN:L", "GDPR Art.25"],
  },

  // Identifiability
  {
    id: "linddun-i-1",
    name: "Re-identification from Quasi-Identifiers",
    description:
      "Combining non-sensitive fields (age, ZIP code, gender) allows re-identifying supposedly anonymous records.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["DATABASE", "API", "DATA_LAKE"],
    attackScenarios: [
      "Published dataset with age + ZIP + gender allows 87% re-identification (Sweeney 2000)",
    ],
    suggestedMitigations: [
      "Apply k-anonymity (k≥5) or l-diversity to published datasets",
      "Suppress or generalise quasi-identifiers",
      "Use synthetic data generation for analytics",
    ],
    references: ["LINDDUN:I", "CWE-359", "GDPR Art.4(1)"],
  },
  {
    id: "linddun-i-2",
    name: "Device Fingerprinting",
    description:
      "Browser or device attributes uniquely identify users without explicit identifiers.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["WEB_APP", "MOBILE_APP"],
    attackScenarios: [
      "Canvas fingerprint + timezone + installed fonts create a unique device identifier",
    ],
    suggestedMitigations: [
      "Minimise exposed browser attributes via permissions policy",
      "Use fingerprinting-resistant browser configurations",
      "Rotate client-side identifiers periodically",
    ],
    references: ["LINDDUN:I", "GDPR Art.4(1)"],
  },

  // Non-repudiation (privacy angle)
  {
    id: "linddun-n-1",
    name: "Excessive Audit Logging of Personal Data",
    description:
      "Audit logs contain personal data that creates a detailed activity record usable against users.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "SERVER", "DATABASE", "MICROSERVICE"],
    attackScenarios: [
      "Log files containing full request bodies with PII are subpoenaed",
      "Access logs correlate user identity with sensitive service usage",
    ],
    suggestedMitigations: [
      "Log event types and outcomes, not personal data content",
      "Apply log retention TTL and automated deletion",
      "Pseudonymise user IDs in all log entries",
    ],
    references: ["LINDDUN:NR", "GDPR Art.5(1)(e)"],
  },

  // Detectability
  {
    id: "linddun-d-1",
    name: "Presence Inference from Traffic Patterns",
    description:
      "Traffic analysis reveals whether a user accessed sensitive services even without content inspection.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["API", "WEB_APP", "VPN"],
    attackScenarios: [
      "ISP traffic analysis reveals access to healthcare or legal services",
    ],
    suggestedMitigations: [
      "Use cover traffic to mask access patterns",
      "Route traffic through anonymising proxies or Tor",
      "Batch and delay non-urgent API calls",
    ],
    references: ["LINDDUN:D"],
  },

  // Disclosure of information
  {
    id: "linddun-di-1",
    name: "API Over-Fetching Personal Data",
    description:
      "API returns more personal data than the caller needs, increasing the blast radius of any compromise.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "API_GATEWAY", "MICROSERVICE"],
    attackScenarios: [
      "GET /users/:id returns full PII when only name is needed by client",
      "Paginated list endpoint exposes email addresses in bulk",
    ],
    suggestedMitigations: [
      "Apply data minimisation: return only requested fields",
      "Use GraphQL or field-level projections",
      "Implement field-level access control per consumer scope",
    ],
    references: ["LINDDUN:DI", "OWASP API3:2023", "CWE-200"],
  },
  {
    id: "linddun-di-2",
    name: "Third-Party Script Data Exfiltration",
    description:
      "Analytics or advertising scripts included in the frontend collect and transmit personal data to third parties.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["WEB_APP", "MOBILE_APP"],
    attackScenarios: [
      "Google Tag Manager script reads form fields including health data",
      "Session-replay tools capture keystrokes and PII unintentionally",
    ],
    suggestedMitigations: [
      "Audit all third-party scripts and their data access",
      "Implement strict Content Security Policy with script-src allowlist",
      "Self-host analytics or use privacy-preserving alternatives (Plausible, Matomo)",
    ],
    references: ["LINDDUN:DI", "GDPR Art.28", "CWE-200"],
  },

  // Unawareness
  {
    id: "linddun-u-1",
    name: "Opaque Data Collection without Informed Consent",
    description:
      "Users are unaware that personal data is being collected, processed, or shared with third parties.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["WEB_APP", "MOBILE_APP", "API"],
    attackScenarios: [
      "Background location tracking without clear disclosure",
      "Behavioural profiling sold to data brokers without user knowledge",
    ],
    suggestedMitigations: [
      "Implement clear layered consent flows compliant with GDPR Art.13/14",
      "Provide a real-time data transparency dashboard",
      "Disclose purpose, legal basis, and retention period at collection",
    ],
    references: ["LINDDUN:U", "GDPR Art.13", "CCPA §1798.100"],
  },

  // Non-compliance
  {
    id: "linddun-nc-1",
    name: "Data Retained Beyond Lawful Basis",
    description:
      "Personal data is retained after the purpose for collection has expired, violating data minimisation and storage limitation principles.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["DATABASE", "DATA_LAKE", "FILE_SYSTEM"],
    attackScenarios: [
      "User account data retained years after deletion request",
      "Backup tapes with PII kept indefinitely with no purge policy",
    ],
    suggestedMitigations: [
      "Implement automated data retention TTL policies",
      "Schedule periodic deletion jobs aligned to retention schedule",
      "Document retention periods in privacy notice and enforce technically",
    ],
    references: ["LINDDUN:NC", "GDPR Art.5(1)(e)", "CWE-312"],
  },
  {
    id: "linddun-nc-2",
    name: "Cross-Border Data Transfer without Safeguards",
    description:
      "Personal data transferred to jurisdictions without adequate protection without appropriate legal mechanisms.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "DATABASE", "MICROSERVICE", "OBJECT_STORAGE"],
    attackScenarios: [
      "EU user data replicated to US S3 bucket without SCCs in place",
      "Support tool with EU user data hosted on non-adequate-country servers",
    ],
    suggestedMitigations: [
      "Execute Standard Contractual Clauses for all cross-border data transfers",
      "Map all data flows and flag cross-border transfers",
      "Use data residency controls to confine EU data to EEA infrastructure",
    ],
    references: ["LINDDUN:NC", "GDPR Chapter V", "GDPR Art.46"],
  },
];
