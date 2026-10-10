import type { Node, Edge } from "@xyflow/react";
import { downloadBlob, sanitizeFilename } from "./download";
import { generateFlowchartContent } from "./mermaid-flowchart";
import { generateC4Content } from "./mermaid-c4";

type MermaidDirection = "TB" | "BT" | "LR" | "RL";

export interface MermaidExportOptions {
  direction?: MermaidDirection;
  includeStyles?: boolean;
  includeEdgeLabels?: boolean;
  format?: "flowchart" | "c4";
}

const DEFAULT_OPTIONS: MermaidExportOptions = {
  direction: "TB",
  includeStyles: true,
  includeEdgeLabels: true,
  format: "flowchart",
};

export function exportToMermaid(
  modelName: string,
  nodes: Node[],
  edges: Edge[],
  options: MermaidExportOptions = {},
): void {
  const content = generateMermaidContent(nodes, edges, options);
  const blob = new Blob([content], { type: "text/plain" });
  downloadBlob(blob, `${sanitizeFilename(modelName)}.mmd`);
}

function generateMermaidContent(
  nodes: Node[],
  edges: Edge[],
  options: MermaidExportOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (opts.format === "c4") return generateC4Content(nodes, edges);
  return generateFlowchartContent(nodes, edges, opts);
}
