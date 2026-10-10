/**
 * PCI DSS 4.0 (Payment Card Industry Data Security Standard)
 *
 * Applies to entities that store, process, or transmit cardholder data;
 * PCI DSS v4.0 became mandatory in March 2025.
 *
 * Requirement identifiers and short control names reference PCI DSS v4.0
 * purely so findings can be cross-referenced against the standard.
 *
 * All `description` text below is ThreatForge's own plain-language summary of
 * what each requirement is about. None of it is reproduced from, or a
 * derivative transcription of, the copyrighted text published by the PCI
 * Security Standards Council. Consult the standard itself for the
 * authoritative normative wording.
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "PCI_DSS" as const;

export const PCI_DSS_CATEGORIES: ControlCategory[] = [
  {
    id: "REQ1",
    name: "Install and Maintain Network Security Controls",
    description:
      "Filtering traffic in and out of the card environment with firewalls and similar controls.",
    controls: [],
  },
  {
    id: "REQ2",
    name: "Apply Secure Configurations",
    description:
      "Replacing insecure vendor defaults with hardened settings across system components.",
    controls: [],
  },
  {
    id: "REQ3",
    name: "Protect Stored Account Data",
    description:
      "Keeping stored card data unreadable through encryption, truncation, masking, or hashing.",
    controls: [],
  },
  {
    id: "REQ4",
    name: "Protect Cardholder Data with Strong Cryptography During Transmission",
    description:
      "Encrypting card data whenever it crosses networks the organization does not control.",
    controls: [],
  },
  {
    id: "REQ5",
    name: "Protect All Systems from Malicious Software",
    description:
      "Keeping malicious software off systems in and around the card environment.",
    controls: [],
  },
  {
    id: "REQ6",
    name: "Develop and Maintain Secure Systems and Software",
    description:
      "Finding and fixing software flaws through a disciplined build-and-release process.",
    controls: [],
  },
  {
    id: "REQ7",
    name: "Restrict Access to System Components by Business Need to Know",
    description:
      "Giving people access to card systems only where their job genuinely requires it.",
    controls: [],
  },
  {
    id: "REQ8",
    name: "Identify Users and Authenticate Access",
    description:
      "Tying every action to an identified individual and proving who they are at login.",
    controls: [],
  },
  {
    id: "REQ9",
    name: "Restrict Physical Access to Cardholder Data",
    description:
      "Keeping people physically away from card systems, media, and the rooms holding them.",
    controls: [],
  },
  {
    id: "REQ10",
    name: "Log and Monitor All Access",
    description:
      "Recording and reviewing activity so a compromise can be spotted and reconstructed.",
    controls: [],
  },
  {
    id: "REQ11",
    name: "Test Security of Systems and Networks Regularly",
    description:
      "Regularly probing systems and networks for weaknesses as the environment changes.",
    controls: [],
  },
  {
    id: "REQ12",
    name: "Support Information Security with Organizational Policies",
    description:
      "Backing the technical controls with policy, training, and program governance.",
    controls: [],
  },
];

export const PCI_DSS_CONTROLS: ComplianceControl[] = [
  // ============================================================
  // REQ1 - Install and Maintain Network Security Controls
  // ============================================================
  {
    id: "PCI-1.2.1",
    name: "NSC Configuration Standards",
    description:
      "Calls for configuration baselines for network filtering devices that are written, applied, and kept up.",
    category: "REQ1",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "firewall",
      "network security",
      "NSC",
      "firewall rules",
      "network configuration",
      "PCI scope",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-1.2.5",
    name: "Permitted Services and Ports",
    description:
      "Every open port, protocol, and service needs an approved, justified business reason.",
    category: "REQ1",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "denial"],
    keywords: [
      "ports",
      "services",
      "protocols",
      "network ports",
      "port filtering",
      "allowed services",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-1.3.1",
    name: "CDE Network Segmentation",
    description:
      "Traffic entering the card environment must be pared back to what is genuinely needed.",
    category: "REQ1",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "elevationOfPrivilege"],
    keywords: [
      "network segmentation",
      "CDE",
      "cardholder data environment",
      "DMZ",
      "network isolation",
      "PCI scope",
    ],
    severity: "CRITICAL",
  },
  {
    id: "PCI-1.4.1",
    name: "NSCs Between Trusted and Untrusted Networks",
    description:
      "Calls for filtering controls at the boundary between internal and outside networks.",
    category: "REQ1",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "network boundary",
      "perimeter",
      "trusted network",
      "untrusted network",
      "internet facing",
    ],
    severity: "HIGH",
  },

  // ============================================================
  // REQ2 - Apply Secure Configurations
  // ============================================================
  {
    id: "PCI-2.2.1",
    name: "System Configuration Standards",
    description:
      "Calls for hardening baselines that are written, rolled out, and kept current for every component.",
    category: "REQ2",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "hardening",
      "configuration standard",
      "system hardening",
      "CIS benchmark",
      "secure baseline",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-2.2.2",
    name: "Vendor Default Accounts",
    description:
      "Factory accounts must be deleted, or else re-credentialed and tightly limited in use.",
    category: "REQ2",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "default account",
      "default password",
      "vendor default",
      "default credentials",
      "factory settings",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-2.2.5",
    name: "Unnecessary Services Removed",
    description:
      "Anything not needed to run the system gets switched off to shrink the attack surface.",
    category: "REQ2",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "denial"],
    keywords: [
      "unnecessary services",
      "attack surface",
      "service hardening",
      "minimal install",
      "remove unused",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-2.2.7",
    name: "Non-Console Administrative Access Encryption",
    description:
      "Remote administrative sessions must run over strongly encrypted channels.",
    category: "REQ2",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "spoofing"],
    keywords: [
      "admin access",
      "SSH",
      "encrypted admin",
      "remote management",
      "administrative access",
    ],
    severity: "HIGH",
  },

  // ============================================================
  // REQ3 - Protect Stored Account Data
  // ============================================================
  {
    id: "PCI-3.1.1",
    name: "Data Retention Policy",
    description:
      "Stored card data must be held in the smallest amount, for the shortest time, that rules allow.",
    category: "REQ3",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data retention",
      "data minimization",
      "cardholder data",
      "card data",
      "PAN",
      "storage limitation",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-3.3.1",
    name: "SAD Not Stored After Authorization",
    description:
      "Authentication elements such as CVV, PIN, and track data must not survive the authorization.",
    category: "REQ3",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "SAD",
      "sensitive authentication data",
      "CVV",
      "CVV2",
      "CVC",
      "PIN",
      "track data",
      "magnetic stripe",
    ],
    severity: "CRITICAL",
  },
  {
    id: "PCI-3.4.1",
    name: "PAN Masked When Displayed",
    description:
      "On screen, card numbers show only leading and trailing digits unless a job need says otherwise.",
    category: "REQ3",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "PAN masking",
      "card masking",
      "data masking",
      "display masking",
      "card number display",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-3.5.1",
    name: "PAN Rendered Unreadable in Storage",
    description:
      "A stored card number has to be scrambled beyond recovery, by hashing, tokens, truncation, or a cipher.",
    category: "REQ3",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "encryption at rest",
      "tokenization",
      "PAN encryption",
      "data encryption",
      "card data encryption",
      "hashing",
    ],
    severity: "CRITICAL",
  },
  {
    id: "PCI-3.6.1",
    name: "Cryptographic Key Management",
    description:
      "Calls for documented safeguards over the keys that guard stored card data.",
    category: "REQ3",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "key management",
      "cryptographic keys",
      "KMS",
      "key rotation",
      "key storage",
      "HSM",
    ],
    severity: "CRITICAL",
  },

  // ============================================================
  // REQ4 - Protect Cardholder Data During Transmission
  // ============================================================
  {
    id: "PCI-4.2.1",
    name: "Strong Cryptography for Transmission",
    description:
      "Card numbers crossing public networks must travel inside strong encryption.",
    category: "REQ4",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "TLS",
      "SSL",
      "HTTPS",
      "encryption in transit",
      "transport encryption",
      "secure channel",
      "card data transmission",
    ],
    severity: "CRITICAL",
  },
  {
    id: "PCI-4.2.1.1",
    name: "Trusted Certificates",
    description:
      "Certificates protecting card traffic must be checked as current, valid, and not revoked.",
    category: "REQ4",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "certificate",
      "certificate validation",
      "TLS certificate",
      "PKI",
      "certificate management",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-4.2.2",
    name: "PAN Secured via End-User Messaging",
    description:
      "Card numbers sent through chat, email, or similar channels must be encrypted first.",
    category: "REQ4",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "messaging security",
      "email encryption",
      "secure messaging",
      "PAN in email",
      "card data messaging",
    ],
    severity: "HIGH",
  },

  // ============================================================
  // REQ5 - Protect All Systems from Malicious Software
  // ============================================================
  {
    id: "PCI-5.2.1",
    name: "Anti-Malware Deployed",
    description:
      "Malware defenses belong on every component not justified as being out of harm.",
    category: "REQ5",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "antivirus",
      "anti-malware",
      "malware protection",
      "endpoint protection",
      "EDR",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-5.2.3",
    name: "Anti-Malware Scans",
    description:
      "Defenses must run on a schedule and watch continuously via live or behavioral detection.",
    category: "REQ5",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "malware scanning",
      "virus scan",
      "real-time protection",
      "behavioral analysis",
      "threat detection",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-5.3.1",
    name: "Anti-Malware Kept Current",
    description:
      "Malware defenses must update themselves automatically to stay effective.",
    category: "REQ5",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "signature updates",
      "malware definitions",
      "auto update",
      "antivirus updates",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-5.4.1",
    name: "Anti-Phishing Mechanisms",
    description:
      "Calls for tooling and procedures that shield staff from phishing attempts.",
    category: "REQ5",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "phishing",
      "anti-phishing",
      "email security",
      "social engineering",
      "DMARC",
      "SPF",
    ],
    severity: "MEDIUM",
  },

  // ============================================================
  // REQ6 - Develop and Maintain Secure Systems and Software
  // ============================================================
  {
    id: "PCI-6.2.1",
    name: "Secure Development Lifecycle",
    description:
      "Custom and tailored software must be built through a defined, security-aware process.",
    category: "REQ6",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "SDLC",
      "secure development",
      "secure coding",
      "development lifecycle",
      "software security",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-6.2.4",
    name: "Software Engineering Techniques for Security",
    description:
      "Coding practices must be chosen and applied to head off well-known application attacks.",
    category: "REQ6",
    framework: FRAMEWORK,
    strideCategories: [
      "tampering",
      "elevationOfPrivilege",
      "informationDisclosure",
    ],
    keywords: [
      "injection",
      "XSS",
      "CSRF",
      "SQL injection",
      "input validation",
      "OWASP",
      "secure coding",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-6.3.1",
    name: "Security Vulnerabilities Identified and Addressed",
    description:
      "Calls for an ongoing process to find, rank, and resolve software weaknesses.",
    category: "REQ6",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "vulnerability management",
      "CVE",
      "patching",
      "security patch",
      "vulnerability scanning",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-6.3.3",
    name: "Critical Patches Installed",
    description:
      "High-risk security fixes must land within a month of becoming available.",
    category: "REQ6",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "patch management",
      "critical patch",
      "security update",
      "system update",
      "hotfix",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-6.4.1",
    name: "Public-Facing Web Application Protection",
    description:
      "Internet-exposed applications need an application firewall or comparable defense.",
    category: "REQ6",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial", "informationDisclosure"],
    keywords: [
      "WAF",
      "web application firewall",
      "web security",
      "application protection",
      "OWASP Top 10",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-6.5.1",
    name: "Change Control for System Components",
    description:
      "Production changes must move through a controlled, reviewed change process.",
    category: "REQ6",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "change management",
      "change control",
      "production changes",
      "deployment process",
      "release management",
    ],
    severity: "MEDIUM",
  },

  // ============================================================
  // REQ7 - Restrict Access by Business Need to Know
  // ============================================================
  {
    id: "PCI-7.2.1",
    name: "Access Control Model Defined",
    description:
      "Calls for a written access model built on least privilege and genuine business need.",
    category: "REQ7",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "informationDisclosure"],
    keywords: [
      "access control",
      "least privilege",
      "need to know",
      "RBAC",
      "role-based access",
      "authorization",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-7.2.2",
    name: "Access Assigned Based on Job Function",
    description:
      "Permissions must follow from the role and duties a person actually holds.",
    category: "REQ7",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "job function",
      "role assignment",
      "access assignment",
      "separation of duties",
      "user roles",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-7.2.5",
    name: "Access Reviews",
    description:
      "Rights granted to non-human accounts get re-examined on a regular cycle.",
    category: "REQ7",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "spoofing"],
    keywords: [
      "access review",
      "account review",
      "privilege review",
      "entitlement review",
      "recertification",
    ],
    severity: "MEDIUM",
  },

  // ============================================================
  // REQ8 - Identify Users and Authenticate Access
  // ============================================================
  {
    id: "PCI-8.2.1",
    name: "Unique User IDs",
    description:
      "Nobody reaches card systems without an individually assigned identifier.",
    category: "REQ8",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "repudiation"],
    keywords: [
      "unique ID",
      "user identification",
      "individual accounts",
      "no shared accounts",
      "user identity",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-8.3.1",
    name: "Strong Authentication for Users and Administrators",
    description:
      "Every user session must be backed by at least one verified authentication factor.",
    category: "REQ8",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "authentication",
      "password",
      "credentials",
      "login",
      "sign-in",
      "identity verification",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-8.3.6",
    name: "Password Complexity Requirements",
    description:
      "Any password or passphrase relied on for login has to clear a defined strength floor.",
    category: "REQ8",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "password complexity",
      "password length",
      "password strength",
      "passphrase",
      "credential policy",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-8.4.2",
    name: "MFA for CDE Access",
    description:
      "Reaching the card environment requires more than one authentication factor.",
    category: "REQ8",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "MFA",
      "multi-factor",
      "two-factor",
      "2FA",
      "CDE access",
      "strong authentication",
    ],
    severity: "CRITICAL",
  },
  {
    id: "PCI-8.6.1",
    name: "System and Application Account Management",
    description:
      "Machine accounts must be barred from interactive login unless justified, then kept limited.",
    category: "REQ8",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "service account",
      "system account",
      "application account",
      "privileged account",
      "account management",
    ],
    severity: "HIGH",
  },

  // ============================================================
  // REQ9 - Restrict Physical Access
  // ============================================================
  {
    id: "PCI-9.2.1",
    name: "Physical Access Controls to Sensitive Areas",
    description:
      "Entry to facilities holding card systems must be gated by suitable physical controls.",
    category: "REQ9",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "informationDisclosure"],
    keywords: [
      "physical access",
      "facility access",
      "data center access",
      "badge",
      "physical security",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-9.4.1",
    name: "Media Physical Security",
    description:
      "Physical media carrying card data must be kept under lock and control.",
    category: "REQ9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media security",
      "physical media",
      "backup tapes",
      "removable media",
      "media storage",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-9.4.6",
    name: "Media Destruction",
    description:
      "Once card data on paper or disk has outlived its purpose, it gets destroyed beyond recovery.",
    category: "REQ9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "media destruction",
      "data destruction",
      "secure disposal",
      "shredding",
      "degaussing",
      "media sanitization",
    ],
    severity: "HIGH",
  },

  // ============================================================
  // REQ10 - Log and Monitor All Access
  // ============================================================
  {
    id: "PCI-10.2.1",
    name: "Audit Logs Enabled",
    description:
      "Activity recording must be switched on across components handling card data.",
    category: "REQ10",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "audit log",
      "logging",
      "event logging",
      "audit trail",
      "log collection",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-10.2.1.2",
    name: "Log All Administrative Actions",
    description:
      "Everything done by people with administrative rights must land in the audit trail.",
    category: "REQ10",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "elevationOfPrivilege"],
    keywords: [
      "admin logging",
      "privileged access logging",
      "admin audit",
      "administrator actions",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-10.3.1",
    name: "Audit Log Protection",
    description:
      "The audit trail itself is readable only by the handful of roles whose duties depend on it.",
    category: "REQ10",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "repudiation"],
    keywords: [
      "log protection",
      "log integrity",
      "log access",
      "tamper-proof logs",
      "log security",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-10.4.1",
    name: "Audit Log Review",
    description:
      "Logs must be examined daily to surface anomalies or suspicious behavior.",
    category: "REQ10",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure"],
    keywords: [
      "log review",
      "log monitoring",
      "SIEM",
      "log analysis",
      "security monitoring",
      "SOC",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-10.5.1",
    name: "Audit Log Retention",
    description:
      "Keep a year of log history, with the most recent quarter available for immediate query.",
    category: "REQ10",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "log retention",
      "log storage",
      "log archive",
      "12 months",
      "log history",
    ],
    severity: "MEDIUM",
  },

  // ============================================================
  // REQ11 - Test Security Regularly
  // ============================================================
  {
    id: "PCI-11.3.1",
    name: "Internal Vulnerability Scans",
    description:
      "Internal scanning happens quarterly and again after any meaningful change.",
    category: "REQ11",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "vulnerability scan",
      "internal scan",
      "vulnerability assessment",
      "security scanning",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-11.3.2",
    name: "External Vulnerability Scans (ASV)",
    description:
      "Quarterly external scanning must be run by a scanning vendor the council approves.",
    category: "REQ11",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "ASV scan",
      "external scan",
      "approved scanning vendor",
      "external vulnerability",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-11.4.1",
    name: "Penetration Testing",
    description:
      "Penetration testing runs yearly, inside and out, and again after major changes.",
    category: "REQ11",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "elevationOfPrivilege"],
    keywords: [
      "penetration testing",
      "pen test",
      "pentest",
      "security testing",
      "ethical hacking",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-11.5.1",
    name: "Intrusion Detection / Prevention",
    description:
      "Intrusions into the network must be detected, blocked, or both.",
    category: "REQ11",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial", "informationDisclosure"],
    keywords: [
      "IDS",
      "IPS",
      "intrusion detection",
      "intrusion prevention",
      "network monitoring",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-11.6.1",
    name: "Change Detection on Payment Pages",
    description:
      "Payment pages need tamper detection that raises an alert on unauthorized changes.",
    category: "REQ11",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "payment page",
      "skimming",
      "Magecart",
      "tamper detection",
      "script integrity",
      "SRI",
      "CSP",
    ],
    severity: "CRITICAL",
  },

  // ============================================================
  // REQ12 - Support Information Security with Organizational Policies
  // ============================================================
  {
    id: "PCI-12.1.1",
    name: "Information Security Policy",
    description:
      "Calls for a top-level security policy that is published, kept current, and circulated.",
    category: "REQ12",
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
      "security policy",
      "information security policy",
      "acceptable use",
      "policy document",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-12.3.1",
    name: "Targeted Risk Analysis",
    description:
      "Where the standard lets the entity pick a frequency, a documented risk analysis must justify it.",
    category: "REQ12",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "informationDisclosure"],
    keywords: [
      "risk analysis",
      "targeted risk",
      "risk assessment",
      "PCI risk",
      "compliance risk",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-12.6.1",
    name: "Security Awareness Training",
    description:
      "Staff need a formal program teaching them the card-data rules they are expected to follow.",
    category: "REQ12",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "security training",
      "security awareness",
      "employee training",
      "phishing awareness",
      "PCI training",
    ],
    severity: "MEDIUM",
  },
  {
    id: "PCI-12.8.1",
    name: "Third-Party Service Provider Management",
    description:
      "Maintain an inventory of outside providers that touch or could affect card data.",
    category: "REQ12",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "third party",
      "service provider",
      "TPSP",
      "vendor management",
      "supply chain",
      "payment processor",
    ],
    severity: "HIGH",
  },
  {
    id: "PCI-12.10.1",
    name: "Incident Response Plan",
    description:
      "A ready-to-run response plan must exist for suspected or confirmed incidents.",
    category: "REQ12",
    framework: FRAMEWORK,
    strideCategories: ["denial", "repudiation"],
    keywords: [
      "incident response",
      "incident plan",
      "breach response",
      "security incident",
      "IR plan",
      "forensics",
    ],
    severity: "HIGH",
  },
];

// Populate categories with their controls
PCI_DSS_CATEGORIES.forEach((category) => {
  category.controls = PCI_DSS_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});
