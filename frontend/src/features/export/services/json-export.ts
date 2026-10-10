/**
 * JSON export service.
 */
import type { Node, Edge } from "@xyflow/react";
import type { ThreatModelExport, ExportThreat } from "../types";
import { downloadBlob, sanitizeFilename } from "./download";

/** Export threat model to JSON format */
export function exportToJSON(
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

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${sanitizeFilename(modelName)}.json`);
}
