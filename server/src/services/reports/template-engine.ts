/**
 * Report Template Engine
 *
 * Generates customizable reports from threat model data.
 * Supports variable interpolation, conditional sections,
 * and multiple output formats.
 *
 * Enterprise requirement: "We need reports in OUR format"
 */
import logger from "../../utils/logger.js";
import type { ReportBranding } from "./branding.js";
import { escapeHtml } from "../../utils/html-escape.js";

// =============================================================================
// Types
// =============================================================================

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  format: "html" | "markdown" | "json" | "csv";
  sections: ReportSection[];
  branding?: {
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
    footerText?: string;
  };
}

interface ReportSection {
  title: string;
  type:
    | "text"
    | "summary"
    | "threat_table"
    | "mitigation_table"
    | "severity_chart"
    | "stride_chart"
    | "compliance_mapping"
    | "component_list"
    | "risk_matrix"
    | "custom";
  includeIf?: string; // e.g., "totalThreats > 0"
  content?: string; // For "text" type — supports {{variables}}
  options?: Record<string, unknown>;
}

export interface ReportData {
  modelName: string;
  modelDescription?: string;
  generatedAt: string;
  generatedBy?: string;
  /** Org logo + colours (DOCX/HTML); absent = ThreatForge defaults */
  branding?: ReportBranding;
  components: Array<{
    name: string;
    type: string;
    trustLevel?: string;
    threatCount: number;
  }>;
  connections: Array<{
    source: string;
    target: string;
    protocol?: string;
    encrypted?: boolean;
  }>;
  threats: Array<{
    name: string;
    description?: string;
    severity: string;
    status: string;
    strideCategory: string;
    componentName?: string;
    mitigationCount: number;
  }>;
  mitigations: Array<{
    description: string;
    status: string;
    priority: string;
    threatName: string;
  }>;
  complianceMappings?: Array<{
    framework: string;
    controlId: string;
    coverage: string;
  }>;
  summary: {
    totalComponents: number;
    totalConnections: number;
    totalThreats: number;
    threatsBySeverity: Record<string, number>;
    threatsByStride: Record<string, number>;
    threatsByStatus: Record<string, number>;
    mitigationRate: number;
    riskScore?: number;
  };
}

// =============================================================================
// Built-in Templates
// =============================================================================

export const BUILTIN_TEMPLATES: ReportTemplate[] = [
  {
    id: "executive-summary",
    name: "Executive Summary",
    description: "1-page overview for board/leadership",
    format: "html",
    sections: [
      { title: "Executive Summary", type: "summary" },
      { title: "Risk Overview", type: "severity_chart" },
      {
        title: "Critical Findings",
        type: "threat_table",
        options: { severityFilter: "CRITICAL" },
      },
      {
        title: "Recommendations",
        type: "text",
        content: "{{recommendations}}",
      },
    ],
  },
  {
    id: "full-assessment",
    name: "Full Security Assessment",
    description: "Complete threat model report with all findings",
    format: "html",
    sections: [
      { title: "Executive Summary", type: "summary" },
      { title: "Scope", type: "component_list" },
      { title: "Risk Matrix", type: "risk_matrix" },
      { title: "Findings by Severity", type: "threat_table" },
      { title: "STRIDE Analysis", type: "stride_chart" },
      { title: "Mitigations", type: "mitigation_table" },
      {
        title: "Compliance Mapping",
        type: "compliance_mapping",
        includeIf: "complianceMappings.length > 0",
      },
    ],
  },
  {
    id: "compliance-evidence",
    name: "Compliance Evidence Package",
    description: "Audit-ready evidence for SOC2/HIPAA/PCI",
    format: "html",
    sections: [
      { title: "Assessment Overview", type: "summary" },
      { title: "Compliance Control Mapping", type: "compliance_mapping" },
      { title: "Identified Threats", type: "threat_table" },
      { title: "Mitigation Status", type: "mitigation_table" },
      {
        title: "Verification Evidence",
        type: "text",
        content:
          "Threats identified: {{totalThreats}}. Mitigated: {{mitigationRate}}%. Last assessed: {{generatedAt}}.",
      },
    ],
  },
  {
    id: "developer-handoff",
    name: "Developer Handoff",
    description: "Technical findings for the dev team to fix",
    format: "markdown",
    sections: [
      { title: "Threat Summary", type: "summary" },
      {
        title: "Open Findings",
        type: "threat_table",
        options: { statusFilter: "OPEN" },
      },
      {
        title: "Remediation Tasks",
        type: "mitigation_table",
        options: { statusFilter: "PLANNED,IN_PROGRESS" },
      },
    ],
  },
  {
    id: "risk-register-csv",
    name: "Risk Register (CSV)",
    description: "Import into GRC tools or spreadsheets",
    format: "csv",
    sections: [{ title: "Risk Register", type: "threat_table" }],
  },
];

