/**
 * PDF template — cover page / summary section
 */

import type { Node, Edge } from "@xyflow/react";
import type { ExportThreat } from "../../types";

/** Generate summary section */
export function getSummarySection(
  nodes: Node[],
  edges: Edge[],
  threats: ExportThreat[],
): string {
  const openThreats = threats.filter((t) => t.status === "OPEN").length;
  // Same set the Components table lists: boundaries and legends are not components.
  const components = nodes.filter((n) => n.type === "component").length;
  return `
    <div class="summary">
      <div class="summary-card"><div class="value">${components}</div><div class="label">Components</div></div>
      <div class="summary-card"><div class="value">${edges.length}</div><div class="label">Connections</div></div>
      <div class="summary-card"><div class="value">${threats.length}</div><div class="label">Threats</div></div>
      <div class="summary-card"><div class="value">${openThreats}</div><div class="label">Open Threats</div></div>
    </div>
  `;
}
