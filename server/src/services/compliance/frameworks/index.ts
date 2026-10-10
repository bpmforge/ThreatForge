/**
 * Compliance Frameworks Index
 *
 * Exports all compliance framework definitions.
 */

import type {
  ComplianceFramework,
  ControlCategory,
  ComplianceControl,
} from "../types.js";
import { SOC2_CATEGORIES, SOC2_CONTROLS } from "./soc2.js";
import { NIST_CSF_CATEGORIES, NIST_CSF_CONTROLS } from "./nist-csf.js";
import { ISO27001_CATEGORIES, ISO27001_CONTROLS } from "./iso27001.js";
import { OWASP_ASVS_CATEGORIES, OWASP_ASVS_CONTROLS } from "./owasp-asvs.js";
import { CMMC_CATEGORIES, CMMC_CONTROLS } from "./cmmc.js";
import {
  NIST_800_171_CATEGORIES,
  NIST_800_171_CONTROLS,
} from "./nist-800-171.js";
import { ISO_27701_CATEGORIES, ISO_27701_CONTROLS } from "./iso-27701.js";
import { CCPA_CATEGORIES, CCPA_CONTROLS } from "./ccpa.js";
import { HIPAA_CATEGORIES, HIPAA_CONTROLS } from "./hipaa.js";
import { PCI_DSS_CATEGORIES, PCI_DSS_CONTROLS } from "./pci-dss.js";
import { NIST_800_53_CATEGORIES, NIST_800_53_CONTROLS } from "./nist-800-53.js";
import { FDA_CYBER_CATEGORIES, FDA_CYBER_CONTROLS } from "./fda-cyber.js";

/**
 * Get categories for a framework.
 */
export function getFrameworkCategories(
  framework: ComplianceFramework,
): ControlCategory[] {
  switch (framework) {
    case "SOC2":
      return SOC2_CATEGORIES;
    case "NIST_CSF":
      return NIST_CSF_CATEGORIES;
    case "ISO27001":
      return ISO27001_CATEGORIES;
    case "OWASP_ASVS":
      return OWASP_ASVS_CATEGORIES;
    case "CMMC":
      return CMMC_CATEGORIES;
    case "NIST_800_171":
      return NIST_800_171_CATEGORIES;
    case "ISO_27701":
      return ISO_27701_CATEGORIES;
    case "CCPA":
      return CCPA_CATEGORIES;
    case "HIPAA":
      return HIPAA_CATEGORIES;
    case "PCI_DSS":
      return PCI_DSS_CATEGORIES;
    case "NIST_800_53":
      return NIST_800_53_CATEGORIES;
    case "FDA_CYBER":
      return FDA_CYBER_CATEGORIES;
    default:
      return [];
  }
}

/**
 * Get all controls for a framework.
 */
export function getFrameworkControls(
  framework: ComplianceFramework,
): ComplianceControl[] {
  switch (framework) {
    case "SOC2":
      return SOC2_CONTROLS;
    case "NIST_CSF":
      return NIST_CSF_CONTROLS;
    case "ISO27001":
      return ISO27001_CONTROLS;
    case "OWASP_ASVS":
      return OWASP_ASVS_CONTROLS;
    case "CMMC":
      return CMMC_CONTROLS;
    case "NIST_800_171":
      return NIST_800_171_CONTROLS;
    case "ISO_27701":
      return ISO_27701_CONTROLS;
    case "CCPA":
      return CCPA_CONTROLS;
    case "HIPAA":
      return HIPAA_CONTROLS;
    case "PCI_DSS":
      return PCI_DSS_CONTROLS;
    case "NIST_800_53":
      return NIST_800_53_CONTROLS;
    case "FDA_CYBER":
      return FDA_CYBER_CONTROLS;
    default:
      return [];
  }
}

/**
 * Get framework display name.
 */
export function getFrameworkDisplayName(
  framework: ComplianceFramework,
): string {
  const names: Record<ComplianceFramework, string> = {
    SOC2: "SOC 2 Type II",
    ISO27001: "ISO 27001:2022",
    NIST_CSF: "NIST CSF 2.0",
    PCI_DSS: "PCI DSS 4.0",
    HIPAA: "HIPAA Security Rule",
    GDPR: "GDPR",
    CIS_CONTROLS: "CIS Controls v8",
    OWASP_ASVS: "OWASP ASVS 4.0",
    CUSTOM: "Custom Framework",
    NIST_800_53: "NIST SP 800-53",
    FIPS_140: "FIPS 140-3",
    FIPS_199: "FIPS 199",
    FEDRAMP: "FedRAMP",
    CMMC: "CMMC 2.0",
    NIST_800_171: "NIST SP 800-171",
    ISO_27701: "ISO 27701:2019",
    CCPA: "CCPA/CPRA",
    FDA_CYBER: "FDA Cybersecurity in Medical Devices",
  };
  return names[framework] || framework;
}

/**
 * Get supported frameworks.
 */
export function getSupportedFrameworks(): ComplianceFramework[] {
  return [
    "SOC2",
    "NIST_CSF",
    "ISO27001",
    "OWASP_ASVS",
    "CMMC",
    "NIST_800_171",
    "ISO_27701",
    "CCPA",
    "HIPAA",
    "PCI_DSS",
    "NIST_800_53",
    "FDA_CYBER",
  ];
}
