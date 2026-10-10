/**
 * CMMC 2.0 — Cybersecurity Maturity Model Certification
 *
 * Based on CMMC 2.0 Model Overview (DoD, November 2021).
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "CMMC" as const;

export const CMMC_CATEGORIES: ControlCategory[] = [
  {
    id: "AC",
    name: "Access Control",
    description:
      "Limit system access to authorized users, processes, and devices.",
    controls: [],
  },
  {
    id: "AT",
    name: "Awareness & Training",
    description:
      "Ensure personnel are aware of security risks and are trained to carry out assigned responsibilities.",
    controls: [],
  },
  {
    id: "AU",
    name: "Audit & Accountability",
    description:
      "Create and retain system audit logs to enable monitoring, analysis, and investigation.",
    controls: [],
  },
  {
    id: "CM",
    name: "Configuration Management",
    description:
      "Establish and maintain baseline configurations and inventories of organizational systems.",
    controls: [],
  },
  {
    id: "IA",
    name: "Identification & Authentication",
    description:
      "Identify system users, processes, and devices and authenticate their identities.",
    controls: [],
  },
  {
    id: "IR",
    name: "Incident Response",
    description:
      "Establish an operational incident-handling capability for organizational systems.",
    controls: [],
  },
  {
    id: "MA",
    name: "Maintenance",
    description:
      "Perform maintenance on organizational systems and provide controls on the tools and personnel.",
    controls: [],
  },
  {
    id: "MP",
    name: "Media Protection",
    description: "Protect system media containing CUI, both paper and digital.",
    controls: [],
  },
  {
    id: "PS",
    name: "Personnel Security",
    description:
      "Screen individuals prior to authorizing access and ensure CUI is protected during and after employment.",
    controls: [],
  },
  {
    id: "PE",
    name: "Physical Protection",
    description:
      "Limit physical access to organizational systems, equipment, and operating environments.",
    controls: [],
  },
  {
    id: "RA",
    name: "Risk Assessment",
    description:
      "Periodically assess the risk to operations, assets, and individuals from system operation.",
    controls: [],
  },
  {
    id: "CA",
    name: "Security Assessment",
    description:
      "Periodically assess the security controls to determine effectiveness and develop action plans.",
    controls: [],
  },
  {
    id: "SC",
    name: "System & Comm Protection",
    description:
      "Monitor, control, and protect communications at external and key internal boundaries.",
    controls: [],
  },
  {
    id: "SI",
    name: "System & Info Integrity",
    description:
      "Identify, report, and correct system flaws in a timely manner and provide protection from malicious code.",
    controls: [],
  },
];

export const CMMC_CONTROLS: ComplianceControl[] = [
  // AC — Access Control
  {
    id: "AC.1.001",
    name: "Authorized Access Control",
    description:
      "Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "access control",
      "authorization",
      "authenticated users",
      "least privilege",
    ],
    severity: "HIGH",
  },
  {
    id: "AC.1.002",
    name: "Limit Transaction Types",
    description:
      "Limit system access to the types of transactions and functions that authorized users are permitted to execute.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "role-based access",
      "RBAC",
      "least privilege",
      "permissions",
      "authorization",
    ],
    severity: "HIGH",
  },
  {
    id: "AC.2.005",
    name: "Session Lock",
    description:
      "Use session lock with pattern-hiding displays after a period of inactivity.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "session timeout",
      "session lock",
      "idle timeout",
      "screen lock",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AC.2.006",
    name: "Control Mobile Device Use",
    description:
      "Control the use of portable storage devices on system components.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: ["mobile device", "removable media", "USB", "portable storage"],
    severity: "MEDIUM",
  },
  {
    id: "AC.3.017",
    name: "Separation of Duties",
    description:
      "Separate the duties of individuals to reduce the risk of malevolent activity without collusion.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "repudiation"],
    keywords: ["separation of duties", "dual control", "segregation"],
    severity: "MEDIUM",
  },
  {
    id: "AC.3.018",
    name: "Least Privilege",
    description:
      "Employ the principle of least privilege, including for specific security functions and privileged accounts.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "least privilege",
      "minimum necessary",
      "privileged access",
      "admin accounts",
    ],
    severity: "HIGH",
  },

  // AT — Awareness & Training
  {
    id: "AT.2.056",
    name: "Security Awareness Training",
    description:
      "Ensure that personnel are aware of security risks associated with their activities.",
    category: "AT",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "security awareness",
      "training",
      "phishing awareness",
      "social engineering",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AT.2.057",
    name: "Role-Based Training",
    description:
      "Ensure that personnel are trained to carry out their assigned information security responsibilities.",
    category: "AT",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "role-based training",
      "security training",
      "security responsibilities",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AT.3.058",
    name: "Insider Threat Awareness",
    description:
      "Provide security awareness training on recognizing and reporting potential indicators of insider threat.",
    category: "AT",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure"],
    keywords: ["insider threat", "threat awareness", "behavioral indicators"],
    severity: "HIGH",
  },

  // AU — Audit & Accountability
  {
    id: "AU.2.041",
    name: "Audit Log Creation",
    description:
      "Ensure that the actions of individual system users can be traced to those users.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "audit log",
      "user activity",
      "logging",
      "traceability",
      "non-repudiation",
    ],
    severity: "HIGH",
  },
  {
    id: "AU.2.042",
    name: "Audit Log Review",
    description:
      "Create and retain audit logs for monitoring, analysis, investigation, and reporting of unlawful or unauthorized activity.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure"],
    keywords: ["log review", "log retention", "audit analysis", "SIEM"],
    severity: "HIGH",
  },
  {
    id: "AU.3.045",
    name: "Audit Log Protection",
    description:
      "Protect audit information and tools from unauthorized access, modification, and deletion.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "repudiation"],
    keywords: [
      "log integrity",
      "log protection",
      "tamper-proof logs",
      "immutable logs",
    ],
    severity: "HIGH",
  },
  {
    id: "AU.3.046",
    name: "Audit Reduction",
    description:
      "Provide audit record reduction and report generation to support analysis and reporting.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: ["log aggregation", "log correlation", "audit reports", "SIEM"],
    severity: "MEDIUM",
  },

  // CM — Configuration Management
  {
    id: "CM.2.061",
    name: "Baseline Configurations",
    description:
      "Establish and maintain baseline configurations and inventories of organizational systems.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "baseline configuration",
      "configuration management",
      "hardening",
      "CIS benchmark",
    ],
    severity: "HIGH",
  },
  {
    id: "CM.2.062",
    name: "Least Functionality",
    description:
      "Establish and enforce security configuration settings for IT products employed in organizational systems.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "least functionality",
      "disable unnecessary services",
      "attack surface reduction",
    ],
    severity: "HIGH",
  },
  {
    id: "CM.3.068",
    name: "User-Installed Software",
    description:
      "Restrict, disable, or prevent the use of nonessential programs, functions, ports, protocols, and services.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "software restriction",
      "application whitelisting",
      "unauthorized software",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CM.3.069",
    name: "Change Control",
    description: "Control and monitor user-installed software.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "change control",
      "change management",
      "software inventory",
      "patch management",
    ],
    severity: "MEDIUM",
  },

  // IA — Identification & Authentication
  {
    id: "IA.1.076",
    name: "Identify Users",
    description:
      "Identify system users, processes acting on behalf of users, and devices.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "identity",
      "user identification",
      "device identity",
      "account management",
    ],
    severity: "HIGH",
  },
  {
    id: "IA.1.077",
    name: "Authenticate Users",
    description:
      "Authenticate (or verify) the identities of those users, processes, or devices, as a prerequisite to system access.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: ["authentication", "password", "credentials", "login", "MFA"],
    severity: "HIGH",
  },
  {
    id: "IA.3.083",
    name: "Multi-Factor Authentication",
    description:
      "Use multi-factor authentication for local and network access to privileged accounts.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "MFA",
      "multi-factor authentication",
      "2FA",
      "two-factor",
      "authenticator",
    ],
    severity: "CRITICAL",
  },
  {
    id: "IA.3.084",
    name: "Password Management",
    description:
      "Employ replay-resistant authentication mechanisms for network access to privileged and non-privileged accounts.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "password policy",
      "password complexity",
      "password rotation",
      "replay attack",
    ],
    severity: "HIGH",
  },

  // IR — Incident Response
  {
    id: "IR.2.092",
    name: "Incident Response Capability",
    description:
      "Establish an operational incident-handling capability for organizational systems.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["denial", "informationDisclosure"],
    keywords: ["incident response", "IR plan", "incident handling", "CSIRT"],
    severity: "HIGH",
  },
  {
    id: "IR.2.093",
    name: "Incident Reporting",
    description:
      "Track, document, and report incidents to appropriate officials and/or authorities.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "incident reporting",
      "breach notification",
      "incident tracking",
      "documentation",
    ],
    severity: "HIGH",
  },
  {
    id: "IR.3.098",
    name: "Incident Response Testing",
    description: "Test the organizational incident response capability.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "tabletop exercise",
      "IR testing",
      "simulation",
      "incident drill",
    ],
    severity: "MEDIUM",
  },

  // MA — Maintenance
  {
    id: "MA.2.111",
    name: "Controlled Maintenance",
    description: "Perform maintenance on organizational systems.",
    category: "MA",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "maintenance",
      "patch management",
      "system updates",
      "scheduled maintenance",
    ],
    severity: "MEDIUM",
  },
  {
    id: "MA.2.112",
    name: "Remote Maintenance",
    description:
      "Provide controls on the tools, techniques, mechanisms, and personnel that conduct system maintenance.",
    category: "MA",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "spoofing"],
    keywords: [
      "remote maintenance",
      "remote access",
      "privileged access",
      "maintenance tools",
    ],
    severity: "HIGH",
  },

  // MP — Media Protection
  {
    id: "MP.1.118",
    name: "Media Access Control",
    description: "Protect system media containing CUI, both paper and digital.",
    category: "MP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media protection",
      "CUI",
      "removable media",
      "data classification",
    ],
    severity: "HIGH",
  },
  {
    id: "MP.2.120",
    name: "Media Sanitization",
    description:
      "Sanitize or destroy information system media before disposal or reuse.",
    category: "MP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media sanitization",
      "data destruction",
      "secure erasure",
      "degaussing",
    ],
    severity: "HIGH",
  },
  {
    id: "MP.3.122",
    name: "Media Transport",
    description: "Control the use of removable media on system components.",
    category: "MP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "media transport",
      "removable media",
      "encryption",
      "chain of custody",
    ],
    severity: "MEDIUM",
  },

  // PS — Personnel Security
  {
    id: "PS.2.127",
    name: "Screen Individuals",
    description:
      "Screen individuals prior to authorizing access to organizational systems.",
    category: "PS",
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
    id: "PS.2.128",
    name: "Termination Procedures",
    description:
      "Ensure that CUI is protected during and after personnel actions such as terminations and transfers.",
    category: "PS",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "offboarding",
      "termination",
      "access revocation",
      "exit procedures",
    ],
    severity: "HIGH",
  },

  // PE — Physical Protection
  {
    id: "PE.1.131",
    name: "Physical Access Limits",
    description:
      "Limit physical access to organizational systems, equipment, and the respective operating environments.",
    category: "PE",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "physical access",
      "badge access",
      "physical security",
      "data center",
    ],
    severity: "HIGH",
  },
  {
    id: "PE.1.132",
    name: "Visitor Control",
    description: "Escort visitors and monitor visitor activity.",
    category: "PE",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "visitor management",
      "escort",
      "visitor log",
      "physical security",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PE.2.135",
    name: "Physical Protection Monitoring",
    description:
      "Protect and monitor the physical facility and support infrastructure for organizational systems.",
    category: "PE",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "CCTV",
      "surveillance",
      "physical monitoring",
      "facility security",
    ],
    severity: "MEDIUM",
  },

  // RA — Risk Assessment
  {
    id: "RA.2.141",
    name: "Risk Assessments",
    description:
      "Periodically assess the risk to organizational operations, assets, and individuals.",
    category: "RA",
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
      "threat assessment",
      "vulnerability assessment",
    ],
    severity: "HIGH",
  },
  {
    id: "RA.2.142",
    name: "Vulnerability Scanning",
    description:
      "Scan for vulnerabilities in organizational systems and applications periodically.",
    category: "RA",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: ["vulnerability scanning", "penetration testing", "CVE", "CVSS"],
    severity: "HIGH",
  },
  {
    id: "RA.3.144",
    name: "Threat Intelligence",
    description:
      "Periodically perform risk assessments to determine adequacy of security controls.",
    category: "RA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: ["threat intelligence", "CTI", "threat feeds", "ISAC"],
    severity: "MEDIUM",
  },

  // CA — Security Assessment
  {
    id: "CA.2.157",
    name: "Security Control Assessment",
    description:
      "Periodically assess security controls in organizational systems to determine if the controls are effective.",
    category: "CA",
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
      "effectiveness",
    ],
    severity: "HIGH",
  },
  {
    id: "CA.2.158",
    name: "Plan of Action",
    description:
      "Develop and implement plans of action designed to correct deficiencies and reduce vulnerabilities.",
    category: "CA",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "POA&M",
      "plan of action",
      "remediation plan",
      "corrective action",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CA.3.162",
    name: "System Security Plan",
    description:
      "Develop, document, and periodically update system security plans that describe system boundaries and security controls.",
    category: "CA",
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
      "security documentation",
      "security controls",
    ],
    severity: "MEDIUM",
  },

  // SC — System & Comm Protection
  {
    id: "SC.1.175",
    name: "Boundary Protection",
    description:
      "Monitor, control, and protect communications at external boundaries and key internal boundaries.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "firewall",
      "network boundary",
      "DMZ",
      "perimeter defense",
      "network segmentation",
    ],
    severity: "HIGH",
  },
  {
    id: "SC.3.177",
    name: "Cryptographic Protection",
    description:
      "Employ FIPS-validated cryptography when used to protect the confidentiality of CUI.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: ["encryption", "FIPS", "cryptography", "TLS", "AES"],
    severity: "CRITICAL",
  },
  {
    id: "SC.3.180",
    name: "Network Access Control",
    description:
      "Employ architectural designs, software development techniques, and systems engineering principles promoting security.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "network access control",
      "NAC",
      "zero trust",
      "microsegmentation",
    ],
    severity: "HIGH",
  },
  {
    id: "SC.3.187",
    name: "Session Authenticity",
    description:
      "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "session management",
      "TLS",
      "HTTPS",
      "data in transit",
      "secure channel",
    ],
    severity: "HIGH",
  },

  // SI — System & Info Integrity
  {
    id: "SI.1.210",
    name: "Malicious Code Protection",
    description:
      "Identify, report, and correct information and information system flaws in a timely manner.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: ["antivirus", "malware protection", "endpoint security", "EDR"],
    severity: "HIGH",
  },
  {
    id: "SI.1.211",
    name: "Security Alert Monitoring",
    description:
      "Provide protection from malicious code at appropriate locations within organizational information systems.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "security alerts",
      "threat monitoring",
      "intrusion detection",
      "IDS",
    ],
    severity: "HIGH",
  },
  {
    id: "SI.2.214",
    name: "Security Alert Response",
    description:
      "Monitor organizational information systems to detect attacks and indicators of potential attacks.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: [
      "incident alerts",
      "threat response",
      "anomaly detection",
      "SIEM",
    ],
    severity: "HIGH",
  },
  {
    id: "SI.3.218",
    name: "Application Security",
    description:
      "Employ spam protection mechanisms at information system access points.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "application security",
      "input validation",
      "secure coding",
      "OWASP",
    ],
    severity: "HIGH",
  },
];

// Populate categories with their controls
CMMC_CATEGORIES.forEach((category) => {
  category.controls = CMMC_CONTROLS.filter((c) => c.category === category.id);
});