// =============================================================================
// Template Engine
// =============================================================================

/**
 * Generate a report from a template and data.
 */
export function generateReport(
  template: ReportTemplate,
  data: ReportData,
): string {
  logger.info(
    {
      template: template.id,
      format: template.format,
      threats: data.summary.totalThreats,
    },
    "Generating report",
  );

  switch (template.format) {
    case "csv":
      return generateCSV(data);
    case "markdown":
      return generateMarkdown(template, data);
    case "json":
      return JSON.stringify(data, null, 2);
    case "html":
    default:
      return generateHTML(template, data);
  }
}

// =============================================================================
// Generators
// =============================================================================

function generateCSV(data: ReportData): string {
  const headers = [
    "ID",
    "Threat",
    "Severity",
    "Status",
    "STRIDE Category",
    "Component",
    "Description",
    "Mitigations",
  ];

  const rows = data.threats.map((t, i) => [
    `T-${String(i + 1).padStart(3, "0")}`,
    t.name,
    t.severity,
    t.status,
    t.strideCategory,
    t.componentName || "",
    `"${(t.description || "").replace(/"/g, '""')}"`,
    t.mitigationCount,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function generateMarkdown(template: ReportTemplate, data: ReportData): string {
  const lines: string[] = [`# ${data.modelName} — ${template.name}`, ""];
  lines.push(`*Generated: ${data.generatedAt}*`, "");

  for (const section of template.sections) {
    if (!shouldInclude(section, data)) continue;

    lines.push(`## ${section.title}`, "");

    switch (section.type) {
      case "summary":
        lines.push(
          `- **Components:** ${data.summary.totalComponents}`,
          `- **Connections:** ${data.summary.totalConnections}`,
          `- **Threats:** ${data.summary.totalThreats} (${data.summary.threatsBySeverity.CRITICAL || 0} critical, ${data.summary.threatsBySeverity.HIGH || 0} high)`,
          `- **Mitigation Rate:** ${data.summary.mitigationRate}%`,
          "",
        );
        break;

      case "threat_table": {
        const threats = filterThreats(data.threats, section.options);
        lines.push(
          "| Severity | Threat | STRIDE | Component | Status |",
          "|----------|--------|--------|-----------|--------|",
        );
        for (const t of threats) {
          lines.push(
            `| ${t.severity} | ${t.name} | ${t.strideCategory} | ${t.componentName || "-"} | ${t.status} |`,
          );
        }
        lines.push("");
        break;
      }

      case "mitigation_table": {
        const mits = filterMitigations(data.mitigations, section.options);
        lines.push(
          "| Priority | Mitigation | Status | Threat |",
          "|----------|-----------|--------|--------|",
        );
        for (const m of mits) {
          lines.push(
            `| ${m.priority} | ${m.description} | ${m.status} | ${m.threatName} |`,
          );
        }
        lines.push("");
        break;
      }

      case "component_list":
        lines.push(
          "| Component | Type | Trust Level | Threats |",
          "|-----------|------|------------|---------|",
        );
        for (const c of data.components) {
          lines.push(
            `| ${c.name} | ${c.type} | ${c.trustLevel || "-"} | ${c.threatCount} |`,
          );
        }
        lines.push("");
        break;

      case "text":
        lines.push(interpolate(section.content || "", data), "");
        break;

      default:
        lines.push(`*[${section.type} visualization]*`, "");
    }
  }

  return lines.join("\n");
}

function generateHTML(template: ReportTemplate, data: ReportData): string {
  // Generate markdown then wrap in basic HTML structure
  const md = generateMarkdown(template, data);

  // Every value below can come from users or the AI, so it is escaped (or
  // validated) before it reaches the HTML.
  const requestedColor =
    data.branding?.primaryColor || template.branding?.primaryColor || "";
  const brandColor = /^#[0-9a-f]{3,8}$/i.test(requestedColor)
    ? requestedColor
    : "#2563eb";
  const requestedLogo = data.branding?.logoDataUrl;
  const logo =
    requestedLogo &&
    /^data:image\/(png|jpeg|gif|webp);base64,/.test(requestedLogo)
      ? escapeHtml(requestedLogo)
      : undefined;
  const company = escapeHtml(template.branding?.companyName || "");
  const footer = escapeHtml(
    template.branding?.footerText || "Generated by ThreatForge",
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(`${data.modelName} — ${template.name}`)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
    h1 { color: ${brandColor}; border-bottom: 2px solid ${brandColor}; padding-bottom: 0.5rem; }
    h2 { color: #333; margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; font-size: 0.9rem; }
    th { background: #f5f5f5; font-weight: 600; }
    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.8rem; color: #666; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${logo ? `<img src="${logo}" alt="Organization logo" style="max-height: 60px; max-width: 200px;">` : ""}
  ${company ? `<p style="color: #666; font-size: 0.9rem;">${company}</p>` : ""}
  ${markdownToHTML(escapeHtml(md))}
  <div class="footer">${footer} — ${escapeHtml(data.generatedAt)}</div>
</body>
</html>`;
}

// =============================================================================
// Helpers
// =============================================================================

function shouldInclude(section: ReportSection, data: ReportData): boolean {
  if (!section.includeIf) return true;
  // Simple eval — only supports "field > N" and "field.length > N"
  try {
    if (section.includeIf.includes("totalThreats")) {
      return data.summary.totalThreats > 0;
    }
    if (section.includeIf.includes("complianceMappings")) {
      return (data.complianceMappings?.length || 0) > 0;
    }
    return true;
  } catch {
    return true;
  }
}

function interpolate(template: string, data: ReportData): string {
  return template
    .replace(/\{\{totalThreats\}\}/g, String(data.summary.totalThreats))
    .replace(/\{\{mitigationRate\}\}/g, String(data.summary.mitigationRate))
    .replace(/\{\{generatedAt\}\}/g, data.generatedAt)
    .replace(/\{\{modelName\}\}/g, data.modelName)
    .replace(/\{\{totalComponents\}\}/g, String(data.summary.totalComponents))
    .replace(/\{\{recommendations\}\}/g, generateRecommendations(data));
}

function generateRecommendations(data: ReportData): string {
  const recs: string[] = [];
  const { threatsBySeverity, mitigationRate } = data.summary;

  if ((threatsBySeverity.CRITICAL || 0) > 0)
    recs.push(
      `Address ${threatsBySeverity.CRITICAL} CRITICAL threats immediately.`,
    );
  if ((threatsBySeverity.HIGH || 0) > 0)
    recs.push(
      `Schedule remediation for ${threatsBySeverity.HIGH} HIGH severity threats.`,
    );
  if (mitigationRate < 50)
    recs.push(
      `Mitigation rate is ${mitigationRate}% — prioritize threat remediation.`,
    );
  if (mitigationRate >= 80)
    recs.push(
      `Strong mitigation rate (${mitigationRate}%). Focus on verification.`,
    );

  return recs.length > 0
    ? recs.join(" ")
    : "Continue monitoring and periodic reassessment.";
}

function filterThreats(
  threats: ReportData["threats"],
  options?: Record<string, unknown>,
): ReportData["threats"] {
  if (!options) return threats;
  let filtered = threats;
  if (options.severityFilter) {
    filtered = filtered.filter((t) => t.severity === options.severityFilter);
  }
  if (options.statusFilter) {
    const statuses = String(options.statusFilter).split(",");
    filtered = filtered.filter((t) => statuses.includes(t.status));
  }
  return filtered;
}

function filterMitigations(
  mitigations: ReportData["mitigations"],
  options?: Record<string, unknown>,
): ReportData["mitigations"] {
  if (!options) return mitigations;
  let filtered = mitigations;
  if (options.statusFilter) {
    const statuses = String(options.statusFilter).split(",");
    filtered = filtered.filter((m) => statuses.includes(m.status));
  }
  return filtered;
}

function markdownToHTML(md: string): string {
  // Minimal markdown → HTML (tables, headers, bold, lists)
  return md
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^\*\*(.+?)\*\*/gm, "<strong>$1</strong>")
    .replace(/^\*(.+)\*$/gm, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match
        .split("|")
        .filter(Boolean)
        .map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return ""; // Skip separator row
      const tag = match.includes("---") ? "th" : "td";
      return `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, (match) => `<table>${match}</table>`)
    .replace(/\n\n/g, "<br><br>");
}
