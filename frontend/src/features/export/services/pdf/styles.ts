/**
 * PDF template — shared styles and constants
 */

import type { ComplianceFramework } from "@/features/threat-library/types";

export const STRIDE_ORDER = [
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
];

export const STRIDE_LABELS: Record<string, string> = {
  SPOOFING: "Spoofing",
  TAMPERING: "Tampering",
  REPUDIATION: "Repudiation",
  INFORMATION_DISCLOSURE: "Information Disclosure",
  DENIAL_OF_SERVICE: "Denial of Service",
  ELEVATION_OF_PRIVILEGE: "Elevation of Privilege",
};

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
};

export const FRAMEWORK_LABELS: Record<ComplianceFramework, string> = {
  SOC2: "SOC 2",
  ISO27001: "ISO 27001",
  NIST_CSF: "NIST CSF",
  NIST_800_53: "NIST 800-53",
  FIPS_140: "FIPS 140-3",
  FIPS_199: "FIPS 199",
  PCI_DSS: "PCI DSS",
  HIPAA: "HIPAA",
  GDPR: "GDPR",
  CIS_CONTROLS: "CIS Controls",
  OWASP_ASVS: "OWASP ASVS",
  FEDRAMP: "FedRAMP",
};

export const FRAMEWORK_COLORS: Record<ComplianceFramework, string> = {
  SOC2: "#3b82f6",
  ISO27001: "#10b981",
  NIST_CSF: "#8b5cf6",
  NIST_800_53: "#6366f1",
  FIPS_140: "#8b5cf6",
  FIPS_199: "#a855f7",
  PCI_DSS: "#f59e0b",
  HIPAA: "#ef4444",
  GDPR: "#06b6d4",
  CIS_CONTROLS: "#14b8a6",
  OWASP_ASVS: "#f97316",
  FEDRAMP: "#0891b2",
};

/** Generate PDF styles */
export function getStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin: 24px 0 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h3 { font-size: 16px; margin: 16px 0 8px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; }
    .summary-card .value { font-size: 32px; font-weight: bold; }
    .summary-card .label { font-size: 12px; color: #6b7280; }
    .diagram { margin: 24px 0; text-align: center; page-break-inside: avoid; }
    .diagram img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .severity { color: white; }
    .status-open { background: #fef3c7; color: #92400e; }
    .status-mitigated { background: #d1fae5; color: #065f46; }
    .status-accepted { background: #dbeafe; color: #1e40af; }
    .threat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0; page-break-inside: avoid; }
    .threat-header { display: flex; justify-content: space-between; align-items: start; }
    .threat-name { font-weight: 600; }
    .threat-desc { color: #6b7280; font-size: 13px; margin-top: 4px; }
    .mitigations { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    .mitigation { background: #f9fafb; padding: 8px 12px; border-radius: 4px; margin: 4px 0; font-size: 13px; }
    .compliance-section { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6; }
    .compliance-label { font-size: 11px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
    .compliance-badges { display: flex; flex-wrap: wrap; gap: 4px; }
    .compliance-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; color: white; }
    .references { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .ref-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; background: #f3f4f6; color: #374151; }
    .compliance-summary { margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .compliance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px; }
    .compliance-framework { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
    .compliance-framework h4 { font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .compliance-framework ul { list-style: none; font-size: 12px; color: #6b7280; }
    .compliance-framework li { padding: 2px 0; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  `;
}
