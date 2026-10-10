/**
 * NIST SP 800-171 Rev 2 — Protecting Controlled Unclassified Information
 *
 * Based on NIST SP 800-171 Revision 2 (February 2020).
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "NIST_800_171" as const;

export const NIST_800_171_CATEGORIES: ControlCategory[] = [
  {
    id: "3.1",
    name: "Access Control",
    description:
      "Limit system access to authorized users, processes, and devices and to the types of transactions and functions that authorized users are permitted to execute.",
    controls: [],
  },
  {
    id: "3.2",
    name: "Awareness & Training",
    description:
      "Ensure that managers, systems administrators, and users are aware of security risks associated with their activities.",
    controls: [],
  },
  {
    id: "3.3",
    name: "Audit & Accountability",
    description:
      "Create and retain system audit logs and records to the extent needed to enable the monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity.",
    controls: [],
  },
  {
    id: "3.4",
    name: "Configuration Management",
    description:
      "Establish and maintain baseline configurations and inventories of organizational systems and enforce security configuration settings.",
    controls: [],
  },
  {
    id: "3.5",
    name: "Identification & Authentication",
    description:
      "Identify system users, processes acting on behalf of users, and devices and authenticate their identities before allowing access.",
    controls: [],
  },
  {
    id: "3.6",
    name: "Incident Response",
    description:
      "Establish an operational incident-handling capability for organizational systems that includes preparation, detection, analysis, containment, recovery, and user response activities.",
    controls: [],
  },
  {
    id: "3.7",
    name: "Maintenance",
    description:
      "Perform maintenance on organizational systems and provide controls on tools, techniques, mechanisms, and personnel.",
    controls: [],
  },
  {
    id: "3.8",
    name: "Media Protection",
    description:
      "Protect system media containing CUI, both paper and digital, and limit access to CUI on system media to authorized users.",
    controls: [],
  },
  {
    id: "3.9",
    name: "Personnel Security",
    description:
      "Screen individuals prior to authorizing access to organizational systems containing CUI and ensure CUI is protected during and after personnel actions.",
    controls: [],
  },
  {
    id: "3.10",
    name: "Physical Protection",
    description:
      "Limit physical access to organizational systems, equipment, and the respective operating environments to authorized individuals.",
    controls: [],
  },
  {
    id: "3.11",
    name: "Risk Assessment",
    description:
      "Periodically assess the risk to organizational operations, organizational assets, and individuals, resulting from the operation of organizational systems and the associated processing, storage, or transmission of CUI.",
    controls: [],
  },
  {
    id: "3.12",
    name: "Security Assessment",
    description:
      "Periodically assess the security controls in organizational systems to determine if the controls are effective in their application.",
    controls: [],
  },
  {
    id: "3.13",
    name: "System & Comm Protection",
    description:
      "Monitor, control, and protect communications at the external boundaries and key internal boundaries of organizational systems.",
    controls: [],
  },
  {
    id: "3.14",
    name: "System & Info Integrity",
    description:
      "Identify, report, and correct information and information system flaws in a timely manner and provide protection from malicious code at appropriate locations.",
    controls: [],
  },
];

export const NIST_800_171_CONTROLS: ComplianceControl[] = [
  // 3.1 — Access Control
  {
    id: "3.1.1",
    name: "Authorized System Access",
    description:
      "Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).",
    category: "3.1",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "access control",
      "authorized users",
      "least privilege",
      "authentication",
    ],
    severity: "HIGH",
  },
  {
    id: "3.1.2",
    name: "Authorized Transaction Control",
    description:
      "Limit system access to the types of transactions and functions that authorized users are permitted to execute.",
    category: "3.1",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "RBAC",
      "role-based access",
      "permissions",
      "least privilege",
      "authorization",
    ],
    severity: "HIGH",
  },
  {
    id: "3.1.5",
    name: "Least Privilege",
    description:
      "Employ the principle of least privilege, including for specific security functions and privileged accounts.",
    category: "3.1",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "least privilege",
      "minimum necessary",
      "privileged accounts",
      "need to know",
    ],
    severity: "HIGH",
  },
  {
    id: "3.1.12",
    name: "Remote Access Monitoring",
    description: "Monitor and control remote access sessions.",
    category: "3.1",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "remote access",
      "VPN",
      "remote monitoring",
      "session monitoring",
    ],
    severity: "HIGH",
  },
  {
    id: "3.1.13",
    name: "Remote Access Cryptography",
    description:
      "Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.",
    category: "3.1",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: ["remote access encryption", "VPN", "TLS", "SSH", "cryptography"],
    severity: "HIGH",
  },
  {
    id: "3.1.20",
    name: "External System Connections",
    description:
      "Verify and control/limit connections to external information systems.",
    category: "3.1",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "external connections",
      "third-party access",
      "interconnection",
      "network boundary",
    ],
    severity: "HIGH",
  },

  // 3.2 — Awareness & Training
  {
    id: "3.2.1",
    name: "Security Awareness",
    description:
      "Ensure that managers, systems administrators, and users are aware of the security risks associated with their activities.",
    category: "3.2",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "security awareness",
      "training program",
      "user education",
      "phishing",
    ],
    severity: "MEDIUM",
  },
  {
    id: "3.2.2",
    name: "Role-Based Security Training",
    description:
      "Ensure that personnel are trained to carry out their assigned information security responsibilities.",
    category: "3.2",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "role-based training",
      "security training",
      "privileged user training",
    ],
    severity: "MEDIUM",
  },
  {
    id: "3.2.3",
    name: "Insider Threat Awareness",
    description:
      "Provide security awareness training on recognizing and reporting potential indicators of insider threat.",
    category: "3.2",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure"],
    keywords: [
      "insider threat",
      "behavioral indicators",
      "threat reporting",
      "anomalous behavior",
    ],
    severity: "HIGH",
  },

  // 3.3 — Audit & Accountability
  {
    id: "3.3.1",
    name: "Audit Log Creation",
    description:
      "Create and retain system audit logs and records to enable monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity.",
    category: "3.3",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: ["audit logs", "logging", "log retention", "audit trail"],
    severity: "HIGH",
  },
  {
    id: "3.3.2",
    name: "User Accountability",
    description:
      "Ensure that the actions of individual system users can be traced to those users.",
    category: "3.3",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "accountability",
      "user tracing",
      "non-repudiation",
      "audit trail",
    ],
    severity: "HIGH",
  },
  {
    id: "3.3.5",
    name: "Audit Correlation",
    description:
      "Correlate audit record review, analysis, and reporting processes for investigation and response to indications of unlawful, unauthorized, suspicious, or unusual activity.",
    category: "3.3",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "tampering"],
    keywords: [
      "log correlation",
      "SIEM",
      "audit analysis",
      "incident investigation",
    ],
    severity: "MEDIUM",
  },
  {
    id: "3.3.7",
    name: "Authoritative Time Source",
    description:
      "Provide a system capability that compares and synchronizes internal system clocks with an authoritative source.",
    category: "3.3",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "NTP",
      "time synchronization",
      "clock synchronization",
      "audit timestamps",
    ],
    severity: "MEDIUM",
  },

  // 3.4 — Configuration Management
  {
    id: "3.4.1",
    name: "Baseline Configurations",
    description:
      "Establish and maintain baseline configurations and inventories of organizational systems.",
    category: "3.4",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "baseline configuration",
      "configuration inventory",
      "asset inventory",
      "CMDB",
    ],
    severity: "HIGH",
  },
  {
    id: "3.4.2",
    name: "Security Configuration Enforcement",
    description:
      "Establish and enforce security configuration settings for information technology products employed in organizational systems.",
    category: "3.4",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "security hardening",
      "CIS benchmarks",
      "STIG",
      "configuration enforcement",
    ],
    severity: "HIGH",
  },
  {
    id: "3.4.6",
    name: "Least Functionality",
    description:
      "Employ the principle of least functionality by configuring organizational systems to provide only essential capabilities.",
    category: "3.4",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "least functionality",
      "disable services",
      "attack surface",
      "unnecessary functions",
    ],
    severity: "MEDIUM",
  },
  {
    id: "3.4.9",
    name: "User-Installed Software",
    description: "Control and monitor user-installed software.",
    category: "3.4",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "software policy",
      "application control",
      "unauthorized software",
      "whitelisting",
    ],
    severity: "MEDIUM",
  },

  // 3.5 — Identification & Authentication
  {
    id: "3.5.1",
    name: "Identify Users and Devices",
    description:
      "Identify system users, processes acting on behalf of users, and devices.",
    category: "3.5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "user identification",
      "device identification",
      "identity management",
      "account management",
    ],
    severity: "HIGH",
  },
  {
    id: "3.5.2",
    name: "Authenticate Users and Devices",
    description:
      "Authenticate (or verify) the identities of those users, processes, or devices, as a prerequisite to allowing access to organizational systems.",
    category: "3.5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "authentication",
      "identity verification",
      "credentials",
      "login",
    ],
    severity: "HIGH",
  },
  {
    id: "3.5.3",
    name: "Multi-Factor Authentication",
    description:
      "Use multi-factor authentication for local and network access to privileged accounts and for network access to non-privileged accounts.",
    category: "3.5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "MFA",
      "multi-factor authentication",
      "2FA",
      "authenticator app",
      "hardware token",
    ],
    severity: "CRITICAL",
  },
  {
    id: "3.5.7",
    name: "Password Complexity",
    description:
      "Enforce a minimum password complexity and change requirements when passwords are used as authentication.",
    category: "3.5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "password policy",
      "password complexity",
      "password length",
      "password rotation",
    ],
    severity: "HIGH",
  },

  // 3.6 — Incident Response
  {
    id: "3.6.1",
    name: "Incident Response Capability",
    description:
      "Establish an operational incident-handling capability for organizational systems that includes preparation, detection, analysis, containment, recovery, and user response activities.",
    category: "3.6",
    framework: FRAMEWORK,
    strideCategories: ["denial", "informationDisclosure"],
    keywords: [
      "incident response",
      "IR capability",
      "CSIRT",
      "incident handling",
    ],
    severity: "HIGH",
  },
  {
    id: "3.6.2",
    name: "Incident Reporting",
    description:
      "Track, document, and report incidents to designated officials and/or authorities both internal and external to the organization.",
    category: "3.6",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "incident reporting",
      "breach notification",
      "documentation",
      "regulatory reporting",
    ],
    severity: "HIGH",
  },
  {
    id: "3.6.3",
    name: "Incident Response Testing",
    description: "Test the organizational incident response capability.",
    category: "3.6",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "IR testing",
      "tabletop exercise",
      "simulation",
      "incident drill",
      "red team",
    ],
    severity: "MEDIUM",
  },

  // 3.7 — Maintenance
  {
    id: "3.7.1",
    name: "Maintenance Procedures",
    description: "Perform maintenance on organizational systems.",
    category: "3.7",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "system maintenance",
      "patch management",
      "updates",
      "maintenance schedule",
    ],
    severity: "MEDIUM",
  },
  {
    id: "3.7.5",
    name: "Multifactor Authentication for Maintenance",
    description:
      "Require MFA to establish nonlocal maintenance sessions via external networks and terminate such connections when nonlocal maintenance is complete.",
    category: "3.7",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "remote maintenance",
      "MFA",
      "privileged access",
      "maintenance sessions",
    ],
    severity: "HIGH",
  },

  // 3.8 — Media Protection
  {
    id: "3.8.1",
    name: "Media Access Control",
    description: "Protect system media containing CUI, both paper and digital.",
    category: "3.8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["media protection", "CUI", "physical media", "digital media"],
    severity: "HIGH",
  },
  {
    id: "3.8.3",
    name: "Media Sanitization",
    description:
      "Sanitize or destroy information system media before disposal or reuse.",
    category: "3.8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media sanitization",
      "data destruction",
      "secure erase",
      "degauss",
      "shredding",
    ],
    severity: "HIGH",
  },
  {
    id: "3.8.9",
    name: "Backup CUI Protection",
    description:
      "Protect the confidentiality of backup CUI at storage locations.",
    category: "3.8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "backup encryption",
      "backup protection",
      "data backup",
      "CUI backup",
    ],
    severity: "HIGH",
  },

  // 3.9 — Personnel Security
  {
    id: "3.9.1",
    name: "Personnel Screening",
    description:
      "Screen individuals prior to authorizing access to organizational systems containing CUI.",
    category: "3.9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "elevationOfPrivilege"],
    keywords: [
      "background check",
      "personnel screening",
      "vetting",
      "clearance",
    ],
    severity: "HIGH",
  },
  {
    id: "3.9.2",
    name: "Personnel Termination and Transfer",
    description:
      "Ensure that CUI is protected during and after personnel actions such as terminations and transfers.",
    category: "3.9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "offboarding",
      "termination",
      "access revocation",
      "transfer procedures",
    ],
    severity: "HIGH",
  },

  // 3.10 — Physical Protection
  {
    id: "3.10.1",
    name: "Physical Access Limits",
    description:
      "Limit physical access to organizational systems, equipment, and the respective operating environments to authorized individuals.",
    category: "3.10",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "physical access",
      "badge access",
      "physical security",
      "facility access",
    ],
    severity: "HIGH",
  },
  {
    id: "3.10.3",
    name: "Visitor Management",
    description: "Escort visitors and monitor visitor activity.",
    category: "3.10",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "visitor escort",
      "visitor log",
      "visitor management",
      "physical security",
    ],
    severity: "MEDIUM",
  },
  {
    id: "3.10.6",
    name: "Alternate Work Sites",
    description:
      "Enforce safeguarding measures for CUI at alternate work sites.",
    category: "3.10",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["remote work", "work from home", "alternate site", "telework"],
    severity: "MEDIUM",
  },

  // 3.11 — Risk Assessment
  {
    id: "3.11.1",
    name: "Risk Assessments",
    description:
      "Periodically assess the risk to organizational operations, assets, and individuals, resulting from the operation of organizational systems.",
    category: "3.11",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "repudiation",
      "informationDisclosure",
      "denial",
      "elevationOfPrivilege",
    ],
    keywords: [
      "risk assessment",
      "risk analysis",
      "periodic assessment",
      "threat assessment",
    ],
    severity: "HIGH",
  },
  {
    id: "3.11.2",
    name: "Vulnerability Scanning",
    description:
      "Scan for vulnerabilities in organizational systems and applications periodically and when new vulnerabilities affecting those systems are identified.",
    category: "3.11",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "vulnerability scanning",
      "CVE",
      "CVSS",
      "security scanner",
      "penetration testing",
    ],
    severity: "HIGH",
  },
  {
    id: "3.11.3",
    name: "Vulnerability Remediation",
    description:
      "Remediate vulnerabilities in accordance with risk assessments.",
    category: "3.11",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "vulnerability remediation",
      "patching",
      "risk-based remediation",
      "remediation timeline",
    ],
    severity: "HIGH",
  },

  // 3.12 — Security Assessment
  {
    id: "3.12.1",
    name: "Security Control Assessments",
    description:
      "Periodically assess the security controls in organizational systems to determine if the controls are effective in their application.",
    category: "3.12",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "repudiation",
      "informationDisclosure",
      "denial",
      "elevationOfPrivilege",
    ],
    keywords: [
      "security assessment",
      "control testing",
      "audit",
      "control effectiveness",
    ],
    severity: "HIGH",
  },
  {
    id: "3.12.2",
    name: "Plan of Action",
    description:
      "Develop and implement plans of action designed to correct deficiencies and reduce or eliminate vulnerabilities in organizational systems.",
    category: "3.12",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "POA&M",
      "remediation plan",
      "corrective action",
      "deficiency tracking",
    ],
    severity: "MEDIUM",
  },
  {
    id: "3.12.4",
    name: "System Security Plan",
    description:
      "Develop, document, and periodically update system security plans that describe system boundaries, environments, and implemented security requirements.",
    category: "3.12",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "repudiation",
      "informationDisclosure",
      "denial",
      "elevationOfPrivilege",
    ],
    keywords: [
      "system security plan",
      "SSP",
      "documentation",
      "security boundaries",
    ],
    severity: "MEDIUM",
  },

  // 3.13 — System & Comm Protection
  {
    id: "3.13.1",
    name: "Boundary Protection",
    description:
      "Monitor, control, and protect communications at the external boundaries and key internal boundaries of organizational systems.",
    category: "3.13",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "firewall",
      "network boundary",
      "DMZ",
      "perimeter",
      "network monitoring",
    ],
    severity: "HIGH",
  },
  {
    id: "3.13.8",
    name: "Data in Transit Protection",
    description:
      "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission unless otherwise protected by alternative physical safeguards.",
    category: "3.13",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "encryption",
      "TLS",
      "HTTPS",
      "data in transit",
      "secure channel",
    ],
    severity: "CRITICAL",
  },
  {
    id: "3.13.10",
    name: "Cryptographic Key Management",
    description:
      "Establish and manage cryptographic keys when cryptography is employed within organizational systems.",
    category: "3.13",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "key management",
      "PKI",
      "cryptographic keys",
      "key rotation",
      "HSM",
    ],
    severity: "HIGH",
  },
  {
    id: "3.13.16",
    name: "Data at Rest Protection",
    description: "Protect the confidentiality of CUI at rest.",
    category: "3.13",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "encryption at rest",
      "data at rest",
      "storage encryption",
      "disk encryption",
    ],
    severity: "HIGH",
  },

  // 3.14 — System & Info Integrity
  {
    id: "3.14.1",
    name: "Flaw Remediation",
    description:
      "Identify, report, and correct information and information system flaws in a timely manner.",
    category: "3.14",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "patch management",
      "vulnerability patching",
      "flaw remediation",
      "security updates",
    ],
    severity: "HIGH",
  },
  {
    id: "3.14.2",
    name: "Malicious Code Protection",
    description:
      "Provide protection from malicious code at appropriate locations within organizational information systems.",
    category: "3.14",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: ["antivirus", "malware protection", "endpoint protection", "EDR"],
    severity: "HIGH",
  },
  {
    id: "3.14.6",
    name: "Security Alert Monitoring",
    description:
      "Monitor organizational systems, including inbound and outbound communications traffic, to detect attacks and indicators of potential attacks.",
    category: "3.14",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: [
      "network monitoring",
      "IDS",
      "IPS",
      "security alerts",
      "traffic analysis",
    ],
    severity: "HIGH",
  },
  {
    id: "3.14.7",
    name: "Unauthorized Use Detection",
    description: "Identify unauthorized use of organizational systems.",
    category: "3.14",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "unauthorized access",
      "anomaly detection",
      "behavioral analytics",
      "UEBA",
    ],
    severity: "HIGH",
  },
];

// Populate categories with their controls
NIST_800_171_CATEGORIES.forEach((category) => {
  category.controls = NIST_800_171_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});
