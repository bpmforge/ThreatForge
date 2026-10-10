/**
 * CCPA/CPRA — California Consumer Privacy Act / California Privacy Rights Act
 *
 * Based on the California Consumer Privacy Act of 2018 (as amended by CPRA 2020).
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "CCPA" as const;

export const CCPA_CATEGORIES: ControlCategory[] = [
  {
    id: "CR",
    name: "Consumer Rights",
    description:
      "Requirements to honor consumer rights including access, deletion, correction, portability, and opt-out of sale or sharing of personal information.",
    controls: [],
  },
  {
    id: "BO",
    name: "Business Obligations",
    description:
      "Obligations for businesses regarding notices, disclosures, policies, and non-discrimination requirements.",
    controls: [],
  },
  {
    id: "DP",
    name: "Data Processing",
    description:
      "Requirements governing the collection, use, retention, and sharing of personal information.",
    controls: [],
  },
  {
    id: "SR",
    name: "Security Requirements",
    description:
      "Obligations to implement reasonable security procedures and practices to protect personal information.",
    controls: [],
  },
  {
    id: "VM",
    name: "Vendor Management",
    description:
      "Requirements for contracts with service providers, contractors, and third parties who process personal information.",
    controls: [],
  },
];

export const CCPA_CONTROLS: ComplianceControl[] = [
  // CR — Consumer Rights
  {
    id: "CR.1",
    name: "Right to Know",
    description:
      "Consumers have the right to know what personal information is collected about them, the sources, business purpose, and categories of third parties with whom it is shared.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "right to know",
      "access request",
      "data disclosure",
      "personal information disclosure",
    ],
    severity: "HIGH",
  },
  {
    id: "CR.2",
    name: "Right to Delete",
    description:
      "Consumers have the right to request deletion of personal information collected from them, subject to certain exceptions.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "right to delete",
      "erasure",
      "data deletion",
      "deletion request",
    ],
    severity: "HIGH",
  },
  {
    id: "CR.3",
    name: "Right to Correct",
    description:
      "Consumers have the right to correct inaccurate personal information held by a business.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "right to correct",
      "data correction",
      "rectification",
      "accuracy",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CR.4",
    name: "Right to Opt-Out of Sale or Sharing",
    description:
      "Consumers have the right to opt-out of the sale or sharing of their personal information to third parties.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "opt-out",
      "do not sell",
      "do not share",
      "sale of personal information",
      "cross-context advertising",
    ],
    severity: "HIGH",
  },
  {
    id: "CR.5",
    name: "Right to Limit Use of Sensitive Personal Information",
    description:
      "Consumers have the right to limit the use and disclosure of sensitive personal information to necessary purposes.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "sensitive data",
      "sensitive personal information",
      "limit use",
      "SPI",
    ],
    severity: "HIGH",
  },
  {
    id: "CR.6",
    name: "Right to Data Portability",
    description:
      "Consumers have the right to receive their personal information in a portable, readily usable format.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data portability",
      "data export",
      "machine-readable format",
      "portable data",
    ],
    severity: "MEDIUM",
  },
  {
    id: "CR.7",
    name: "Non-Discrimination",
    description:
      "Businesses shall not discriminate against consumers for exercising their CCPA/CPRA rights.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "non-discrimination",
      "equal service",
      "privacy rights protection",
      "retaliation",
    ],
    severity: "HIGH",
  },
  {
    id: "CR.8",
    name: "Consumer Request Response",
    description:
      "Businesses must respond to verifiable consumer requests within 45 days and provide at least two methods for consumers to submit requests.",
    category: "CR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "consumer request",
      "DSAR",
      "request response",
      "45 day",
      "request handling",
    ],
    severity: "HIGH",
  },

  // BO — Business Obligations
  {
    id: "BO.1",
    name: "Privacy Policy",
    description:
      "Businesses must provide a comprehensive privacy policy describing their collection practices, consumer rights, and contact information for submitting requests.",
    category: "BO",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy policy",
      "privacy notice",
      "transparency",
      "disclosure",
    ],
    severity: "HIGH",
  },
  {
    id: "BO.2",
    name: "Notice at Collection",
    description:
      "Businesses must provide notice at or before the point of collection informing consumers of the categories of personal information collected and the purposes for which it is used.",
    category: "BO",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "notice at collection",
      "point of collection",
      "collection notice",
      "data collection disclosure",
    ],
    severity: "HIGH",
  },
  {
    id: "BO.3",
    name: "Do Not Sell or Share Link",
    description:
      'Businesses that sell or share personal information must provide a "Do Not Sell or Share My Personal Information" link on their homepage.',
    category: "BO",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "do not sell link",
      "opt-out link",
      "homepage link",
      "CCPA link",
    ],
    severity: "HIGH",
  },
  {
    id: "BO.4",
    name: "Annual Privacy Policy Update",
    description:
      "Businesses must update their privacy policy at least once every 12 months to reflect any changes in data practices.",
    category: "BO",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["policy update", "annual review", "privacy policy maintenance"],
    severity: "MEDIUM",
  },
  {
    id: "BO.5",
    name: "Privacy Rights Training",
    description:
      "Personnel responsible for handling consumer inquiries about privacy practices must be informed of CCPA/CPRA requirements and how to direct consumers to exercise their rights.",
    category: "BO",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy training",
      "staff training",
      "consumer inquiry handling",
      "rights awareness",
    ],
    severity: "MEDIUM",
  },

  // DP — Data Processing
  {
    id: "DP.1",
    name: "Data Inventory",
    description:
      "Maintain a comprehensive inventory of personal information collected, the sources, purposes of use, and categories of third parties with whom it is shared or sold.",
    category: "DP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data inventory",
      "data mapping",
      "personal information inventory",
      "data flows",
    ],
    severity: "HIGH",
  },
  {
    id: "DP.2",
    name: "Purpose Limitation",
    description:
      "Personal information collected shall only be used for the disclosed purposes and shall not be used for undisclosed secondary purposes without consumer consent.",
    category: "DP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "purpose limitation",
      "secondary use",
      "compatible purpose",
      "data use",
    ],
    severity: "HIGH",
  },
  {
    id: "DP.3",
    name: "Data Minimization",
    description:
      "Collection and use of personal information shall be reasonably necessary and proportionate to the purposes for which it is collected or processed.",
    category: "DP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data minimization",
      "proportionality",
      "necessary data",
      "collection limitation",
    ],
    severity: "HIGH",
  },
  {
    id: "DP.4",
    name: "Retention Limits",
    description:
      "Personal information shall not be retained longer than reasonably necessary for the disclosed purpose of its collection.",
    category: "DP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data retention",
      "retention limits",
      "deletion schedule",
      "data lifecycle",
    ],
    severity: "HIGH",
  },
  {
    id: "DP.5",
    name: "Sensitive Personal Information Controls",
    description:
      "Sensitive personal information (SPI) including government IDs, financial account credentials, precise geolocation, biometric data, and health data must be handled with heightened protections.",
    category: "DP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "sensitive personal information",
      "SPI",
      "biometric data",
      "health data",
      "geolocation",
    ],
    severity: "CRITICAL",
  },
  {
    id: "DP.6",
    name: "Children Privacy (Under 16)",
    description:
      "Businesses shall not sell or share personal information of consumers under 16 years of age without affirmative authorization.",
    category: "DP",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "children privacy",
      "under 16",
      "minor data",
      "opt-in consent",
      "COPPA",
    ],
    severity: "CRITICAL",
  },

  // SR — Security Requirements
  {
    id: "SR.1",
    name: "Reasonable Security Measures",
    description:
      "Businesses must implement and maintain reasonable security procedures and practices appropriate to the nature of the personal information to protect it from unauthorized or illegal access, destruction, use, modification, or disclosure.",
    category: "SR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: [
      "reasonable security",
      "data security",
      "security controls",
      "personal information protection",
    ],
    severity: "CRITICAL",
  },
  {
    id: "SR.2",
    name: "Data Breach Notification",
    description:
      "In the event of a data breach affecting unencrypted personal information, businesses must notify affected consumers and the California Attorney General if more than 500 consumers are affected.",
    category: "SR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data breach",
      "breach notification",
      "California AG",
      "security incident",
    ],
    severity: "CRITICAL",
  },
  {
    id: "SR.3",
    name: "Encryption and Deidentification",
    description:
      "Businesses should encrypt personal information and implement deidentification techniques to reduce the risk of unauthorized disclosure.",
    category: "SR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "encryption",
      "deidentification",
      "anonymization",
      "data protection",
    ],
    severity: "HIGH",
  },
  {
    id: "SR.4",
    name: "Access Controls",
    description:
      "Implement access controls to limit access to personal information to authorized personnel with a legitimate business need.",
    category: "SR",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "elevationOfPrivilege",
      "informationDisclosure",
    ],
    keywords: [
      "access control",
      "least privilege",
      "authorized access",
      "need to know",
    ],
    severity: "HIGH",
  },
  {
    id: "SR.5",
    name: "Security Risk Assessments",
    description:
      "Conduct regular risk assessments for personal information processing activities that present significant risk to consumers' privacy and security.",
    category: "SR",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "risk assessment",
      "privacy risk",
      "security assessment",
      "CPRA risk assessment",
    ],
    severity: "HIGH",
  },

  // VM — Vendor Management
  {
    id: "VM.1",
    name: "Service Provider Contracts",
    description:
      "Contracts with service providers must prohibit them from selling or sharing personal information, using it for any purpose other than performing services, and must require adherence to CCPA/CPRA obligations.",
    category: "VM",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "service provider",
      "vendor contract",
      "DPA",
      "data processing agreement",
      "CCPA contract",
    ],
    severity: "HIGH",
  },
  {
    id: "VM.2",
    name: "Third-Party Disclosure Restrictions",
    description:
      "Businesses must contractually restrict third parties, contractors, and service providers from using personal information for purposes beyond what is disclosed in the privacy notice.",
    category: "VM",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "third party",
      "disclosure restriction",
      "data sharing",
      "vendor controls",
    ],
    severity: "HIGH",
  },
  {
    id: "VM.3",
    name: "Sub-Processor Management",
    description:
      "Service providers must enter into agreements with sub-processors that impose the same obligations regarding personal information as contained in the business-to-service provider agreement.",
    category: "VM",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "sub-processor",
      "supply chain",
      "downstream vendor",
      "fourth party",
    ],
    severity: "MEDIUM",
  },
  {
    id: "VM.4",
    name: "Vendor Compliance Verification",
    description:
      "Businesses should monitor and verify that service providers and contractors comply with CCPA/CPRA obligations through audits, assessments, or certifications.",
    category: "VM",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "vendor audit",
      "compliance verification",
      "third-party audit",
      "vendor assessment",
    ],
    severity: "MEDIUM",
  },
  {
    id: "VM.5",
    name: "Data Processing Agreements",
    description:
      "Maintain written data processing agreements with all service providers describing the scope of processing, permitted uses, security requirements, and consumer rights obligations.",
    category: "VM",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data processing agreement",
      "DPA",
      "written contract",
      "processing terms",
    ],
    severity: "HIGH",
  },
];

// Populate categories with their controls
CCPA_CATEGORIES.forEach((category) => {
  category.controls = CCPA_CONTROLS.filter((c) => c.category === category.id);
});
