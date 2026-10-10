/**
 * PDF template — compliance / mitigations summary section
 */

import type { ExportThreat } from "../../types";
import { escapeHtml } from "../download";
import type { ComplianceFramework } from "@/features/threat-library/types";
import { FRAMEWORK_LABELS, FRAMEWORK_COLORS } from "./styles";

/** Generate compliance summary section */
export function getComplianceSummary(threats: ExportThreat[]): string {
  // Aggregate all compliance controls from threats
  const frameworkControls: Record<string, Set<string>> = {};

  threats.forEach((threat) => {
    if (threat.complianceControls) {
      Object.entries(threat.complianceControls).forEach(
        ([framework, controls]) => {
          if (controls && controls.length > 0) {
            if (!frameworkControls[framework]) {
              frameworkControls[framework] = new Set();
            }
            controls.forEach((c) => frameworkControls[framework].add(c));
          }
        },
      );
    }
  });

  const frameworks = Object.keys(frameworkControls);
  if (frameworks.length === 0) {
    return "";
  }

  const frameworkCards = frameworks
    .map((framework) => {
      const controls = Array.from(frameworkControls[framework]).sort();
      const color =
        FRAMEWORK_COLORS[framework as ComplianceFramework] || "#6b7280";
      const label =
        FRAMEWORK_LABELS[framework as ComplianceFramework] || framework;
      return `
        <div class="compliance-framework">
          <h4>
            <span class="compliance-badge" style="background: ${color}">${escapeHtml(label)}</span>
            <span style="color: #6b7280; font-size: 12px;">${controls.length} controls</span>
          </h4>
          <ul>
            ${controls
              .slice(0, 8)
              .map((c) => `<li>${escapeHtml(c)}</li>`)
              .join("")}
            ${controls.length > 8 ? `<li style="color: #9ca3af;">+${controls.length - 8} more...</li>` : ""}
          </ul>
        </div>
      `;
    })
    .join("");

  return `
    <div class="compliance-summary">
      <h2 style="margin-top: 0;">Compliance Framework Coverage</h2>
      <p style="color: #6b7280; font-size: 13px; margin-bottom: 12px;">
        This threat model maps to ${frameworks.length} compliance framework${frameworks.length !== 1 ? "s" : ""}.
      </p>
      <div class="compliance-grid">
        ${frameworkCards}
      </div>
    </div>
  `;
}
