/**
 * Compliance Framework Constants
 *
 * Defines compliance frameworks and their control mappings to STRIDE categories.
 */
import type { StrideCategory } from "@/types/canvas";
import type { ComplianceFramework, ComplianceControls } from "../types";

/** Compliance framework metadata */
export interface FrameworkInfo {
  id: ComplianceFramework;
  name: string;
  shortName: string;
  description: string;
  url: string;
  color: string;
}

/** All supported compliance frameworks */
export const COMPLIANCE_FRAMEWORKS: FrameworkInfo[] = [
  {
    id: "SOC2",
    name: "SOC 2 Type II",
    shortName: "SOC 2",
    description: "Service Organization Control 2 - Trust Services Criteria",
    url: "https://www.aicpa-cima.com/topic/system-and-organization-controls-soc",
    color: "bg-blue-500",
  },
  {
    id: "ISO27001",
    name: "ISO/IEC 27001:2022",
    shortName: "ISO 27001",
    description: "Information Security Management System",
    url: "https://www.iso.org/iso-27001-information-security.html",
    color: "bg-green-500",
  },
  {
    id: "NIST_CSF",
    name: "NIST Cybersecurity Framework",
    shortName: "NIST CSF",
    description:
      "Framework for Improving Critical Infrastructure Cybersecurity",
    url: "https://www.nist.gov/cyberframework",
    color: "bg-purple-500",
  },
  {
    id: "NIST_800_53",
    name: "NIST SP 800-53 Rev 5",
    shortName: "NIST 800-53",
    description: "Security and Privacy Controls for Information Systems",
    url: "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
    color: "bg-indigo-500",
  },
  {
    id: "FIPS_140",
    name: "FIPS 140-3",
    shortName: "FIPS 140",
    description: "Security Requirements for Cryptographic Modules",
    url: "https://csrc.nist.gov/publications/detail/fips/140/3/final",
    color: "bg-violet-500",
  },
  {
    id: "FIPS_199",
    name: "FIPS 199",
    shortName: "FIPS 199",
    description: "Standards for Security Categorization of Federal Information",
    url: "https://csrc.nist.gov/publications/detail/fips/199/final",
    color: "bg-fuchsia-500",
  },
  {
    id: "FEDRAMP",
    name: "FedRAMP",
    shortName: "FedRAMP",
    description: "Federal Risk and Authorization Management Program",
    url: "https://www.fedramp.gov/",
    color: "bg-sky-500",
  },
  {
    id: "PCI_DSS",
    name: "PCI DSS v4.0",
    shortName: "PCI DSS",
    description: "Payment Card Industry Data Security Standard",
    url: "https://www.pcisecuritystandards.org/",
    color: "bg-yellow-500",
  },
  {
    id: "HIPAA",
    name: "HIPAA Security Rule",
    shortName: "HIPAA",
    description: "Health Insurance Portability and Accountability Act",
    url: "https://www.hhs.gov/hipaa/index.html",
    color: "bg-red-500",
  },
  {
    id: "GDPR",
    name: "GDPR",
    shortName: "GDPR",
    description: "General Data Protection Regulation",
    url: "https://gdpr.eu/",
    color: "bg-cyan-500",
  },
  {
    id: "CIS_CONTROLS",
    name: "CIS Controls v8",
    shortName: "CIS",
    description: "Center for Internet Security Critical Security Controls",
    url: "https://www.cisecurity.org/controls",
    color: "bg-orange-500",
  },
  {
    id: "OWASP_ASVS",
    name: "OWASP ASVS 4.0",
    shortName: "ASVS",
    description: "Application Security Verification Standard",
    url: "https://owasp.org/www-project-application-security-verification-standard/",
    color: "bg-rose-500",
  },
];

/**
 * STRIDE to Compliance Controls Mapping
 *
 * Maps each STRIDE category to relevant controls in each framework.
 * This provides default mappings - individual threats can override.
 */
