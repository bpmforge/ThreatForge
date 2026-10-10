/**
 * ISO 27001:2022 Information Security Management System
 *
 * Control identifiers and short control names reference ISO/IEC 27001:2022
 * Annex A purely so findings can be cross-referenced against the standard.
 *
 * All `description` text below is ThreatForge's own plain-language summary of
 * what each control is about. None of it is reproduced from, or a derivative
 * transcription of, the copyrighted text of ISO/IEC 27001. Consult the
 * standard itself for the authoritative normative wording.
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "ISO27001" as const;

export const ISO27001_CATEGORIES: ControlCategory[] = [
  {
    id: "A5",
    name: "Organizational Controls",
    description: "Policies, procedures, and organizational security measures.",
    controls: [],
  },
  {
    id: "A6",
    name: "People Controls",
    description: "Human resource security throughout employment.",
    controls: [],
  },
  {
    id: "A7",
    name: "Physical Controls",
    description: "Physical and environmental security.",
    controls: [],
  },
  {
    id: "A8",
    name: "Technological Controls",
    description: "Technology-based security controls.",
    controls: [],
  },
];

export const ISO27001_CONTROLS: ComplianceControl[] = [
  // A5 - Organizational Controls
  {
    id: "A.5.1",
    name: "Policies for Information Security",
    description:
      "Requires written, maintained information-security policies covering the organization and specific topics.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "security policy",
      "governance",
      "policy management",
      "standards",
    ],
    severity: "MEDIUM",
  },
  {
    id: "A.5.7",
    name: "Threat Intelligence",
    description:
      "Covers gathering and analyzing intelligence about the threats facing the organization.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "denial"],
    keywords: [
      "threat intelligence",
      "IOC",
      "threat feed",
      "security intelligence",
    ],
    severity: "MEDIUM",
  },
  {
    id: "A.5.15",
    name: "Access Control",
    description:
      "Expects documented rules governing who may reach systems, data, and premises.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "access control",
      "authorization",
      "access policy",
      "permissions",
    ],
    severity: "HIGH",
  },
  {
    id: "A.5.16",
    name: "Identity Management",
    description:
      "Covers managing identities end to end, from creation through change to removal.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "identity",
      "IAM",
      "lifecycle",
      "provisioning",
      "deprovisioning",
    ],
    severity: "HIGH",
  },
  {
    id: "A.5.17",
    name: "Authentication Information",
    description:
      "Covers controlled issuing, storage, and handling of credentials and authentication secrets.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: ["authentication", "password", "credential", "secret management"],
    severity: "HIGH",
  },
  {
    id: "A.5.23",
    name: "Information Security for Cloud Services",
    description:
      "Expects security to be built into how cloud services are chosen, used, and retired.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "cloud security",
      "SaaS",
      "IaaS",
      "cloud provider",
      "shared responsibility",
    ],
    severity: "HIGH",
  },
  {
    id: "A.5.24",
    name: "Incident Management Planning",
    description:
      "Requires a prepared plan for how security incidents get handled and by whom.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "incident response",
      "IR plan",
      "incident management",
      "playbook",
    ],
    severity: "HIGH",
  },
  {
    id: "A.5.29",
    name: "ICT Continuity",
    description:
      "Covers keeping technology services available so the business can continue through disruption.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: ["business continuity", "disaster recovery", "BCP", "resilience"],
    severity: "HIGH",
  },
  {
    id: "A.5.30",
    name: "ICT Readiness for Business Continuity",
    description:
      "Expects IT continuity arrangements to be planned and exercised, not merely documented.",
    category: "A5",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: ["DR testing", "recovery testing", "failover", "continuity test"],
    severity: "MEDIUM",
  },
  // A6 - People Controls
  {
    id: "A.6.3",
    name: "Information Security Awareness",
    description:
      "Covers ongoing security awareness education for staff in line with their role.",
    category: "A6",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "security awareness",
      "training",
      "phishing",
      "social engineering",
    ],
    severity: "MEDIUM",
  },
  // A7 - Physical Controls
  {
    id: "A.7.1",
    name: "Physical Security Perimeter",
    description:
      "Expects protected areas to be marked out by defined physical boundaries.",
    category: "A7",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: ["physical security", "perimeter", "data center", "facility"],
    severity: "MEDIUM",
  },
  // A8 - Technological Controls
  {
    id: "A.8.1",
    name: "User Endpoint Devices",
    description:
      "Covers safeguarding data held on laptops, phones, and other user devices.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: ["endpoint", "MDM", "device security", "laptop", "mobile"],
    severity: "HIGH",
  },
  {
    id: "A.8.2",
    name: "Privileged Access Rights",
    description:
      "Expects tight limits on who holds elevated privileges and how they get used.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: ["privileged access", "admin", "PAM", "elevated rights", "sudo"],
    severity: "CRITICAL",
  },
  {
    id: "A.8.3",
    name: "Information Access Restriction",
    description:
      "Covers limiting who can reach which information, in line with access policy.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "elevationOfPrivilege"],
    keywords: [
      "access restriction",
      "data access",
      "need to know",
      "classification",
    ],
    severity: "HIGH",
  },
  {
    id: "A.8.5",
    name: "Secure Authentication",
    description:
      "Expects login mechanisms that verify users through robust, well-implemented techniques.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "authentication",
      "MFA",
      "SSO",
      "secure login",
      "identity verification",
    ],
    severity: "HIGH",
  },
  {
    id: "A.8.9",
    name: "Configuration Management",
    description:
      "Covers keeping system and security settings defined, applied, and under change control.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "configuration",
      "hardening",
      "baseline",
      "STIG",
      "CIS benchmark",
    ],
    severity: "MEDIUM",
  },
  {
    id: "A.8.12",
    name: "Data Leakage Prevention",
    description:
      "Covers measures that stop sensitive data from leaving systems without authorization.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["DLP", "data loss prevention", "exfiltration", "data leak"],
    severity: "HIGH",
  },
  {
    id: "A.8.15",
    name: "Logging",
    description:
      "Requires activity, exception, and security-event capture in logs.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: ["logging", "audit log", "security events", "SIEM", "monitoring"],
    severity: "HIGH",
  },
  {
    id: "A.8.16",
    name: "Monitoring Activities",
    description:
      "Covers watching networks and systems for unusual behavior that may signal an attack.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "tampering", "denial"],
    keywords: ["monitoring", "SIEM", "anomaly detection", "SOC", "alerting"],
    severity: "HIGH",
  },
  {
    id: "A.8.20",
    name: "Network Security",
    description:
      "Covers protecting networks and the devices that route and filter their traffic.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "network security",
      "firewall",
      "segmentation",
      "network control",
    ],
    severity: "HIGH",
  },
  {
    id: "A.8.21",
    name: "Security of Network Services",
    description:
      "Expects the safeguards and service levels of network services to be spelled out.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: ["network service", "SLA", "managed service", "service security"],
    severity: "MEDIUM",
  },
  {
    id: "A.8.24",
    name: "Use of Cryptography",
    description:
      "Covers organization-wide guidance on where and how encryption and keys get used.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["cryptography", "encryption", "key management", "crypto policy"],
    severity: "HIGH",
  },
  {
    id: "A.8.25",
    name: "Secure Development Lifecycle",
    description:
      "Expects development to follow ground rules that build security in from the start.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: ["SDLC", "secure development", "security by design", "DevSecOps"],
    severity: "HIGH",
  },
  {
    id: "A.8.28",
    name: "Secure Coding",
    description:
      "Covers writing code against practices that avoid common vulnerability patterns.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: [
      "tampering",
      "informationDisclosure",
      "elevationOfPrivilege",
    ],
    keywords: [
      "secure coding",
      "OWASP",
      "code review",
      "SAST",
      "vulnerability",
    ],
    severity: "HIGH",
  },
  {
    id: "A.8.29",
    name: "Security Testing",
    description:
      "Expects security verification to be built into testing processes and carried out.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "security testing",
      "penetration test",
      "DAST",
      "vulnerability scan",
    ],
    severity: "HIGH",
  },
  {
    id: "A.8.31",
    name: "Separation of Environments",
    description:
      "Covers keeping build, test, and live environments apart from one another.",
    category: "A8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: ["environment separation", "dev/prod", "staging", "isolation"],
    severity: "MEDIUM",
  },
];

// Populate categories with their controls
ISO27001_CATEGORIES.forEach((category) => {
  category.controls = ISO27001_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});
