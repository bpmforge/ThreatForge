/**
 * NIST SP 800-53 Rev 5 — Security and Privacy Controls
 *
 * Based on NIST Special Publication 800-53 Revision 5,
 * "Security and Privacy Controls for Information Systems and Organizations."
 * Covers key control families relevant to threat modeling.
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "NIST_800_53" as const;

export const NIST_800_53_CATEGORIES: ControlCategory[] = [
  {
    id: "AC",
    name: "Access Control",
    description:
      "Policy and mechanisms for controlling access to information systems and resources.",
    controls: [],
  },
  {
    id: "AU",
    name: "Audit and Accountability",
    description:
      "Mechanisms for creating, protecting, and retaining audit records.",
    controls: [],
  },
  {
    id: "CA",
    name: "Assessment, Authorization, and Monitoring",
    description:
      "Security assessment, system authorization, and continuous monitoring.",
    controls: [],
  },
  {
    id: "CM",
    name: "Configuration Management",
    description:
      "Baseline configurations and inventory of information systems.",
    controls: [],
  },
  {
    id: "IA",
    name: "Identification and Authentication",
    description:
      "Identifying and authenticating users, devices, and processes.",
    controls: [],
  },
  {
    id: "IR",
    name: "Incident Response",
    description:
      "Incident handling, monitoring, reporting, and response assistance.",
    controls: [],
  },
  {
    id: "MP",
    name: "Media Protection",
    description:
      "Protection of digital and non-digital media containing federal information.",
    controls: [],
  },
  {
    id: "PE",
    name: "Physical and Environmental Protection",
    description:
      "Physical access controls and environmental safeguards for facilities and systems.",
    controls: [],
  },
  {
    id: "RA",
    name: "Risk Assessment",
    description:
      "Assessing risk to organizational operations, assets, individuals, and other organizations.",
    controls: [],
  },
  {
    id: "SA",
    name: "System and Services Acquisition",
    description:
      "Allocation of resources, system development lifecycle, and supply chain risk management.",
    controls: [],
  },
  {
    id: "SC",
    name: "System and Communications Protection",
    description:
      "Boundary protection, cryptographic mechanisms, and transmission confidentiality.",
    controls: [],
  },
  {
    id: "SI",
    name: "System and Information Integrity",
    description:
      "Flaw remediation, malicious code protection, and system monitoring.",
    controls: [],
  },
];

export const NIST_800_53_CONTROLS: ComplianceControl[] = [
  // ── AC: Access Control ──────────────────────────────────────
  {
    id: "AC-1",
    name: "Policy and Procedures",
    description:
      "Develop, document, and disseminate access control policy and procedures.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "access control policy",
      "federal policy",
      "agency policy",
      "FISMA",
      "authorization",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AC-2",
    name: "Account Management",
    description:
      "Define and manage information system accounts including establishing, activating, modifying, reviewing, disabling, and removing accounts.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "account management",
      "provisioning",
      "deprovisioning",
      "user account",
      "service account",
      "government account",
    ],
    severity: "HIGH",
  },
  {
    id: "AC-3",
    name: "Access Enforcement",
    description:
      "Enforce approved authorizations for logical access to information and system resources.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "access enforcement",
      "RBAC",
      "ABAC",
      "mandatory access control",
      "discretionary access control",
      "authorization",
    ],
    severity: "HIGH",
  },
  {
    id: "AC-4",
    name: "Information Flow Enforcement",
    description:
      "Enforce approved authorizations for controlling the flow of information within the system and between systems.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "information flow",
      "data flow",
      "cross-domain",
      "boundary",
      "filter",
      "guard",
      "federal network",
    ],
    severity: "HIGH",
  },
  {
    id: "AC-5",
    name: "Separation of Duties",
    description:
      "Separate duties of individuals to prevent malicious activity and reduce the risk of collusion.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "tampering"],
    keywords: [
      "separation of duties",
      "SoD",
      "dual control",
      "least privilege",
      "collusion",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AC-6",
    name: "Least Privilege",
    description:
      "Employ the principle of least privilege, allowing only authorized access needed to accomplish assigned tasks.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "least privilege",
      "minimum permissions",
      "need-to-know",
      "privileged access",
      "superuser",
    ],
    severity: "HIGH",
  },
  {
    id: "AC-7",
    name: "Unsuccessful Logon Attempts",
    description:
      "Enforce a limit of consecutive invalid logon attempts within a defined time period.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "lockout",
      "brute force",
      "failed login",
      "logon attempts",
      "account lockout",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AC-11",
    name: "Device Lock",
    description:
      "Prevent access to the system by initiating a device lock after a defined period of inactivity.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "session lock",
      "screen lock",
      "inactivity timeout",
      "idle timeout",
      "device lock",
    ],
    severity: "LOW",
  },
  {
    id: "AC-14",
    name: "Permitted Actions Without Identification",
    description:
      "Identify actions that can be performed without identification or authentication.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "anonymous access",
      "unauthenticated",
      "public access",
      "permitted actions",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AC-17",
    name: "Remote Access",
    description:
      "Establish usage restrictions, configuration requirements, and connection requirements for remote access.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "remote access",
      "VPN",
      "telework",
      "remote connection",
      "government telework",
    ],
    severity: "HIGH",
  },
  {
    id: "AC-20",
    name: "Use of External Systems",
    description:
      "Establish terms and conditions for authorized use of external systems.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure", "tampering"],
    keywords: [
      "external systems",
      "BYOD",
      "cloud services",
      "third party",
      "external network",
      "FedRAMP",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AC-22",
    name: "Publicly Accessible Content",
    description:
      "Designate authorized individuals to post information onto publicly accessible systems and review content.",
    category: "AC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "public content",
      "web publishing",
      "publicly accessible",
      "information disclosure",
    ],
    severity: "LOW",
  },

  // ── AU: Audit and Accountability ────────────────────────────
  {
    id: "AU-2",
    name: "Event Logging",
    description:
      "Identify events that the system is capable of logging in support of the audit function.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "audit logging",
      "event logging",
      "audit trail",
      "log management",
      "federal logging",
    ],
    severity: "HIGH",
  },
  {
    id: "AU-3",
    name: "Content of Audit Records",
    description:
      "Ensure audit records contain sufficient information to establish what occurred, when, where, source, and outcome.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "audit content",
      "log fields",
      "timestamp",
      "event source",
      "audit record",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AU-6",
    name: "Audit Record Review, Analysis, and Reporting",
    description:
      "Review and analyze audit records for indications of inappropriate or unusual activity.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure"],
    keywords: [
      "audit review",
      "log analysis",
      "SIEM",
      "audit reporting",
      "anomaly detection",
    ],
    severity: "MEDIUM",
  },
  {
    id: "AU-8",
    name: "Time Stamps",
    description:
      "Use internal system clocks to generate time stamps for audit records.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "time stamp",
      "NTP",
      "time synchronization",
      "clock",
      "audit time",
    ],
    severity: "LOW",
  },
  {
    id: "AU-9",
    name: "Protection of Audit Information",
    description:
      "Protect audit information and audit logging tools from unauthorized access, modification, and deletion.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "repudiation"],
    keywords: [
      "audit protection",
      "log integrity",
      "tamper-proof",
      "immutable logs",
      "log storage",
    ],
    severity: "HIGH",
  },
  {
    id: "AU-12",
    name: "Audit Record Generation",
    description:
      "Provide audit record generation capability and allow authorized personnel to configure auditable events.",
    category: "AU",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "audit generation",
      "logging capability",
      "auditable events",
      "centralized logging",
    ],
    severity: "MEDIUM",
  },

  // ── CA: Assessment, Authorization, and Monitoring ───────────
  {
    id: "CA-2",
    name: "Control Assessments",
    description:
      "Assess security and privacy controls to determine effectiveness of controls.",
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
      "control assessment",
      "A&A",
      "ATO",
      "authorization to operate",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CA-3",
    name: "Information Exchange",
    description:
      "Approve and manage the exchange of information between the system and other systems using interconnection security agreements.",
    category: "CA",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "ISA",
      "MOU",
      "interconnection",
      "information exchange",
      "system interconnection",
      "federal exchange",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CA-7",
    name: "Continuous Monitoring",
    description:
      "Develop a continuous monitoring strategy and implement a continuous monitoring program.",
    category: "CA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "informationDisclosure"],
    keywords: [
      "continuous monitoring",
      "ConMon",
      "ongoing assessment",
      "security posture",
      "CDM",
    ],
    severity: "HIGH",
  },
  {
    id: "CA-8",
    name: "Penetration Testing",
    description: "Conduct penetration testing on systems or system components.",
    category: "CA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "elevationOfPrivilege"],
    keywords: [
      "penetration testing",
      "pentest",
      "red team",
      "adversarial testing",
      "ethical hacking",
    ],
    severity: "HIGH",
  },

  // ── CM: Configuration Management ────────────────────────────
  {
    id: "CM-2",
    name: "Baseline Configuration",
    description:
      "Develop, document, and maintain baseline configurations for the system.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "baseline configuration",
      "hardening",
      "STIG",
      "CIS benchmark",
      "secure configuration",
      "federal baseline",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CM-3",
    name: "Configuration Change Control",
    description:
      "Determine and document types of changes to the system that are configuration-controlled.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "change control",
      "change management",
      "CCB",
      "configuration change",
      "approval process",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CM-6",
    name: "Configuration Settings",
    description:
      "Establish and document mandatory configuration settings using the most restrictive mode consistent with operational requirements.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "configuration settings",
      "security settings",
      "hardening guide",
      "USGCB",
      "checklists",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CM-7",
    name: "Least Functionality",
    description:
      "Configure the system to provide only mission essential capabilities and prohibit or restrict specified functions, ports, protocols, and services.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["denial", "elevationOfPrivilege"],
    keywords: [
      "least functionality",
      "attack surface",
      "unnecessary services",
      "ports and protocols",
      "whitelisting",
    ],
    severity: "HIGH",
  },
  {
    id: "CM-8",
    name: "System Component Inventory",
    description:
      "Develop and document an inventory of system components that accurately reflects the system.",
    category: "CM",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "asset inventory",
      "component inventory",
      "SBOM",
      "software inventory",
      "hardware inventory",
    ],
    severity: "MEDIUM",
  },

  // ── IA: Identification and Authentication ───────────────────
  {
    id: "IA-2",
    name: "Identification and Authentication (Organizational Users)",
    description:
      "Uniquely identify and authenticate organizational users and associate that identification with processes acting on behalf of those users.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "user authentication",
      "PIV",
      "CAC",
      "multi-factor",
      "MFA",
      "HSPD-12",
      "identity proofing",
      "federal identity",
    ],
    severity: "HIGH",
  },
  {
    id: "IA-3",
    name: "Device Identification and Authentication",
    description:
      "Uniquely identify and authenticate devices before establishing a connection.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "device authentication",
      "machine identity",
      "certificate",
      "device ID",
      "802.1X",
    ],
    severity: "MEDIUM",
  },
  {
    id: "IA-4",
    name: "Identifier Management",
    description:
      "Manage system identifiers by receiving authorization, selecting and assigning identifiers, and preventing reuse.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "identifier management",
      "user ID",
      "identity lifecycle",
      "unique identifier",
    ],
    severity: "MEDIUM",
  },
  {
    id: "IA-5",
    name: "Authenticator Management",
    description:
      "Manage system authenticators by verifying identity, establishing initial content, and ensuring administrative procedures exist.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "password management",
      "authenticator",
      "credential management",
      "token management",
      "PKI",
      "certificate management",
    ],
    severity: "HIGH",
  },
  {
    id: "IA-6",
    name: "Authentication Feedback",
    description:
      "Obscure feedback of authentication information during the authentication process.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "password masking",
      "authentication feedback",
      "credential display",
    ],
    severity: "LOW",
  },
  {
    id: "IA-8",
    name: "Identification and Authentication (Non-Organizational Users)",
    description:
      "Uniquely identify and authenticate non-organizational users or processes acting on behalf of non-organizational users.",
    category: "IA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "external user",
      "non-organizational",
      "public user",
      "guest access",
      "federated identity",
    ],
    severity: "MEDIUM",
  },

  // ── IR: Incident Response ───────────────────────────────────
  {
    id: "IR-1",
    name: "Policy and Procedures",
    description:
      "Develop, document, and disseminate incident response policy and procedures.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "incident response policy",
      "IRP",
      "federal incident",
      "US-CERT",
      "CISA reporting",
    ],
    severity: "MEDIUM",
  },
  {
    id: "IR-4",
    name: "Incident Handling",
    description:
      "Implement an incident handling capability that includes preparation, detection, analysis, containment, eradication, and recovery.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: [
      "incident handling",
      "containment",
      "eradication",
      "recovery",
      "incident lifecycle",
    ],
    severity: "HIGH",
  },
  {
    id: "IR-5",
    name: "Incident Monitoring",
    description: "Track and document incidents on an ongoing basis.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "denial"],
    keywords: [
      "incident monitoring",
      "incident tracking",
      "incident database",
      "CISA",
      "federal incident reporting",
    ],
    severity: "MEDIUM",
  },
  {
    id: "IR-6",
    name: "Incident Reporting",
    description:
      "Require personnel to report suspected incidents to the organizational incident response capability within defined time frames.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "incident reporting",
      "US-CERT",
      "CISA",
      "breach notification",
      "federal reporting",
    ],
    severity: "MEDIUM",
  },
  {
    id: "IR-8",
    name: "Incident Response Plan",
    description:
      "Develop an incident response plan that provides a roadmap for implementing the incident response capability.",
    category: "IR",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "incident response plan",
      "IRP",
      "playbook",
      "response procedures",
      "escalation",
    ],
    severity: "MEDIUM",
  },

  // ── MP: Media Protection ────────────────────────────────────
  {
    id: "MP-2",
    name: "Media Access",
    description:
      "Restrict access to digital and non-digital media to authorized individuals.",
    category: "MP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media access",
      "removable media",
      "USB",
      "portable storage",
      "media control",
    ],
    severity: "MEDIUM",
  },
  {
    id: "MP-4",
    name: "Media Storage",
    description:
      "Physically control and securely store digital and non-digital media within controlled areas.",
    category: "MP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media storage",
      "secure storage",
      "classified storage",
      "CUI storage",
    ],
    severity: "MEDIUM",
  },
  {
    id: "MP-6",
    name: "Media Sanitization",
    description: "Sanitize system media prior to disposal, release, or reuse.",
    category: "MP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media sanitization",
      "data destruction",
      "degaussing",
      "secure wipe",
      "disposal",
    ],
    severity: "MEDIUM",
  },

  // ── PE: Physical and Environmental Protection ───────────────
  {
    id: "PE-2",
    name: "Physical Access Authorizations",
    description:
      "Develop, approve, and maintain a list of individuals with authorized access to the facility.",
    category: "PE",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "physical access",
      "badge",
      "facility access",
      "visitor",
      "escort",
      "government facility",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PE-3",
    name: "Physical Access Control",
    description:
      "Enforce physical access authorizations at entry and exit points to the facility.",
    category: "PE",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "physical security",
      "access control system",
      "mantrap",
      "guard",
      "turnstile",
      "data center access",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PE-6",
    name: "Monitoring Physical Access",
    description:
      "Monitor physical access to the facility and review physical access logs.",
    category: "PE",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "repudiation"],
    keywords: [
      "physical monitoring",
      "CCTV",
      "surveillance",
      "physical access logs",
      "video monitoring",
    ],
    severity: "LOW",
  },

  // ── RA: Risk Assessment ─────────────────────────────────────
  {
    id: "RA-2",
    name: "Security Categorization",
    description:
      "Categorize the system and information in accordance with applicable laws, policies, and standards (FIPS 199).",
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
      "security categorization",
      "FIPS 199",
      "impact level",
      "high-value asset",
      "HVA",
      "federal categorization",
    ],
    severity: "MEDIUM",
  },
  {
    id: "RA-3",
    name: "Risk Assessment",
    description:
      "Conduct risk assessments to identify threats and vulnerabilities, determine likelihood and impact, and prioritize risk responses. Includes threat modeling as a key technique.",
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
      "threat modeling",
      "vulnerability assessment",
      "threat analysis",
      "risk analysis",
      "STRIDE",
      "attack tree",
      "federal risk",
      "government risk",
    ],
    severity: "HIGH",
  },
  {
    id: "RA-5",
    name: "Vulnerability Monitoring and Scanning",
    description:
      "Monitor and scan for vulnerabilities in the system and hosted applications.",
    category: "RA",
    framework: FRAMEWORK,
    strideCategories: [
      "tampering",
      "informationDisclosure",
      "elevationOfPrivilege",
    ],
    keywords: [
      "vulnerability scanning",
      "vulnerability management",
      "CVE",
      "patch management",
      "BOD",
      "CISA KEV",
    ],
    severity: "HIGH",
  },
  {
    id: "RA-7",
    name: "Risk Response",
    description:
      "Respond to findings from security and privacy assessments, monitoring, and audits.",
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
      "risk response",
      "POA&M",
      "plan of action",
      "remediation",
      "risk acceptance",
    ],
    severity: "MEDIUM",
  },
  {
    id: "RA-9",
    name: "Criticality Analysis",
    description:
      "Identify critical system components and functions by performing a criticality analysis.",
    category: "RA",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "criticality analysis",
      "critical assets",
      "mission essential",
      "BIA",
      "impact analysis",
    ],
    severity: "MEDIUM",
  },

  // ── SA: System and Services Acquisition ─────────────────────
  {
    id: "SA-3",
    name: "System Development Life Cycle",
    description:
      "Manage the system using a system development life cycle methodology that incorporates security and privacy considerations.",
    category: "SA",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "SDLC",
      "secure development",
      "development lifecycle",
      "security engineering",
      "DevSecOps",
    ],
    severity: "MEDIUM",
  },
  {
    id: "SA-4",
    name: "Acquisition Process",
    description:
      "Include security and privacy requirements and design criteria in the acquisition contract.",
    category: "SA",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "acquisition",
      "procurement",
      "supply chain",
      "vendor security",
      "contract security",
      "federal acquisition",
    ],
    severity: "MEDIUM",
  },
  {
    id: "SA-8",
    name: "Security and Privacy Engineering Principles",
    description:
      "Apply security and privacy engineering principles in the specification, design, development, and operation of the system.",
    category: "SA",
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
      "security engineering",
      "secure by design",
      "defense in depth",
      "least privilege",
      "engineering principles",
    ],
    severity: "MEDIUM",
  },
  {
    id: "SA-9",
    name: "External System Services",
    description:
      "Require providers of external system services to comply with security requirements and employ controls.",
    category: "SA",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "external services",
      "cloud provider",
      "SaaS",
      "IaaS",
      "FedRAMP",
      "third party services",
    ],
    severity: "MEDIUM",
  },
  {
    id: "SA-11",
    name: "Developer Testing and Evaluation",
    description:
      "Require system developers to create and implement a security and privacy test plan including flaw remediation, threat modeling, and vulnerability analysis.",
    category: "SA",
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
      "developer testing",
      "security testing",
      "threat modeling",
      "SAST",
      "DAST",
      "code review",
      "flaw remediation",
      "vulnerability analysis",
    ],
    severity: "HIGH",
  },
  {
    id: "SA-15",
    name: "Development Process, Standards, and Tools",
    description:
      "Require system developers to follow a documented development process that includes threat modeling, secure coding standards, and security testing.",
    category: "SA",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "development process",
      "threat modeling",
      "secure coding",
      "development tools",
      "code analysis",
      "development standards",
    ],
    severity: "HIGH",
  },
  {
    id: "SA-17",
    name: "Developer Security and Privacy Architecture and Design",
    description:
      "Require system developers to produce design documentation that describes the security-relevant architecture.",
    category: "SA",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "informationDisclosure",
      "elevationOfPrivilege",
    ],
    keywords: [
      "security architecture",
      "design specification",
      "trust boundaries",
      "security design",
      "architecture review",
    ],
    severity: "MEDIUM",
  },

  // ── SC: System and Communications Protection ────────────────
  {
    id: "SC-5",
    name: "Denial-of-Service Protection",
    description:
      "Protect against or limit the effects of denial-of-service attacks.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "DoS",
      "DDoS",
      "denial of service",
      "rate limiting",
      "traffic filtering",
      "CDN",
    ],
    severity: "HIGH",
  },
  {
    id: "SC-7",
    name: "Boundary Protection",
    description:
      "Monitor and control communications at the external managed interfaces and at key internal boundaries.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "informationDisclosure"],
    keywords: [
      "boundary protection",
      "firewall",
      "DMZ",
      "network segmentation",
      "TIC",
      "managed interface",
    ],
    severity: "HIGH",
  },
  {
    id: "SC-8",
    name: "Transmission Confidentiality and Integrity",
    description:
      "Protect the confidentiality and integrity of transmitted information.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "encryption in transit",
      "TLS",
      "HTTPS",
      "IPsec",
      "FIPS 140",
      "transmission protection",
    ],
    severity: "HIGH",
  },
  {
    id: "SC-12",
    name: "Cryptographic Key Establishment and Management",
    description:
      "Establish and manage cryptographic keys using NIST-approved key management technology and processes.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "key management",
      "KMS",
      "PKI",
      "cryptographic keys",
      "key rotation",
      "key escrow",
    ],
    severity: "HIGH",
  },
  {
    id: "SC-13",
    name: "Cryptographic Protection",
    description: "Implement NIST-approved and FIPS-validated cryptography.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "FIPS 140",
      "cryptography",
      "encryption",
      "cryptographic module",
      "NIST approved",
      "validated cryptography",
    ],
    severity: "HIGH",
  },
  {
    id: "SC-17",
    name: "Public Key Infrastructure Certificates",
    description:
      "Issue public key certificates under an appropriate certificate policy or obtain certificates from an approved service provider.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "PKI",
      "certificate",
      "CA",
      "certificate authority",
      "X.509",
      "FPKI",
    ],
    severity: "MEDIUM",
  },
  {
    id: "SC-23",
    name: "Session Authenticity",
    description: "Protect the authenticity of communications sessions.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "session management",
      "session authenticity",
      "session hijacking",
      "session fixation",
      "CSRF",
    ],
    severity: "MEDIUM",
  },
  {
    id: "SC-28",
    name: "Protection of Information at Rest",
    description:
      "Protect the confidentiality and integrity of information at rest.",
    category: "SC",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "encryption at rest",
      "data at rest",
      "disk encryption",
      "database encryption",
      "storage encryption",
    ],
    severity: "HIGH",
  },

  // ── SI: System and Information Integrity ────────────────────
  {
    id: "SI-2",
    name: "Flaw Remediation",
    description:
      "Identify, report, and correct system flaws in a timely manner.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "patching",
      "flaw remediation",
      "vulnerability fix",
      "security update",
      "patch management",
      "BOD 22-01",
    ],
    severity: "HIGH",
  },
  {
    id: "SI-3",
    name: "Malicious Code Protection",
    description:
      "Implement malicious code protection mechanisms at system entry and exit points.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "antivirus",
      "antimalware",
      "malicious code",
      "endpoint protection",
      "EDR",
      "malware prevention",
    ],
    severity: "HIGH",
  },
  {
    id: "SI-4",
    name: "System Monitoring",
    description:
      "Monitor the system to detect attacks, unauthorized connections, and anomalous behavior.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure", "denial"],
    keywords: [
      "system monitoring",
      "IDS",
      "IPS",
      "network monitoring",
      "SIEM",
      "anomaly detection",
      "CDM",
    ],
    severity: "HIGH",
  },
  {
    id: "SI-5",
    name: "Security Alerts, Advisories, and Directives",
    description:
      "Receive system security alerts, advisories, and directives from external organizations on an ongoing basis.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "security advisory",
      "CISA alert",
      "CVE",
      "threat intelligence",
      "directive",
      "BOD",
    ],
    severity: "MEDIUM",
  },
  {
    id: "SI-7",
    name: "Software, Firmware, and Information Integrity",
    description:
      "Employ integrity verification tools to detect unauthorized changes to software, firmware, and information.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "integrity verification",
      "file integrity",
      "code signing",
      "hash verification",
      "FIM",
      "supply chain integrity",
    ],
    severity: "HIGH",
  },
  {
    id: "SI-10",
    name: "Information Input Validation",
    description: "Check the validity of information inputs to the system.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "input validation",
      "injection",
      "sanitization",
      "XSS",
      "SQL injection",
      "command injection",
    ],
    severity: "HIGH",
  },
  {
    id: "SI-12",
    name: "Information Management and Retention",
    description:
      "Manage and retain information within the system in accordance with applicable laws and policies.",
    category: "SI",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data retention",
      "records management",
      "information lifecycle",
      "data disposal",
      "NARA",
    ],
    severity: "LOW",
  },
];

// Populate categories with their controls
NIST_800_53_CATEGORIES.forEach((category) => {
  category.controls = NIST_800_53_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});
