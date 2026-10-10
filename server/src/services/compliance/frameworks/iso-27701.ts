/**
 * ISO 27701:2019 — Privacy Information Management System (PIMS)
 *
 * Extension to ISO 27001 and ISO 27002 for privacy management.
 *
 * Clause identifiers and short control names reference ISO/IEC 27701:2019
 * purely so findings can be cross-referenced against the standard.
 *
 * All `description` text below is ThreatForge's own plain-language summary of
 * what each control is about. None of it is reproduced from, or a derivative
 * transcription of, the copyrighted text of ISO/IEC 27701. Consult the
 * standard itself for the authoritative normative wording.
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "ISO_27701" as const;

export const ISO_27701_CATEGORIES: ControlCategory[] = [
  {
    id: "5",
    name: "Context of the Organization",
    description:
      "Sizing up the internal and external factors that shape a privacy program.",
    controls: [],
  },
  {
    id: "6",
    name: "Leadership",
    description:
      "Executive ownership and direction for the privacy management program.",
    controls: [],
  },
  {
    id: "7",
    name: "Planning",
    description:
      "Setting privacy goals and deciding how risks to personal data get handled.",
    controls: [],
  },
  {
    id: "8",
    name: "Support",
    description:
      "People, skills, communication, and records that keep the privacy program running.",
    controls: [],
  },
  {
    id: "9",
    name: "Operation",
    description:
      "Day-to-day running of privacy controls, including assessments and by-design practices.",
    controls: [],
  },
  {
    id: "10",
    name: "Performance Evaluation",
    description:
      "Checking whether the privacy program works, through measurement, audit, and review.",
    controls: [],
  },
  {
    id: "11",
    name: "Improvement",
    description:
      "Fixing shortfalls and steadily raising the maturity of the privacy program.",
    controls: [],
  },
  {
    id: "7PII-C",
    name: "PII Controllers",
    description:
      "Duties falling on organizations that decide why and how personal data is used.",
    controls: [],
  },
  {
    id: "8PII-P",
    name: "PII Processors",
    description:
      "Duties falling on organizations that handle personal data on behalf of someone else.",
    controls: [],
  },
];

export const ISO_27701_CONTROLS: ComplianceControl[] = [
  // 5 — Context of the Organization
  {
    id: "5.2.1",
    name: "Understanding Privacy Context",
    description:
      "Covers identifying the internal and external factors that affect privacy outcomes.",
    category: "5",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy context",
      "PIMS scope",
      "privacy management",
      "organizational context",
    ],
    severity: "MEDIUM",
  },
  {
    id: "5.2.3",
    name: "PIMS Scope",
    description:
      "Covers drawing the boundary of the privacy program and the data handling inside it.",
    category: "5",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "PIMS scope",
      "PII processing",
      "privacy boundaries",
      "data inventory",
    ],
    severity: "MEDIUM",
  },
  {
    id: "5.4",
    name: "PII Roles and Responsibilities",
    description:
      "Expects the organization to settle and record whether it directs data use, performs it, or both.",
    category: "5",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "PII controller",
      "PII processor",
      "data roles",
      "privacy responsibilities",
    ],
    severity: "HIGH",
  },

  // 6 — Leadership
  {
    id: "6.1.1",
    name: "Leadership Commitment to Privacy",
    description:
      "Expects senior leaders to own the privacy program and tie it into how the business runs.",
    category: "6",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy policy",
      "leadership commitment",
      "management support",
      "privacy governance",
    ],
    severity: "HIGH",
  },
  {
    id: "6.2",
    name: "Privacy Policy",
    description:
      "Requires a documented, available privacy policy fitting the organization and its obligations.",
    category: "6",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy policy",
      "privacy statement",
      "data protection policy",
      "documented policy",
    ],
    severity: "HIGH",
  },
  {
    id: "6.3",
    name: "Privacy Roles and Responsibilities",
    description:
      "Covers assigning and announcing who is accountable for each part of privacy work.",
    category: "6",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "DPO",
      "data protection officer",
      "privacy officer",
      "privacy roles",
    ],
    severity: "HIGH",
  },

  // 7 — Planning
  {
    id: "7.2.1",
    name: "Privacy Risk Assessment",
    description:
      "Covers a repeatable method for spotting risks that personal-data handling creates.",
    category: "7",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy risk assessment",
      "PIA",
      "DPIA",
      "privacy impact assessment",
    ],
    severity: "HIGH",
  },
  {
    id: "7.2.5",
    name: "Privacy Objectives",
    description:
      "Expects measurable privacy targets, plus plans for reaching them, at each level.",
    category: "7",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy objectives",
      "privacy goals",
      "privacy KPIs",
      "privacy metrics",
    ],
    severity: "MEDIUM",
  },
  {
    id: "7.4",
    name: "Privacy by Design",
    description:
      "Covers building safeguards into products and processes by default, not bolting them on.",
    category: "7",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy by design",
      "data minimization",
      "privacy by default",
      "PbD",
    ],
    severity: "HIGH",
  },

  // 8 — Support
  {
    id: "8.2",
    name: "Privacy Competence",
    description:
      "Covers working out what privacy skills are needed for roles that affect personal data.",
    category: "8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy training",
      "privacy awareness",
      "competence",
      "privacy skills",
    ],
    severity: "MEDIUM",
  },
  {
    id: "8.4",
    name: "Privacy Communication",
    description:
      "Covers deciding what privacy information gets shared, with whom, when, and how.",
    category: "8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy communication",
      "privacy notices",
      "transparency",
      "disclosure",
    ],
    severity: "MEDIUM",
  },
  {
    id: "8.5",
    name: "Documented Information",
    description:
      "Covers keeping the records the privacy program needs to run and to be evidenced.",
    category: "8",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: ["documentation", "records", "data processing records", "ROPA"],
    severity: "MEDIUM",
  },

  // 9 — Operation
  {
    id: "9.2",
    name: "Privacy Impact Assessment",
    description:
      "Covers assessing impacts before starting processing that could seriously affect people.",
    category: "9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "DPIA",
      "privacy impact assessment",
      "PIA",
      "high risk processing",
    ],
    severity: "HIGH",
  },
  {
    id: "9.3",
    name: "Data Minimization",
    description:
      "Covers collecting and keeping only the personal data the stated purpose actually needs.",
    category: "9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data minimization",
      "purpose limitation",
      "data collection",
      "proportionality",
    ],
    severity: "HIGH",
  },
  {
    id: "9.4",
    name: "PII Accuracy",
    description:
      "Covers keeping personal data correct and current wherever that matters.",
    category: "9",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: [
      "data accuracy",
      "data quality",
      "data correction",
      "PII accuracy",
    ],
    severity: "MEDIUM",
  },
  {
    id: "9.5",
    name: "Retention and Disposal",
    description:
      "Covers time-limited retention followed by secure destruction of personal data.",
    category: "9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data retention",
      "data disposal",
      "retention schedule",
      "secure deletion",
    ],
    severity: "HIGH",
  },
  {
    id: "9.6",
    name: "Privacy Breach Response",
    description:
      "Covers procedures for spotting, escalating, and investigating privacy incidents.",
    category: "9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "repudiation"],
    keywords: [
      "data breach",
      "breach notification",
      "incident response",
      "privacy incident",
    ],
    severity: "CRITICAL",
  },

  // 10 — Performance Evaluation
  {
    id: "10.1",
    name: "Privacy Performance Monitoring",
    description:
      "Covers choosing which privacy processes, controls, and goals get measured.",
    category: "10",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy monitoring",
      "privacy metrics",
      "KPIs",
      "performance indicators",
    ],
    severity: "MEDIUM",
  },
  {
    id: "10.2",
    name: "Privacy Audit",
    description:
      "Expects scheduled internal audits testing whether the privacy program meets its requirements.",
    category: "10",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy audit",
      "internal audit",
      "compliance audit",
      "PIMS audit",
    ],
    severity: "HIGH",
  },
  {
    id: "10.3",
    name: "Management Review",
    description:
      "Expects leadership to revisit the privacy program regularly to confirm it still fits.",
    category: "10",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "management review",
      "privacy governance",
      "PIMS review",
      "executive oversight",
    ],
    severity: "MEDIUM",
  },

  // 11 — Improvement
  {
    id: "11.1",
    name: "Nonconformity and Corrective Action",
    description:
      "Covers containing, correcting, and following up on privacy failures when they occur.",
    category: "11",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "corrective action",
      "nonconformity",
      "privacy deficiency",
      "remediation",
    ],
    severity: "MEDIUM",
  },
  {
    id: "11.2",
    name: "Continual Improvement",
    description:
      "Covers steadily raising how well the privacy program fits and performs.",
    category: "11",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "continual improvement",
      "PIMS improvement",
      "privacy program maturity",
    ],
    severity: "LOW",
  },

  // 7PII-C — PII Controllers
  {
    id: "7.2.2",
    name: "Privacy Notice to PII Principals",
    description:
      "Expects people to be told plainly who holds their data, why, and what rights they have.",
    category: "7PII-C",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "privacy notice",
      "transparency",
      "data subject rights",
      "PII principal",
    ],
    severity: "HIGH",
  },
  {
    id: "7.3.1",
    name: "Lawful Basis for Processing",
    description:
      "Expects a recorded legal justification for every purpose personal data is used for.",
    category: "7PII-C",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "lawful basis",
      "legal basis",
      "consent",
      "legitimate interest",
      "legal obligation",
    ],
    severity: "CRITICAL",
  },
  {
    id: "7.3.2",
    name: "Consent Management",
    description:
      "Covers capturing and evidencing permission where consent is what justifies the processing.",
    category: "7PII-C",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "consent",
      "opt-in",
      "consent management",
      "withdrawal of consent",
    ],
    severity: "HIGH",
  },
  {
    id: "7.3.3",
    name: "Purpose Limitation",
    description:
      "Bars reusing personal data for new purposes unless the person concerned agrees.",
    category: "7PII-C",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "purpose limitation",
      "secondary use",
      "data use restriction",
      "purpose binding",
    ],
    severity: "HIGH",
  },
  {
    id: "7.3.6",
    name: "Data Subject Rights",
    description:
      "Covers giving people workable ways to see, fix, delete, move, or contest their data.",
    category: "7PII-C",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data subject rights",
      "right of access",
      "right to erasure",
      "right to portability",
      "right to object",
    ],
    severity: "HIGH",
  },
  {
    id: "7.5.1",
    name: "Third-Party Disclosure",
    description:
      "Expects a record of which outside parties receive personal data and for what reason.",
    category: "7PII-C",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "third-party sharing",
      "data disclosure",
      "data transfer",
      "recipients",
    ],
    severity: "HIGH",
  },

  // 8PII-P — PII Processors
  {
    id: "8.2.1",
    name: "Processing Under Contract",
    description:
      "Limits a handler to the documented instructions given by the organization that owns the data.",
    category: "8PII-P",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data processing agreement",
      "DPA",
      "processor obligations",
      "controller instructions",
    ],
    severity: "HIGH",
  },
  {
    id: "8.2.4",
    name: "Sub-Processor Management",
    description:
      "Bars bringing in downstream handlers without written approval from the data owner.",
    category: "8PII-P",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "sub-processor",
      "third-party processor",
      "supply chain",
      "vendor management",
    ],
    severity: "HIGH",
  },
  {
    id: "8.3.1",
    name: "Processing Records",
    description:
      "Covers keeping records of the handling activities performed for each client organization.",
    category: "8PII-P",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "processing records",
      "ROPA",
      "records of processing",
      "documentation",
    ],
    severity: "MEDIUM",
  },
  {
    id: "8.4.2",
    name: "Return or Deletion of PII",
    description:
      "Covers giving back or destroying personal data once the service ends, as the client directs.",
    category: "8PII-P",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "data deletion",
      "data return",
      "end of contract",
      "data lifecycle",
    ],
    severity: "HIGH",
  },
  {
    id: "8.5.6",
    name: "Processor Breach Notification",
    description:
      "Expects prompt alerting of the data owner when a handler discovers a privacy incident.",
    category: "8PII-P",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "repudiation"],
    keywords: [
      "breach notification",
      "data breach",
      "processor notification",
      "incident reporting",
    ],
    severity: "CRITICAL",
  },
];

// Populate categories with their controls
ISO_27701_CATEGORIES.forEach((category) => {
  category.controls = ISO_27701_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});
