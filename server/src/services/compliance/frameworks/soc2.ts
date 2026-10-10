/**
 * SOC 2 Trust Services Criteria
 *
 * Based on AICPA Trust Services Criteria (2017).
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "SOC2" as const;

export const SOC2_CATEGORIES: ControlCategory[] = [
  {
    id: "CC1",
    name: "Control Environment",
    description:
      "The set of standards, processes, and structures that provide the basis for carrying out internal control.",
    controls: [],
  },
  {
    id: "CC2",
    name: "Communication and Information",
    description:
      "Information necessary for the entity to carry out internal control responsibilities.",
    controls: [],
  },
  {
    id: "CC3",
    name: "Risk Assessment",
    description:
      "Dynamic and iterative process for identifying and assessing risks.",
    controls: [],
  },
  {
    id: "CC4",
    name: "Monitoring Activities",
    description:
      "Ongoing evaluations, separate evaluations, or some combination of the two.",
    controls: [],
  },
  {
    id: "CC5",
    name: "Control Activities",
    description:
      "Actions established through policies and procedures to mitigate risks.",
    controls: [],
  },
  {
    id: "CC6",
    name: "Logical and Physical Access Controls",
    description:
      "Controls over logical and physical access to protect against threats.",
    controls: [],
  },
  {
    id: "CC7",
    name: "System Operations",
    description: "Controls for detecting and mitigating processing deviations.",
    controls: [],
  },
  {
    id: "CC8",
    name: "Change Management",
    description:
      "Controls for authorizing, designing, testing, and implementing changes.",
    controls: [],
  },
  {
    id: "CC9",
    name: "Risk Mitigation",
    description:
      "Controls for identifying, selecting, and developing risk mitigation activities.",
    controls: [],
  },
];

export const SOC2_CONTROLS: ComplianceControl[] = [
  // CC6 - Logical and Physical Access Controls
  {
    id: "CC6.1",
    name: "Logical Access Security",
    description:
      "The entity implements logical access security software, infrastructure, and architectures.",
    category: "CC6",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "authentication",
      "access control",
      "identity",
      "login",
      "credentials",
      "password",
      "MFA",
      "SSO",
    ],
    severity: "HIGH",
  },
  {
    id: "CC6.2",
    name: "User Registration and Authorization",
    description:
      "Prior to issuing system credentials, the entity registers and authorizes new users.",
    category: "CC6",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "registration",
      "provisioning",
      "authorization",
      "user management",
      "onboarding",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CC6.3",
    name: "Access Removal",
    description:
      "The entity removes access to protected information when appropriate.",
    category: "CC6",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "deprovisioning",
      "access removal",
      "offboarding",
      "termination",
      "revocation",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CC6.6",
    name: "Security Boundaries",
    description:
      "The entity implements logical access security measures to protect against threats.",
    category: "CC6",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "informationDisclosure"],
    keywords: [
      "firewall",
      "network segmentation",
      "DMZ",
      "perimeter",
      "boundary",
      "VPN",
    ],
    severity: "HIGH",
  },
  {
    id: "CC6.7",
    name: "Data Transmission Protection",
    description:
      "The entity restricts transmission of data to authorized channels.",
    category: "CC6",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "encryption",
      "TLS",
      "SSL",
      "HTTPS",
      "secure transmission",
      "data in transit",
    ],
    severity: "HIGH",
  },
  {
    id: "CC6.8",
    name: "Malicious Software Prevention",
    description:
      "The entity implements controls to prevent malicious software.",
    category: "CC6",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "antivirus",
      "malware",
      "endpoint protection",
      "EDR",
      "antimalware",
    ],
    severity: "HIGH",
  },
  // CC7 - System Operations
  {
    id: "CC7.1",
    name: "Security Event Detection",
    description: "The entity uses detection tools to identify security events.",
    category: "CC7",
    framework: FRAMEWORK,
    strideCategories: ["repudiation", "informationDisclosure"],
    keywords: [
      "monitoring",
      "SIEM",
      "logging",
      "detection",
      "alerting",
      "IDS",
      "IPS",
    ],
    severity: "HIGH",
  },
  {
    id: "CC7.2",
    name: "Security Event Analysis",
    description: "The entity monitors system components and detects anomalies.",
    category: "CC7",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "analysis",
      "correlation",
      "threat intelligence",
      "anomaly detection",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CC7.3",
    name: "Security Event Response",
    description:
      "The entity evaluates security events and responds appropriately.",
    category: "CC7",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: ["incident response", "escalation", "containment", "remediation"],
    severity: "HIGH",
  },
  {
    id: "CC7.4",
    name: "Security Event Recovery",
    description:
      "The entity responds to identified security incidents by executing recovery procedures.",
    category: "CC7",
    framework: FRAMEWORK,
    strideCategories: ["denial"],
    keywords: [
      "recovery",
      "backup",
      "restore",
      "disaster recovery",
      "business continuity",
    ],
    severity: "HIGH",
  },
  // CC8 - Change Management
  {
    id: "CC8.1",
    name: "Change Authorization",
    description:
      "The entity authorizes, designs, develops, and implements changes.",
    category: "CC8",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: ["change management", "change control", "approval", "CAB"],
    severity: "MEDIUM",
  },
  // CC3 - Risk Assessment
  {
    id: "CC3.1",
    name: "Risk Identification",
    description:
      "The entity specifies objectives and identifies risks to achievement of objectives.",
    category: "CC3",
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
      "risk analysis",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CC3.2",
    name: "Fraud Risk Assessment",
    description:
      "The entity considers the potential for fraud in assessing risks.",
    category: "CC3",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "repudiation"],
    keywords: ["fraud", "abuse", "insider threat", "social engineering"],
    severity: "MEDIUM",
  },
  // CC9 - Risk Mitigation
  {
    id: "CC9.1",
    name: "Risk Mitigation Activities",
    description:
      "The entity identifies, selects, and develops risk mitigation activities.",
    category: "CC9",
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
      "mitigation",
      "control",
      "countermeasure",
      "safeguard",
      "remediation",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CC9.2",
    name: "Vendor Risk Management",
    description:
      "The entity assesses and manages risks associated with vendors and business partners.",
    category: "CC9",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "vendor",
      "third party",
      "supply chain",
      "partner",
      "subservice",
    ],
    severity: "MEDIUM",
  },
];

// Populate categories with their controls
SOC2_CATEGORIES.forEach((category) => {
  category.controls = SOC2_CONTROLS.filter((c) => c.category === category.id);
});
