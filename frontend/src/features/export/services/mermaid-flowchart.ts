import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData, BoundaryNodeData } from "@/types/canvas";
import { sanitizeId, sanitizeLabel, generateStyles } from "./mermaid-utils";
import type { MermaidExportOptions } from "./mermaid-export";

function getArrowStyle(edge: Edge): string {
  const data = edge.data as { encrypted?: boolean } | undefined;
  return data?.encrypted ? "==>" : "-->";
}

function getShapeForType(type: string): string {
  switch (type) {
    case "DATABASE":
    case "AWS_RDS":
    case "AWS_DYNAMODB":
    case "AZURE_SQL":
    case "AZURE_COSMOS_DB":
    case "GCP_CLOUD_SQL":
    case "GCP_BIGQUERY":
    case "DATA_STORE":
      return "cylinder";
    case "ACTOR":
    case "EXTERNAL_ENTITY":
      return "circle";
    case "API_GATEWAY":
    case "AWS_API_GATEWAY":
    case "AZURE_API_MANAGEMENT":
      return "diamond";
    case "SERVERLESS":
    case "AWS_LAMBDA":
    case "AZURE_FUNCTIONS":
    case "GCP_CLOUD_FUNCTIONS":
      return "hexagon";
    case "QUEUE":
    case "AWS_SQS":
    case "AWS_SNS":
    case "AZURE_SERVICE_BUS":
    case "GCP_PUBSUB":
      return "stadium";
    case "LOAD_BALANCER":
    case "AWS_ELB":
    case "AZURE_FRONT_DOOR":
      return "subroutine";
    default:
      return "rectangle";
  }
}

function generateNodeDefinition(node: Node): string {
  const data = node.data as ComponentNodeData;
  const id = sanitizeId(node.id);
  const label = sanitizeLabel(data.label || "Component");
  const shape = getShapeForType(data.type);

  switch (shape) {
    case "cylinder":
      return `${id}[(${label})]`;
    case "circle":
      return `${id}((${label}))`;
    case "diamond":
      return `${id}{${label}}`;
    case "hexagon":
      return `${id}{{${label}}}`;
    case "stadium":
      return `${id}([${label}])`;
    case "subroutine":
      return `${id}[[${label}]]`;
    case "asymmetric":
      return `${id}>${label}]`;
    default:
      return `${id}[${label}]`;
  }
}

export function generateFlowchartContent(
  nodes: Node[],
  edges: Edge[],
  opts: MermaidExportOptions,
): string {
  const lines: string[] = [];
  lines.push(`flowchart ${opts.direction}`);
  lines.push("");

  const boundaries = nodes.filter((n) => n.type === "boundary");
  const components = nodes.filter((n) => n.type === "component");

  const componentsByParent = new Map<string | undefined, Node[]>();
  for (const comp of components) {
    const parentId = comp.parentId;
    if (!componentsByParent.has(parentId)) componentsByParent.set(parentId, []);
    componentsByParent.get(parentId)!.push(comp);
  }

  for (const boundary of boundaries) {
    const data = boundary.data as BoundaryNodeData;
    const boundaryId = sanitizeId(boundary.id);
    const label = sanitizeLabel(data.label || "Trust Boundary");
    lines.push(`  subgraph ${boundaryId}[${label}]`);
    for (const child of componentsByParent.get(boundary.id) || []) {
      lines.push(`    ${generateNodeDefinition(child)}`);
    }
    lines.push("  end");
    lines.push("");
  }

  const orphans = componentsByParent.get(undefined) || [];
  if (orphans.length > 0) {
    lines.push("  %% Components");
    for (const node of orphans) lines.push(`  ${generateNodeDefinition(node)}`);
    lines.push("");
  }

  if (edges.length > 0) {
    lines.push("  %% Connections");
    for (const edge of edges) {
      const sourceId = sanitizeId(edge.source);
      const targetId = sanitizeId(edge.target);
      const label =
        opts.includeEdgeLabels && edge.label
          ? `|${sanitizeLabel(String(edge.label))}|`
          : "";
      lines.push(`  ${sourceId} ${getArrowStyle(edge)}${label} ${targetId}`);
    }
    lines.push("");
  }

  if (opts.includeStyles) {
    lines.push("  %% Styles");
    lines.push(...generateStyles(components));
  }

  return lines.join("\n");
}
