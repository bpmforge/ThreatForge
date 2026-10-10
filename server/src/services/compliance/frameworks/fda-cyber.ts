/**
 * FDA Cybersecurity in Medical Devices
 *
 * Based on the FDA "Cybersecurity in Medical Devices: Quality System Considerations
 * and Content of Premarket Submissions" (2023 final guidance) and the eSTAR
 * 12-document cybersecurity submission format. Covers Section 524B of the
 * FD&C Act as amended by the Consolidated Appropriations Act, 2023.
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "FDA_CYBER" as const;

export const FDA_CYBER_CATEGORIES: ControlCategory[] = [
  {
    id: "SBOM",
    name: "Software Bill of Materials",
    description:
      "Complete inventory of software components including open-source, commercial, and custom-developed software.",
    controls: [],
  },
  {
    id: "THREAT_MODEL",
    name: "Threat Modeling Documentation",
    description:
      "Systematic identification and analysis of cybersecurity threats to the medical device and its ecosystem.",
    controls: [],
  },
  {
    id: "RISK_MGMT",
    name: "Cybersecurity Risk Management",
    description:
      "Risk analysis and management integrated into the total product lifecycle per ISO 14971.",
    controls: [],
  },
  {
    id: "DESIGN",
    name: "Security Architecture and Design",
    description:
      "Security-by-design controls including authentication, encryption, and secure boot.",
    controls: [],
  },
  {
    id: "TESTING",
    name: "Cybersecurity Testing",
    description:
      "Verification and validation of cybersecurity controls including penetration testing and fuzz testing.",
    controls: [],
  },
  {
    id: "UPDATES",
    name: "Software Update and Patch Management",
    description:
      "Mechanisms for deploying validated software and firmware updates throughout the device lifecycle.",
    controls: [],
  },
  {
    id: "LIFECYCLE",
    name: "Product Lifecycle Security",
    description:
      "Postmarket cybersecurity management including monitoring, vulnerability tracking, and end-of-life planning.",
    controls: [],
  },
  {
    id: "INCIDENT",
    name: "Vulnerability Disclosure and Incident Response",
    description:
      "Coordinated vulnerability disclosure policy and incident response procedures.",
    controls: [],
  },
  {
    id: "LABELING",
    name: "Cybersecurity Labeling",
    description:
      "Device labeling and documentation communicating cybersecurity information to users and healthcare delivery organizations.",
    controls: [],
  },
  {
    id: "INTEROP",
    name: "Interoperability and Safety",
    description:
      "Safe integration with hospital networks, other medical devices, and cloud services without compromising patient safety.",
    controls: [],
  },
];

export const FDA_CYBER_CONTROLS: ComplianceControl[] = [
  // ── SBOM ────────────────────────────────────────────────────
  {
    id: "FDA-SBOM-1",
    name: "Software Bill of Materials",
    description:
      "Provide a complete SBOM including commercial, open-source, and off-the-shelf software components with version numbers and known vulnerabilities.",
    category: "SBOM",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "SBOM",
      "software bill of materials",
      "software components",
      "open source",
      "third party",
      "medical device",
      "premarket",
      "510(k)",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-SBOM-2",
    name: "Known Vulnerability Analysis",
    description:
      "Identify and assess all known vulnerabilities in SBOM components and provide risk justification for unpatched vulnerabilities.",
    category: "SBOM",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "CVE",
      "vulnerability",
      "known vulnerability",
      "SBOM analysis",
      "unpatched",
      "medical device security",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-SBOM-3",
    name: "Software Support and Maintenance Plan",
    description:
      "Document plan for ongoing support of third-party software components including end-of-support timelines.",
    category: "SBOM",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "software support",
      "end of life",
      "EOL",
      "maintenance plan",
      "component lifecycle",
      "postmarket",
    ],
    severity: "MEDIUM",
  },

  // ── THREAT_MODEL ────────────────────────────────────────────
  {
    id: "FDA-TM-1",
    name: "System-Level Threat Model",
    description:
      "Conduct a threat model analysis of the complete system including the device, network interfaces, cloud components, and mobile applications.",
    category: "THREAT_MODEL",
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
      "threat model",
      "threat modeling",
      "STRIDE",
      "attack surface",
      "medical device",
      "clinical system",
      "patient safety",
      "premarket submission",
    ],
    severity: "CRITICAL",
  },
  {
    id: "FDA-TM-2",
    name: "Data Flow Diagrams",
    description:
      "Create multi-level data flow diagrams showing trust boundaries, data stores, external entities, and all interfaces.",
    category: "THREAT_MODEL",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "data flow diagram",
      "DFD",
      "trust boundary",
      "data flow",
      "ePHI",
      "PHI",
      "patient data",
      "clinical data",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-TM-3",
    name: "Attack Surface Analysis",
    description:
      "Document all attack surfaces including network interfaces, wireless protocols, removable media, and physical ports.",
    category: "THREAT_MODEL",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "denial"],
    keywords: [
      "attack surface",
      "network interface",
      "wireless",
      "Bluetooth",
      "USB",
      "physical port",
      "medical device interface",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-TM-4",
    name: "Threat Mitigation Traceability",
    description:
      "Provide traceability matrix mapping identified threats to specific mitigations and their verification status.",
    category: "THREAT_MODEL",
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
      "traceability",
      "mitigation",
      "threat mitigation",
      "risk control",
      "verification",
      "510(k)",
      "eSTAR",
    ],
    severity: "HIGH",
  },

  // ── RISK_MGMT ───────────────────────────────────────────────
  {
    id: "FDA-RM-1",
    name: "Cybersecurity Risk Assessment",
    description:
      "Perform cybersecurity risk assessment per ISO 14971 evaluating exploitability and severity of patient harm for each identified threat.",
    category: "RISK_MGMT",
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
      "ISO 14971",
      "patient harm",
      "clinical risk",
      "exploitability",
      "severity",
      "medical device risk",
    ],
    severity: "CRITICAL",
  },
  {
    id: "FDA-RM-2",
    name: "Security Risk Acceptance Criteria",
    description:
      "Define and document acceptable residual risk levels for cybersecurity risks, including patient safety impact.",
    category: "RISK_MGMT",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: [
      "risk acceptance",
      "residual risk",
      "risk criteria",
      "patient safety",
      "benefit-risk",
      "clinical benefit",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-RM-3",
    name: "Cybersecurity Risk Controls",
    description:
      "Implement risk controls that reduce cybersecurity risks to acceptable levels and verify their effectiveness.",
    category: "RISK_MGMT",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "denial",
      "elevationOfPrivilege",
    ],
    keywords: [
      "risk control",
      "control effectiveness",
      "risk mitigation",
      "safety control",
      "medical device control",
    ],
    severity: "HIGH",
  },

  // ── DESIGN ──────────────────────────────────────────────────
  {
    id: "FDA-DES-1",
    name: "Authentication and Access Control",
    description:
      "Implement user authentication and role-based access controls for all device interfaces including clinical and service modes.",
    category: "DESIGN",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "elevationOfPrivilege"],
    keywords: [
      "authentication",
      "access control",
      "RBAC",
      "clinical user",
      "service mode",
      "medical device access",
      "ePHI access",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-DES-2",
    name: "Data Encryption",
    description:
      "Encrypt PHI and ePHI at rest and in transit using validated cryptographic methods.",
    category: "DESIGN",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "encryption",
      "ePHI",
      "PHI",
      "data protection",
      "HIPAA",
      "patient data",
      "cryptography",
      "medical records",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-DES-3",
    name: "Secure Boot and Code Integrity",
    description:
      "Implement secure boot chain and runtime code integrity verification to prevent execution of unauthorized software.",
    category: "DESIGN",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "secure boot",
      "code signing",
      "firmware integrity",
      "code integrity",
      "trusted boot",
      "medical device firmware",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-DES-4",
    name: "Audit Logging",
    description:
      "Log security-relevant events including authentication attempts, configuration changes, and anomalous activities.",
    category: "DESIGN",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "audit log",
      "security logging",
      "event logging",
      "clinical audit",
      "device log",
      "accountability",
    ],
    severity: "MEDIUM",
  },
  {
    id: "FDA-DES-5",
    name: "Network Segmentation and Device Isolation",
    description:
      "Support deployment in segmented hospital networks and document network architecture requirements.",
    category: "DESIGN",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "denial"],
    keywords: [
      "network segmentation",
      "device isolation",
      "hospital network",
      "VLAN",
      "medical network",
      "clinical network",
    ],
    severity: "MEDIUM",
  },

  // ── TESTING ─────────────────────────────────────────────────
  {
    id: "FDA-TST-1",
    name: "Penetration Testing",
    description:
      "Conduct penetration testing of the device and connected components by qualified personnel.",
    category: "TESTING",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "tampering", "elevationOfPrivilege"],
    keywords: [
      "penetration testing",
      "pentest",
      "security testing",
      "medical device testing",
      "premarket testing",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-TST-2",
    name: "Fuzz Testing",
    description:
      "Perform fuzz testing on all device interfaces and communication protocols to identify input handling vulnerabilities.",
    category: "TESTING",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "fuzz testing",
      "fuzzing",
      "robustness testing",
      "protocol testing",
      "input validation",
      "medical device interface",
    ],
    severity: "MEDIUM",
  },
  {
    id: "FDA-TST-3",
    name: "Static and Dynamic Code Analysis",
    description:
      "Perform SAST and DAST on device software to identify security weaknesses.",
    category: "TESTING",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "SAST",
      "DAST",
      "code analysis",
      "static analysis",
      "dynamic analysis",
      "software assurance",
      "medical device software",
    ],
    severity: "MEDIUM",
  },
  {
    id: "FDA-TST-4",
    name: "Vulnerability Scanning",
    description:
      "Conduct vulnerability scanning of the device and its software components using current vulnerability databases.",
    category: "TESTING",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "vulnerability scanning",
      "CVE",
      "NVD",
      "vulnerability assessment",
      "security scan",
      "device scanning",
    ],
    severity: "MEDIUM",
  },

  // ── UPDATES ─────────────────────────────────────────────────
  {
    id: "FDA-UPD-1",
    name: "Secure Software Update Mechanism",
    description:
      "Implement authenticated and integrity-verified software and firmware update capability for the device.",
    category: "UPDATES",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: [
      "software update",
      "firmware update",
      "OTA update",
      "patch deployment",
      "authenticated update",
      "medical device update",
    ],
    severity: "CRITICAL",
  },
  {
    id: "FDA-UPD-2",
    name: "Patch Management Plan",
    description:
      "Document a plan for regular patching cycles including critical, routine, and out-of-cycle patches with validation testing.",
    category: "UPDATES",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "patch management",
      "patching",
      "security patch",
      "update plan",
      "postmarket",
      "device maintenance",
    ],
    severity: "HIGH",
  },

  // ── LIFECYCLE ───────────────────────────────────────────────
  {
    id: "FDA-LC-1",
    name: "Postmarket Vulnerability Monitoring",
    description:
      "Continuously monitor for new vulnerabilities affecting the device throughout its supported lifecycle.",
    category: "LIFECYCLE",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "postmarket",
      "vulnerability monitoring",
      "ISAO",
      "threat intelligence",
      "CVE monitoring",
      "medical device lifecycle",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-LC-2",
    name: "End-of-Life and End-of-Support Plan",
    description:
      "Document end-of-support and end-of-life timelines with customer notification and transition procedures.",
    category: "LIFECYCLE",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "end of life",
      "EOL",
      "end of support",
      "EOS",
      "device retirement",
      "decommissioning",
      "postmarket",
    ],
    severity: "MEDIUM",
  },
  {
    id: "FDA-LC-3",
    name: "Total Product Lifecycle Security",
    description:
      "Integrate cybersecurity into the total product lifecycle from design through deployment, maintenance, and decommissioning.",
    category: "LIFECYCLE",
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
      "TPLC",
      "total product lifecycle",
      "lifecycle security",
      "design control",
      "QSR",
      "quality system",
      "medical device lifecycle",
    ],
    severity: "MEDIUM",
  },

  // ── INCIDENT ────────────────────────────────────────────────
  {
    id: "FDA-IR-1",
    name: "Coordinated Vulnerability Disclosure",
    description:
      "Establish and maintain a coordinated vulnerability disclosure policy with timelines for acknowledgment and remediation.",
    category: "INCIDENT",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: [
      "vulnerability disclosure",
      "CVD",
      "responsible disclosure",
      "security researcher",
      "bug bounty",
      "medical device disclosure",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-IR-2",
    name: "Incident Response Plan",
    description:
      "Develop and maintain an incident response plan addressing cybersecurity events that may impact device safety or effectiveness.",
    category: "INCIDENT",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: [
      "incident response",
      "IRP",
      "cybersecurity event",
      "patient safety",
      "clinical incident",
      "FDA reporting",
      "MDR",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-IR-3",
    name: "Field Safety Corrective Action",
    description:
      "Process for issuing field safety corrective actions for cybersecurity vulnerabilities that could affect patient safety.",
    category: "INCIDENT",
    framework: FRAMEWORK,
    strideCategories: ["denial", "tampering"],
    keywords: [
      "field safety",
      "corrective action",
      "recall",
      "safety alert",
      "patient notification",
      "FDA recall",
    ],
    severity: "CRITICAL",
  },

  // ── LABELING ────────────────────────────────────────────────
  {
    id: "FDA-LBL-1",
    name: "Cybersecurity Device Labeling",
    description:
      "Provide clear cybersecurity instructions in device labeling including hardening guides, network requirements, and user responsibilities.",
    category: "LABELING",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "device labeling",
      "cybersecurity labeling",
      "user instructions",
      "hardening guide",
      "MDS2",
      "manufacturer disclosure",
    ],
    severity: "MEDIUM",
  },
  {
    id: "FDA-LBL-2",
    name: "Customer Security Documentation",
    description:
      "Provide healthcare delivery organizations with documentation needed to deploy and maintain the device securely.",
    category: "LABELING",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "denial"],
    keywords: [
      "security documentation",
      "deployment guide",
      "HDO",
      "healthcare delivery organization",
      "hospital IT",
      "clinical engineering",
    ],
    severity: "MEDIUM",
  },

  // ── INTEROP ─────────────────────────────────────────────────
  {
    id: "FDA-INT-1",
    name: "Safe Interoperability",
    description:
      "Ensure the device can safely interoperate with other medical devices and hospital systems without introducing cybersecurity risks.",
    category: "INTEROP",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "denial"],
    keywords: [
      "interoperability",
      "medical device integration",
      "HL7",
      "FHIR",
      "DICOM",
      "clinical system",
      "patient safety",
      "hospital system",
    ],
    severity: "HIGH",
  },
  {
    id: "FDA-INT-2",
    name: "Cloud and Mobile Security",
    description:
      "Secure cloud-connected features and companion mobile applications that interface with the medical device.",
    category: "INTEROP",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure", "tampering"],
    keywords: [
      "cloud security",
      "mobile app",
      "companion app",
      "SaMD",
      "software as medical device",
      "remote monitoring",
      "telehealth",
    ],
    severity: "HIGH",
  },
];

// Populate categories with their controls
FDA_CYBER_CATEGORIES.forEach((category) => {
  category.controls = FDA_CYBER_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});
