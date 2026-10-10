/**
 * Mermaid diagram parser
 * Supports: flowchart, graph, C4Context, C4Container, C4Component, sequenceDiagram
 */
import type {
  ParsedDiagram,
  ParsedShape,
  ParsedConnection,
  ParsedGroup,
} from "../../types";
import { parseFlowchart } from "./mermaid-flowchart-parser";
import {
  parseC4Diagram,
  parseSequenceDiagram,
} from "./mermaid-c4-sequence-parsers";

type MermaidDiagramType = "flowchart" | "graph" | "c4" | "sequence" | "unknown";

export interface MermaidParseContext {
  shapes: Map<string, ParsedShape>;
  connections: ParsedConnection[];
  groups: ParsedGroup[];
  nodeIndex: number;
}

function detectDiagramType(content: string): MermaidDiagramType {
  const firstLine = content.split("\n")[0].toLowerCase().trim();
  if (firstLine.startsWith("flowchart") || firstLine.startsWith("graph"))
    return "flowchart";
  if (
    firstLine.startsWith("c4context") ||
    firstLine.startsWith("c4container") ||
    firstLine.startsWith("c4component")
  )
    return "c4";
  if (firstLine.startsWith("sequencediagram")) return "sequence";
  return "unknown";
}

export function parseMermaidDiagram(content: string): ParsedDiagram {
  const trimmed = content.trim();
  const diagramType = detectDiagramType(trimmed);

  const context: MermaidParseContext = {
    shapes: new Map(),
    connections: [],
    groups: [],
    nodeIndex: 0,
  };

  switch (diagramType) {
    case "flowchart":
    case "graph":
      parseFlowchart(trimmed, context);
      break;
    case "c4":
      parseC4Diagram(trimmed, context);
      break;
    case "sequence":
      parseSequenceDiagram(trimmed, context);
      break;
    default:
      parseFlowchart(trimmed, context);
  }

  return {
    source: "plantuml",
    shapes: Array.from(context.shapes.values()),
    connections: context.connections,
    groups: context.groups,
    metadata: { title: "Mermaid Diagram" },
  };
}
