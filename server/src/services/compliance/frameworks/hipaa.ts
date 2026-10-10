/**
 * HIPAA Security Rule (45 CFR 164.308-316)
 *
 * Based on the Health Insurance Portability and Accountability Act
 * Security Standards for the Protection of Electronic Protected Health Information.
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "HIPAA" as const;

export const HIPAA_CATEGORIES: ControlCategory[] = [
  {
    id: "ADMIN",
    name: "Administrative Safeguards (164.308)",
    description:
      "Administrative actions, policies, and procedures to manage the selection, development, implementation, and maintenance of security measures to protect ePHI.",
    controls: [],
  },
  {
    id: "PHYSICAL",
    name: "Physical Safeguards (164.310)",
    description:
      "Physical measures, policies, and procedures to protect electronic information systems and related buildings and equipment from natural and environmental hazards and unauthorized intrusion.",
    controls: [],
  },
  {
    id: "TECHNICAL",
    name: "Technical Safeguards (164.312)",
    description:
      "Technology and the policy and procedures for its use that protect ePHI and control access to it.",
    controls: [],
  },
  {
    id: "ORGANIZATIONAL",
    name: "Organizational Requirements (164.314)",
    description:
      "Requirements for business associate agreements and other organizational arrangements.",
    controls: [],
  },
  {
    id: "POLICIES",
    name: "Policies & Documentation (164.316)",
    description:
      "Requirements for policies, procedures, and documentation of security measures.",
    controls: [],
  },
];

export const HIPAA_CONTROLS: ComplianceControl[] = [
  // ============================================================
  // ADMIN - Administrative Safeguards (164.308)
  // ============================================================
  {
    id: "164.308(a)(1)(i)",
    name: "Security Management Process",
    description:
      "Implement policies and procedures to prevent, detect, contain, and correct security violations.",
    category: "ADMIN",
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
      "security management",
      "security policy",
      "security program",
      "ePHI",
      "PHI",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(1)(ii)(A)",
    name: "Risk Analysis",
    description:
      "Conduct an accurate and thorough assessment of potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI.",
    category: "ADMIN",
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
      "risk analysis",
      "risk assessment",
      "threat modeling",
      "vulnerability assessment",
      "ePHI",
      "health data",
    ],
    severity: "CRITICAL",
  },
  {
    id: "164.308(a)(1)(ii)(B)",
    name: "Risk Management",
    description:
      "Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "informationDisclosure",
      "denial",
    ],
    keywords: [
      "risk management",
      "risk mitigation",
      "security measures",
      "safeguards",
      "countermeasures",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(1)(ii)(C)",
    name: "Sanction Policy",
    description:
      "Apply appropriate sanctions against workforce members who fail to comply with security policies.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "sanction",
      "disciplinary",
      "policy violation",
      "workforce",
      "compliance enforcement",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.308(a)(1)(ii)(D)",
    name: "Information System Activity Review",
    description:
      "Implement procedures to regularly review records of information system activity such as audit logs, access reports, and security incident tracking reports.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure"],
    keywords: [
      "audit log",
      "activity review",
      "access report",
      "audit trail",
      "log review",
      "monitoring",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(3)(i)",
    name: "Workforce Security",
    description:
      "Implement policies and procedures to ensure that all members of the workforce have appropriate access to ePHI.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "workforce security",
      "employee access",
      "staff access",
      "personnel security",
      "background check",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(3)(ii)(A)",
    name: "Authorization and/or Supervision",
    description:
      "Implement procedures for the authorization and/or supervision of workforce members who work with ePHI.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "spoofing"],
    keywords: [
      "authorization",
      "supervision",
      "workforce access",
      "access approval",
      "role assignment",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.308(a)(3)(ii)(B)",
    name: "Workforce Clearance Procedure",
    description:
      "Implement procedures to determine that access of a workforce member to ePHI is appropriate.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "clearance",
      "access determination",
      "access review",
      "need to know",
      "minimum necessary",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.308(a)(3)(ii)(C)",
    name: "Termination Procedures",
    description:
      "Implement procedures for terminating access to ePHI when employment ends or access is no longer required.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "termination",
      "offboarding",
      "access revocation",
      "deprovisioning",
      "account removal",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(4)(i)",
    name: "Information Access Management",
    description:
      "Implement policies and procedures for authorizing access to ePHI consistent with the Privacy Rule.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "informationDisclosure"],
    keywords: [
      "access management",
      "access control",
      "information access",
      "authorization",
      "RBAC",
      "minimum necessary",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(5)(i)",
    name: "Security Awareness and Training",
    description:
      "Implement a security awareness and training program for all members of the workforce.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering"],
    keywords: [
      "security training",
      "security awareness",
      "phishing training",
      "workforce training",
      "education",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.308(a)(5)(ii)(A)",
    name: "Security Reminders",
    description:
      "Periodic security updates and reminders to workforce members.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "security reminders",
      "security updates",
      "awareness bulletins",
      "security notices",
    ],
    severity: "LOW",
  },
  {
    id: "164.308(a)(5)(ii)(B)",
    name: "Protection from Malicious Software",
    description:
      "Procedures for guarding against, detecting, and reporting malicious software.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "malware",
      "antivirus",
      "malicious software",
      "endpoint protection",
      "ransomware",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(5)(ii)(C)",
    name: "Log-in Monitoring",
    description:
      "Procedures for monitoring log-in attempts and reporting discrepancies.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "repudiation"],
    keywords: [
      "login monitoring",
      "failed login",
      "brute force",
      "authentication monitoring",
      "sign-in attempts",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.308(a)(5)(ii)(D)",
    name: "Password Management",
    description:
      "Procedures for creating, changing, and safeguarding passwords.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "password",
      "password policy",
      "credential management",
      "password complexity",
      "password rotation",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.308(a)(6)(i)",
    name: "Security Incident Procedures",
    description:
      "Implement policies and procedures to address security incidents.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "denial"],
    keywords: [
      "incident response",
      "incident procedures",
      "security incident",
      "breach response",
      "incident management",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(6)(ii)",
    name: "Response and Reporting",
    description:
      "Identify and respond to suspected or known security incidents, mitigate harmful effects, and document incidents and their outcomes.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "denial"],
    keywords: [
      "incident reporting",
      "breach notification",
      "incident documentation",
      "containment",
      "forensics",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(7)(i)",
    name: "Contingency Plan",
    description:
      "Establish policies and procedures for responding to an emergency or other occurrence that damages systems containing ePHI.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "contingency plan",
      "disaster recovery",
      "business continuity",
      "emergency plan",
      "BCP",
      "DRP",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(7)(ii)(A)",
    name: "Data Backup Plan",
    description:
      "Establish and implement procedures to create and maintain retrievable exact copies of ePHI.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: [
      "backup",
      "data backup",
      "backup plan",
      "data recovery",
      "replication",
      "ePHI backup",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(7)(ii)(B)",
    name: "Disaster Recovery Plan",
    description:
      "Establish and implement procedures to restore any loss of data.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "disaster recovery",
      "restore",
      "recovery plan",
      "RTO",
      "RPO",
      "failover",
    ],
    severity: "HIGH",
  },
  {
    id: "164.308(a)(7)(ii)(C)",
    name: "Emergency Mode Operation Plan",
    description:
      "Establish procedures to enable continuation of critical business processes for protection of ePHI during an emergency.",
    category: "ADMIN",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "emergency mode",
      "emergency operations",
      "critical processes",
      "continuity",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.308(a)(8)",
    name: "Evaluation",
    description:
      "Perform periodic technical and non-technical evaluation to establish the extent to which security policies and procedures meet HIPAA requirements.",
    category: "ADMIN",
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
      "evaluation",
      "security assessment",
      "compliance audit",
      "gap analysis",
      "HIPAA audit",
    ],
    severity: "MEDIUM",
  },

  // ============================================================
  // PHYSICAL - Physical Safeguards (164.310)
  // ============================================================
  {
    id: "164.310(a)(1)",
    name: "Facility Access Controls",
    description:
      "Implement policies and procedures to limit physical access to electronic information systems and the facilities in which they are housed.",
    category: "PHYSICAL",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "informationDisclosure"],
    keywords: [
      "facility access",
      "physical access",
      "building security",
      "data center",
      "physical security",
    ],
    severity: "HIGH",
  },
  {
    id: "164.310(a)(2)(ii)",
    name: "Facility Security Plan",
    description:
      "Implement policies and procedures to safeguard the facility and equipment from unauthorized physical access, tampering, and theft.",
    category: "PHYSICAL",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "facility security",
      "physical safeguards",
      "equipment protection",
      "theft prevention",
      "surveillance",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.310(b)",
    name: "Workstation Use",
    description:
      "Implement policies and procedures that specify the proper functions to be performed and the manner in which they are to be performed on workstations with access to ePHI.",
    category: "PHYSICAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "elevationOfPrivilege"],
    keywords: [
      "workstation",
      "workstation use",
      "endpoint",
      "desktop security",
      "screen lock",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.310(c)",
    name: "Workstation Security",
    description:
      "Implement physical safeguards for all workstations that access ePHI to restrict access to authorized users.",
    category: "PHYSICAL",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "workstation security",
      "physical workstation",
      "endpoint security",
      "device security",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.310(d)(1)",
    name: "Device and Media Controls",
    description:
      "Implement policies and procedures that govern the receipt and removal of hardware and electronic media containing ePHI.",
    category: "PHYSICAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "media disposal",
      "device disposal",
      "media sanitization",
      "hardware disposal",
      "data destruction",
      "media controls",
    ],
    severity: "HIGH",
  },

  // ============================================================
  // TECHNICAL - Technical Safeguards (164.312)
  // ============================================================
  {
    id: "164.312(a)(1)",
    name: "Access Control",
    description:
      "Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "access control",
      "authorization",
      "RBAC",
      "permissions",
      "access rights",
      "least privilege",
    ],
    severity: "CRITICAL",
  },
  {
    id: "164.312(a)(2)(i)",
    name: "Unique User Identification",
    description:
      "Assign a unique name and/or number for identifying and tracking user identity.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "repudiation"],
    keywords: [
      "unique user",
      "user identification",
      "user ID",
      "identity",
      "account",
      "username",
    ],
    severity: "HIGH",
  },
  {
    id: "164.312(a)(2)(ii)",
    name: "Emergency Access Procedure",
    description:
      "Establish and implement procedures for obtaining necessary ePHI during an emergency.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["denial", "elevationOfPrivilege"],
    keywords: [
      "emergency access",
      "break glass",
      "emergency procedure",
      "emergency override",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.312(a)(2)(iii)",
    name: "Automatic Logoff",
    description:
      "Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "automatic logoff",
      "session timeout",
      "idle timeout",
      "session expiration",
      "inactivity timeout",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.312(a)(2)(iv)",
    name: "Encryption and Decryption",
    description: "Implement a mechanism to encrypt and decrypt ePHI.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "encryption",
      "decryption",
      "AES",
      "data at rest",
      "encrypted storage",
      "cryptography",
      "ePHI encryption",
    ],
    severity: "CRITICAL",
  },
  {
    id: "164.312(b)",
    name: "Audit Controls",
    description:
      "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "audit controls",
      "audit log",
      "audit trail",
      "logging",
      "SIEM",
      "event logging",
      "activity tracking",
    ],
    severity: "HIGH",
  },
  {
    id: "164.312(c)(1)",
    name: "Integrity Controls",
    description:
      "Implement policies and procedures to protect ePHI from improper alteration or destruction.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "integrity",
      "data integrity",
      "integrity controls",
      "checksum",
      "hash",
      "tamper detection",
    ],
    severity: "HIGH",
  },
  {
    id: "164.312(c)(2)",
    name: "Mechanism to Authenticate ePHI",
    description:
      "Implement electronic mechanisms to corroborate that ePHI has not been altered or destroyed in an unauthorized manner.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "repudiation"],
    keywords: [
      "data authentication",
      "digital signature",
      "message authentication",
      "HMAC",
      "integrity verification",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.312(d)",
    name: "Person or Entity Authentication",
    description:
      "Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: [
      "authentication",
      "MFA",
      "multi-factor",
      "identity verification",
      "login",
      "credentials",
      "SSO",
      "biometric",
    ],
    severity: "CRITICAL",
  },
  {
    id: "164.312(e)(1)",
    name: "Transmission Security",
    description:
      "Implement technical security measures to guard against unauthorized access to ePHI being transmitted over an electronic communications network.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "transmission security",
      "TLS",
      "SSL",
      "HTTPS",
      "encryption in transit",
      "VPN",
      "secure channel",
    ],
    severity: "CRITICAL",
  },
  {
    id: "164.312(e)(2)(i)",
    name: "Integrity Controls for Transmission",
    description:
      "Implement security measures to ensure that electronically transmitted ePHI is not improperly modified without detection.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "transmission integrity",
      "message integrity",
      "data in transit",
      "secure transmission",
    ],
    severity: "HIGH",
  },
  {
    id: "164.312(e)(2)(ii)",
    name: "Encryption for Transmission",
    description:
      "Implement a mechanism to encrypt ePHI whenever deemed appropriate during transmission.",
    category: "TECHNICAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "transport encryption",
      "TLS",
      "encrypted transmission",
      "secure transport",
      "end-to-end encryption",
    ],
    severity: "HIGH",
  },

  // ============================================================
  // ORGANIZATIONAL - Organizational Requirements (164.314)
  // ============================================================
  {
    id: "164.314(a)(1)",
    name: "Business Associate Contracts",
    description:
      "A covered entity may permit a business associate to create, receive, maintain, or transmit ePHI on its behalf only if the covered entity obtains satisfactory assurances.",
    category: "ORGANIZATIONAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "business associate",
      "BAA",
      "BA agreement",
      "third party",
      "vendor",
      "subcontractor",
    ],
    severity: "HIGH",
  },
  {
    id: "164.314(a)(2)(i)",
    name: "Business Associate Contract Requirements",
    description:
      "Business associate contracts must require the business associate to comply with applicable HIPAA Security Rule requirements.",
    category: "ORGANIZATIONAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "BAA requirements",
      "contract requirements",
      "vendor compliance",
      "supply chain",
      "partner security",
    ],
    severity: "HIGH",
  },
  {
    id: "164.314(b)(1)",
    name: "Group Health Plan Requirements",
    description:
      "Requirements for group health plans to ensure adequate separation between the group health plan and the plan sponsor.",
    category: "ORGANIZATIONAL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "elevationOfPrivilege"],
    keywords: [
      "group health plan",
      "plan sponsor",
      "health plan",
      "separation of duties",
    ],
    severity: "MEDIUM",
  },

  // ============================================================
  // POLICIES - Policies & Documentation (164.316)
  // ============================================================
  {
    id: "164.316(a)",
    name: "Policies and Procedures",
    description:
      "Implement reasonable and appropriate policies and procedures to comply with the HIPAA Security Rule.",
    category: "POLICIES",
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
      "policies and procedures",
      "security procedures",
      "HIPAA policy",
      "compliance policy",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.316(b)(1)",
    name: "Documentation",
    description:
      "Maintain the policies and procedures implemented to comply with the Security Rule in written form, which may be electronic.",
    category: "POLICIES",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "documentation",
      "security documentation",
      "policy documentation",
      "records retention",
    ],
    severity: "MEDIUM",
  },
  {
    id: "164.316(b)(2)(i)",
    name: "Retention",
    description:
      "Retain the documentation for 6 years from the date of its creation or the date when it last was in effect, whichever is later.",
    category: "POLICIES",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "retention",
      "records retention",
      "document retention",
      "6 year retention",
      "archival",
    ],
    severity: "LOW",
  },
  {
    id: "164.316(b)(2)(ii)",
    name: "Updates",
    description:
      "Review documentation periodically and update as needed in response to environmental or operational changes affecting the security of ePHI.",
    category: "POLICIES",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "informationDisclosure"],
    keywords: [
      "policy updates",
      "policy review",
      "periodic review",
      "change management",
      "policy maintenance",
    ],
    severity: "LOW",
  },
];

// Populate categories with their controls
HIPAA_CATEGORIES.forEach((category) => {
  category.controls = HIPAA_CONTROLS.filter((c) => c.category === category.id);
});
