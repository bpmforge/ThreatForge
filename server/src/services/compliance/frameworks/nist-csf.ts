/**
 * NIST Cybersecurity Framework (CSF)
 *
 * Based on NIST CSF 2.0 (2024).
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "NIST_CSF" as const;

export const NIST_CSF_CATEGORIES: ControlCategory[] = [
  {
    id: "GOVERN",
    name: "Govern (GV)",
    description:
      "Establish and monitor organization cybersecurity risk management strategy, expectations, and policy.",
    controls: [],
  },
  {
    id: "IDENTIFY",
    name: "Identify (ID)",
    description:
      "Understand organizational cybersecurity risk to systems, assets, data, and capabilities.",
    controls: [],
  },
  {
    id: "PROTECT",
    name: "Protect (PR)",
    description:
      "Implement appropriate safeguards to ensure delivery of critical services.",
    controls: [],
  },
  {
    id: "DETECT",
    name: "Detect (DE)",
    description:
      "Implement appropriate activities to identify occurrence of a cybersecurity event.",
    controls: [],
  },
  {
    id: "RESPOND",
    name: "Respond (RS)",
    description: "Take action regarding a detected cybersecurity event.",
    controls: [],
  },
  {
    id: "RECOVER",
    name: "Recover (RC)",
    description:
      "Maintain plans for resilience and restore capabilities impaired by a cybersecurity event.",
    controls: [],
  },
];

export const NIST_CSF_CONTROLS: ComplianceControl[] = [
  // IDENTIFY
  {
    id: "ID.AM-1",
    name: "Asset Inventory",
    description: "Physical devices and systems are inventoried.",
    category: "IDENTIFY",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["inventory", "asset management", "CMDB", "discovery"],
    severity: "MEDIUM",
  },
  {
    id: "ID.AM-2",
    name: "Software Inventory",
    description: "Software platforms and applications are inventoried.",
    category: "IDENTIFY",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: ["software inventory", "application catalog", "SBOM"],
    severity: "MEDIUM",
  },
  {
    id: "ID.RA-1",
    name: "Vulnerability Identification",
    description: "Asset vulnerabilities are identified and documented.",
    category: "IDENTIFY",
    framework: FRAMEWORK,
    strideCategories: [
      "tampering",
      "elevationOfPrivilege",
      "informationDisclosure",
    ],
    keywords: ["vulnerability", "scanning", "assessment", "CVE", "weakness"],
    severity: "HIGH",
  },
  {
    id: "ID.RA-2",
    name: "Threat Intelligence",
    description:
      "Cyber threat intelligence is received from information sharing forums.",
    category: "IDENTIFY",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "denial"],
    keywords: [
      "threat intelligence",
      "IOC",
      "threat feed",
      "information sharing",
    ],
    severity: "MEDIUM",
  },
  {
    id: "ID.RA-3",
    name: "Threat Identification",
    description:
      "Threats, both internal and external, are identified and documented.",
    category: "IDENTIFY",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "repudiation",
      "informationDisclosure",
      "denial",
      "elevationOfPrivilege",
    ],
    keywords: ["threat modeling", "threat assessment", "risk identification"],
    severity: "HIGH",
  },
  // PROTECT
  {
    id: "PR.AC-1",
    name: "Identity Management",
    description:
      "Identities and credentials are issued, managed, verified, revoked, and audited.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: ["identity", "IAM", "credential", "authentication", "directory"],
    severity: "HIGH",
  },
  {
    id: "PR.AC-3",
    name: "Remote Access Management",
    description: "Remote access is managed.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: ["remote access", "VPN", "SSH", "RDP", "jump host", "bastion"],
    severity: "HIGH",
  },
  {
    id: "PR.AC-4",
    name: "Access Permissions",
    description:
      "Access permissions and authorizations are managed, incorporating least privilege.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "informationDisclosure"],
    keywords: [
      "RBAC",
      "least privilege",
      "authorization",
      "permissions",
      "access control",
    ],
    severity: "HIGH",
  },
  {
    id: "PR.AC-5",
    name: "Network Integrity",
    description: "Network integrity is protected.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "network segmentation",
      "firewall",
      "zero trust",
      "microsegmentation",
    ],
    severity: "HIGH",
  },
  {
    id: "PR.DS-1",
    name: "Data-at-Rest Protection",
    description: "Data-at-rest is protected.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "encryption at rest",
      "disk encryption",
      "database encryption",
      "data protection",
    ],
    severity: "HIGH",
  },
  {
    id: "PR.DS-2",
    name: "Data-in-Transit Protection",
    description: "Data-in-transit is protected.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: ["TLS", "encryption in transit", "HTTPS", "secure channel"],
    severity: "HIGH",
  },
  {
    id: "PR.DS-5",
    name: "Data Leakage Protection",
    description: "Protections against data leaks are implemented.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["DLP", "data loss prevention", "exfiltration", "data leak"],
    severity: "HIGH",
  },
  {
    id: "PR.IP-1",
    name: "Security Configuration",
    description: "Baseline configurations are created and maintained.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "hardening",
      "baseline",
      "configuration",
      "CIS benchmark",
      "STIG",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PR.IP-3",
    name: "Configuration Change Control",
    description: "Configuration change control processes are in place.",
    category: "PROTECT",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: ["change control", "change management", "version control", "git"],
    severity: "MEDIUM",
  },
  // DETECT
  {
    id: "DE.AE-1",
    name: "Network Baseline",
    description:
      "A baseline of network operations and expected data flows is established.",
    category: "DETECT",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: ["baseline", "network monitoring", "traffic analysis", "netflow"],
    severity: "MEDIUM",
  },
  {
    id: "DE.CM-1",
    name: "Network Monitoring",
    description:
      "The network is monitored to detect potential cybersecurity events.",
    category: "DETECT",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure", "denial"],
    keywords: ["network monitoring", "IDS", "IPS", "NDR", "packet capture"],
    severity: "HIGH",
  },
  {
    id: "DE.CM-4",
    name: "Malicious Code Detection",
    description: "Malicious code is detected.",
    category: "DETECT",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: ["antivirus", "malware detection", "EDR", "sandbox"],
    severity: "HIGH",
  },
  {
    id: "DE.CM-7",
    name: "Unauthorized Activity Monitoring",
    description:
      "Monitoring for unauthorized personnel, connections, devices, and software is performed.",
    category: "DETECT",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "elevationOfPrivilege"],
    keywords: ["unauthorized", "rogue", "shadow IT", "anomaly"],
    severity: "HIGH",
  },
  // RESPOND
  {
    id: "RS.RP-1",
    name: "Incident Response Plan",
    description: "Response plan is executed during or after an incident.",
    category: "RESPOND",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: ["incident response", "IR plan", "playbook", "runbook"],
    severity: "HIGH",
  },
  {
    id: "RS.AN-1",
    name: "Incident Investigation",
    description: "Notifications from detection systems are investigated.",
    category: "RESPOND",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: ["investigation", "forensics", "analysis", "triage"],
    severity: "HIGH",
  },
  {
    id: "RS.MI-1",
    name: "Incident Containment",
    description: "Incidents are contained.",
    category: "RESPOND",
    framework: FRAMEWORK,
    strideCategories: ["denial", "informationDisclosure"],
    keywords: ["containment", "isolation", "quarantine", "block"],
    severity: "HIGH",
  },
  {
    id: "RS.MI-2",
    name: "Incident Mitigation",
    description: "Incidents are mitigated.",
    category: "RESPOND",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: ["mitigation", "remediation", "eradication", "patching"],
    severity: "HIGH",
  },
  // RECOVER
  {
    id: "RC.RP-1",
    name: "Recovery Planning",
    description:
      "Recovery plan is executed during or after a cybersecurity incident.",
    category: "RECOVER",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: ["recovery", "restore", "backup", "disaster recovery", "BCP"],
    severity: "HIGH",
  },
  {
    id: "RC.IM-1",
    name: "Recovery Improvements",
    description: "Recovery plans incorporate lessons learned.",
    category: "RECOVER",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "lessons learned",
      "post-mortem",
      "improvement",
      "retrospective",
    ],
    severity: "MEDIUM",
  },
];

// Populate categories with their controls
NIST_CSF_CATEGORIES.forEach((category) => {
  category.controls = NIST_CSF_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});
