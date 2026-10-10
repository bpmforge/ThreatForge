/**
 * YAML export service.
 */
import type { Node, Edge } from "@xyflow/react";
import type { ThreatModelExport, ExportThreat } from "../types";
import { downloadBlob, sanitizeFilename } from "./download";

/** Simple JSON to YAML converter */
function jsonToYaml(obj: unknown, indent: number = 0): string {
  const spaces = "  ".repeat(indent);

  if (obj === null || obj === undefined) return "null";

  if (typeof obj === "string") {
    if (obj.includes("\n") || obj.includes(":") || obj.includes("#")) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }

  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => `${spaces}- ${jsonToYaml(item, indent + 1).trimStart()}`)
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, value]) => {
        const valueStr = jsonToYaml(value, indent + 1);
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        if (Array.isArray(value) && value.length > 0) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        return `${spaces}${key}: ${valueStr}`;
      })
      .join("\n");
  }

  return String(obj);
}

/** Export threat model to YAML format */
export function exportToYAML(
  modelId: string | null,
  modelName: string,
  nodes: Node[],
  edges: Edge[],
  threats: ExportThreat[],
): void {
  const exportData: ThreatModelExport = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    model: { id: modelId, name: modelName },
    canvas: { nodes, edges },
    threats,
  };

  const yaml = jsonToYaml(exportData);
  const blob = new Blob([yaml], { type: "text/yaml" });
  downloadBlob(blob, `${sanitizeFilename(modelName)}.yaml`);
}
