import type { Node, Edge } from "@xyflow/react";
import { escapeHtml } from "../download";

function formatInterface(iface: Record<string, unknown>): string {
  const name = String(iface.name || "Interface");
  const port = iface.port ? `:${iface.port}` : "";
  const protocol = iface.protocol ? String(iface.protocol) : "";
  const auth =
    iface.authentication && iface.authentication !== "None"
      ? String(iface.authentication)
      : "";
  const encrypted = iface.encrypted ? "🔒" : "";
  const details = [protocol, auth, encrypted].filter(Boolean).join(" / ");
  return escapeHtml(`${name}${port}${details ? ` (${details})` : ""}`);
}

export function getComponentsTable(nodes: Node[]): string {
  const rows = nodes
    .filter((n) => n.type === "component")
    .map((n) => {
      const data = n.data as Record<string, unknown>;
      const interfaces =
        Array.isArray(data.interfaces) && data.interfaces.length > 0
          ? data.interfaces
              .map((i: Record<string, unknown>) => formatInterface(i))
              .join("<br/>")
          : "-";
      return `<tr>
        <td>${escapeHtml(String(data.label || ""))}</td>
        <td>${escapeHtml(String(data.type || ""))}</td>
        <td>${escapeHtml(String(data.trustLevel || ""))}</td>
        <td style="font-size: 11px;">${interfaces}</td>
        <td>${escapeHtml(String(data.description || "-"))}</td>
      </tr>`;
    })
    .join("");
  return `
    <h2>Components</h2>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Trust Level</th><th>Interfaces</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function getConnectionsTable(nodes: Node[], edges: Edge[]): string {
  const nodeMap = new Map<string, string>();
  nodes.forEach((n) => {
    const data = n.data as Record<string, unknown>;
    nodeMap.set(n.id, String(data.label || n.id));
  });

  const rows = edges
    .map((e) => {
      const data = (e.data || {}) as Record<string, unknown>;
      const sourceName = nodeMap.get(e.source) || e.source;
      const targetName = nodeMap.get(e.target) || e.target;
      const protocol = data.protocol ? String(data.protocol) : "-";
      const auth = data.authentication ? String(data.authentication) : "-";
      const encrypted = data.encrypted ? "Yes" : "No";
      const dataClass =
        Array.isArray(data.dataClassifications) &&
        data.dataClassifications.length > 0
          ? data.dataClassifications.join(", ")
          : "-";
      let securityLevel = "Low";
      let securityColor = "#ef4444";
      if (
        data.encrypted &&
        data.authentication &&
        data.authentication !== "None"
      ) {
        if (
          data.authentication === "mTLS" ||
          data.authentication === "OAuth2"
        ) {
          securityLevel = "High";
          securityColor = "#22c55e";
        } else {
          securityLevel = "Medium";
          securityColor = "#eab308";
        }
      } else if (
        data.encrypted ||
        (data.authentication && data.authentication !== "None")
      ) {
        securityLevel = "Medium";
        securityColor = "#eab308";
      }
      return `<tr>
        <td>${escapeHtml(sourceName)}</td>
        <td>${escapeHtml(targetName)}</td>
        <td>${escapeHtml(protocol)}</td>
        <td>${escapeHtml(auth)}</td>
        <td style="color: ${encrypted === "Yes" ? "#22c55e" : "#ef4444"}">${encrypted}</td>
        <td>${escapeHtml(dataClass)}</td>
        <td><span class="badge" style="background: ${securityColor}; color: white;">${securityLevel}</span></td>
      </tr>`;
    })
    .join("");

  if (edges.length === 0) return "";

  return `
    <h2>Data Flows / Connections</h2>
    <table>
      <thead>
        <tr>
          <th>Source</th><th>Target</th><th>Protocol</th>
          <th>Authentication</th><th>Encrypted</th>
          <th>Data Classification</th><th>Security</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
