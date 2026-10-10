/**
 * PDF template — threats table, components table, connections table
 */

import type { ExportThreat } from "../../types";
import { escapeHtml } from "../download";
import type { ComplianceFramework } from "@/features/threat-library/types";
import {
  STRIDE_ORDER,
  STRIDE_LABELS,
  SEVERITY_COLORS,
  FRAMEWORK_LABELS,
  FRAMEWORK_COLORS,
} from "./styles";

export {
  getComponentsTable,
  getConnectionsTable,
} from "./components-connections-table";

function getComplianceBadgesHtml(threat: ExportThreat): string {
  if (
    !threat.complianceControls ||
    Object.keys(threat.complianceControls).length === 0
  ) {
    return "";
  }

  const badges = Object.entries(threat.complianceControls)
    .filter(([, controls]) => controls && controls.length > 0)
    .map(([framework, controls]) => {
      const color =
        FRAMEWORK_COLORS[framework as ComplianceFramework] || "#6b7280";
      const label =
        FRAMEWORK_LABELS[framework as ComplianceFramework] || framework;
      return `<span class="compliance-badge" style="background: ${color}">${escapeHtml(`${label}: ${controls!.slice(0, 2).join(", ")}`)}${controls!.length > 2 ? "..." : ""}</span>`;
    })
    .join("");

  const refs: string[] = [];
  if (threat.cweIds?.length) {
    refs.push(
      ...threat.cweIds
        .slice(0, 2)
        .map((id) => `<span class="ref-badge">${escapeHtml(id)}</span>`),
    );
  }
  if (threat.owaspIds?.length) {
    refs.push(
      ...threat.owaspIds
        .slice(0, 2)
        .map((id) => `<span class="ref-badge">${escapeHtml(id)}</span>`),
    );
  }

  return `
    <div class="compliance-section">
      <div class="compliance-label">Compliance & References</div>
      <div class="compliance-badges">${badges}</div>
      ${refs.length > 0 ? `<div class="references">${refs.join("")}</div>` : ""}
    </div>
  `;
}

function getCitationAnchorsHtml(anchors?: string[]): string {
  if (!anchors || anchors.length === 0) return "";
  const list = anchors
    .slice(0, 6)
    .map(
      (a) =>
        `<code style="font-size:10px;background:#f3f4f6;padding:1px 4px;border-radius:3px;">${escapeHtml(a)}</code>`,
    )
    .join(" ");
  const more =
    anchors.length > 6
      ? ` <span style="color:#9ca3af;font-size:10px;">+${anchors.length - 6} more</span>`
      : "";
  return `<div style="margin-top:4px;font-size:11px;color:#6b7280;">Sources: ${list}${more}</div>`;
}

function getVerificationBadgeHtml(
  status?: ExportThreat["verificationStatus"],
): string {
  if (!status || status === "VERIFIED" || status === "EXEMPT") return "";
  const label =
    status === "UNVERIFIED"
      ? "⚠ UNVERIFIED"
      : status === "PHANTOM"
        ? "✗ PHANTOM CITATION"
        : "⋯ Pending verification";
  const bg =
    status === "PHANTOM"
      ? "#dc2626"
      : status === "UNVERIFIED"
        ? "#d97706"
        : "#6b7280";
  return `<span class="badge" style="background: ${bg}; color: white; margin-left: 4px;">${label}</span>`;
}

function getThreatCard(threat: ExportThreat): string {
  const mitigationsHtml =
    threat.mitigations.length > 0
      ? `<div class="mitigations">
        <strong style="font-size: 12px;">Mitigations:</strong>
        ${threat.mitigations
          .map(
            (m) => `
          <div class="mitigation">
            <span style="color: ${m.status === "IMPLEMENTED" ? "#059669" : "#6b7280"}">
              ${m.status === "IMPLEMENTED" ? "✓" : "○"}
            </span>
            ${escapeHtml(m.description)}
            <span style="color: #9ca3af; font-size: 11px;">(${escapeHtml(m.priority)})</span>
          </div>
        `,
          )
          .join("")}
      </div>`
      : "";

  return `
    <div class="threat-card">
      <div class="threat-header">
        <div>
          <div class="threat-name">${escapeHtml(threat.name)}</div>
          ${threat.description ? `<div class="threat-desc">${escapeHtml(threat.description)}</div>` : ""}
        </div>
        <div>
          <span class="badge severity" style="background: ${SEVERITY_COLORS[threat.severity] || "#6b7280"}">${escapeHtml(threat.severity)}</span>
          <span class="badge status-${threat.status.toLowerCase().replace("_", "-")}">${escapeHtml(threat.status)}</span>
          ${getVerificationBadgeHtml(threat.verificationStatus)}
        </div>
      </div>
      ${getComplianceBadgesHtml(threat)}
      ${getCitationAnchorsHtml(threat.citationAnchors)}
      ${mitigationsHtml}
    </div>
  `;
}

export function getThreatsByCategory(threats: ExportThreat[]): string {
  const byCategory: Record<string, ExportThreat[]> = {};
  threats.forEach((threat) => {
    threat.strideCategories.forEach((cat) => {
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(threat);
    });
  });

  return STRIDE_ORDER.filter((cat) => byCategory[cat]?.length)
    .map(
      (cat) => `
      <h3>${STRIDE_LABELS[cat]} (${byCategory[cat].length})</h3>
      ${byCategory[cat].map(getThreatCard).join("")}
    `,
    )
    .join("");
}

export function getThreatSummaryTable(threats: ExportThreat[]): string {
  const rows = threats
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.name)}</td>
        <td>${t.strideCategories.map((c) => c[0]).join("")}</td>
        <td><span class="badge severity" style="background: ${SEVERITY_COLORS[t.severity] || "#6b7280"}">${t.severity}</span></td>
        <td><span class="badge status-${t.status.toLowerCase().replace("_", "-")}">${t.status}</span></td>
        <td>${t.mitigations.filter((m) => m.status === "IMPLEMENTED").length}/${t.mitigations.length}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <h2>Threat Summary</h2>
    <table>
      <thead><tr><th>Threat</th><th>STRIDE</th><th>Severity</th><th>Status</th><th>Mitigations</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