export const STRIDE_TO_COMPLIANCE: Record<StrideCategory, ComplianceControls> =
  {
    SPOOFING: {
      SOC2: ["CC6.1", "CC6.2", "CC6.3", "CC6.6"],
      ISO27001: ["A.5.15", "A.5.16", "A.5.17", "A.8.2", "A.8.5"],
      NIST_CSF: ["PR.AC-1", "PR.AC-3", "PR.AC-4", "PR.AC-7"],
      NIST_800_53: ["IA-1", "IA-2", "IA-3", "IA-4", "IA-5", "IA-8"],
      FIPS_140: ["AS.01", "AS.02", "AS.03"],
      FIPS_199: ["SC-1", "SC-2"],
      FEDRAMP: ["IA-2", "IA-5", "IA-8"],
      PCI_DSS: ["8.1", "8.2", "8.3", "8.6"],
      HIPAA: ["164.312(d)", "164.312(a)(1)"],
      GDPR: ["Art.5(1)(f)", "Art.32(1)(b)"],
      CIS_CONTROLS: ["5.1", "5.2", "5.3", "6.1", "6.2"],
      OWASP_ASVS: ["2.1", "2.2", "2.3", "2.4", "2.5"],
    },
    TAMPERING: {
      SOC2: ["CC6.1", "CC6.6", "CC6.7", "CC7.1", "CC7.2"],
      ISO27001: ["A.5.33", "A.8.3", "A.8.9", "A.8.24", "A.8.32"],
      NIST_CSF: ["PR.DS-1", "PR.DS-2", "PR.DS-6", "DE.CM-4"],
      NIST_800_53: ["SI-7", "SI-10", "SC-8", "SC-13", "AU-10"],
      FIPS_140: ["KM.01", "KM.02", "TE.01"],
      FIPS_199: ["SC-3", "IA-1"],
      FEDRAMP: ["SI-7", "SC-8", "SC-13"],
      PCI_DSS: ["10.5", "11.5", "12.10"],
      HIPAA: ["164.312(c)(1)", "164.312(e)(2)(i)"],
      GDPR: ["Art.5(1)(f)", "Art.32(1)(b)"],
      CIS_CONTROLS: ["3.1", "3.2", "3.4", "10.1", "10.2"],
      OWASP_ASVS: ["5.1", "5.2", "5.3", "6.1", "6.2"],
    },
    REPUDIATION: {
      SOC2: ["CC4.1", "CC4.2", "CC7.2", "CC7.3"],
      ISO27001: ["A.5.33", "A.8.15", "A.8.17"],
      NIST_CSF: ["PR.DS-6", "DE.AE-3", "RS.AN-1"],
      NIST_800_53: ["AU-2", "AU-3", "AU-8", "AU-10", "AU-12"],
      FIPS_140: ["TE.02", "TE.03"],
      FIPS_199: ["IA-2", "AU-1"],
      FEDRAMP: ["AU-2", "AU-3", "AU-12"],
      PCI_DSS: ["10.1", "10.2", "10.3", "10.4", "10.5"],
      HIPAA: ["164.312(b)", "164.308(a)(1)(ii)(D)"],
      GDPR: ["Art.5(2)", "Art.30"],
      CIS_CONTROLS: ["8.1", "8.2", "8.5", "8.11"],
      OWASP_ASVS: ["7.1", "7.2", "7.3", "7.4"],
    },
    INFORMATION_DISCLOSURE: {
      SOC2: ["CC6.1", "CC6.6", "CC6.7", "CC9.2"],
      ISO27001: ["A.5.12", "A.5.13", "A.5.14", "A.8.10", "A.8.11", "A.8.12"],
      NIST_CSF: ["PR.AC-4", "PR.DS-1", "PR.DS-2", "PR.DS-5", "PR.IP-6"],
      NIST_800_53: ["AC-3", "AC-4", "SC-8", "SC-13", "SC-28"],
      FIPS_140: ["KM.03", "TE.01", "TE.02"],
      FIPS_199: ["SC-1", "SC-2", "SC-3"],
      FEDRAMP: ["AC-3", "SC-8", "SC-13", "SC-28"],
      PCI_DSS: ["3.4", "4.1", "7.1", "7.2", "8.7"],
      HIPAA: ["164.312(a)(1)", "164.312(e)(1)", "164.312(e)(2)(ii)"],
      GDPR: ["Art.5(1)(f)", "Art.25", "Art.32"],
      CIS_CONTROLS: ["3.3", "3.10", "3.11", "3.12"],
      OWASP_ASVS: ["6.1", "6.2", "8.1", "8.2", "8.3"],
    },
    DENIAL_OF_SERVICE: {
      SOC2: ["CC6.6", "CC7.4", "CC7.5", "A1.1", "A1.2"],
      ISO27001: ["A.5.29", "A.5.30", "A.8.6", "A.8.13", "A.8.14"],
      NIST_CSF: ["PR.DS-4", "PR.IP-9", "PR.PT-5", "DE.CM-1"],
      NIST_800_53: ["SC-5", "CP-2", "CP-7", "CP-9", "CP-10"],
      FIPS_140: ["EM.01", "EM.02"],
      FIPS_199: ["AV-1", "AV-2"],
      FEDRAMP: ["SC-5", "CP-2", "CP-7", "CP-9"],
      PCI_DSS: ["6.6", "11.4", "12.10"],
      HIPAA: ["164.308(a)(7)", "164.310(a)(2)(i)"],
      GDPR: ["Art.32(1)(b)", "Art.32(1)(c)"],
      CIS_CONTROLS: ["9.1", "9.2", "11.1", "11.2"],
      OWASP_ASVS: ["10.1", "10.2", "11.1"],
    },
    ELEVATION_OF_PRIVILEGE: {
      SOC2: ["CC6.1", "CC6.2", "CC6.3", "CC6.6"],
      ISO27001: ["A.5.15", "A.5.18", "A.8.2", "A.8.3", "A.8.18"],
      NIST_CSF: ["PR.AC-1", "PR.AC-4", "PR.AC-6", "DE.CM-3"],
      NIST_800_53: ["AC-2", "AC-3", "AC-5", "AC-6", "CM-7"],
      FIPS_140: ["AS.01", "AS.02", "RO.01"],
      FIPS_199: ["AC-1", "AC-2"],
      FEDRAMP: ["AC-2", "AC-3", "AC-5", "AC-6"],
      PCI_DSS: ["7.1", "7.2", "8.1", "8.5"],
      HIPAA: ["164.312(a)(1)", "164.308(a)(3)", "164.308(a)(4)"],
      GDPR: ["Art.5(1)(f)", "Art.25(2)", "Art.32(1)(b)"],
      CIS_CONTROLS: ["4.1", "4.2", "4.7", "5.4", "6.5"],
      OWASP_ASVS: ["1.4", "4.1", "4.2", "4.3"],
    },
  };
