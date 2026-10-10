import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData, BoundaryNodeData } from "@/types/canvas";
import { sanitizeId } from "./mermaid-utils";

function mapToC4Type(componentType: string): string {
  switch (componentType) {
    case "DATABASE":
    case "AWS_RDS":
    case "AWS_DYNAMODB":
    case "AZURE_SQL":
    case "GCP_CLOUD_SQL":
      return "ContainerDb";
    case "QUEUE":
    case "AWS_SQS":
    case "AZURE_SERVICE_BUS":
    case "GCP_PUBSUB":
      return "ContainerQueue";
    case "EXTERNAL_ENTITY":
      return "System_Ext";
    default:
      return "Container";
  }
}

export function generateC4Content(nodes: Node[], edges: Edge[]): string {
  const lines: string[] = [];
  lines.push("C4Context");
  lines.push("  title System Context Diagram");
  lines.push("");

  const boundaries = nodes.filter((n) => n.type === "boundary");
  const components = nodes.filter((n) => n.type === "component");

  const actors = components.filter(
    (n) => (n.data as ComponentNodeData).type === "ACTOR",
  );
  for (const actor of actors) {
    const data = actor.data as ComponentNodeData;
    const id = sanitizeId(actor.id);
    lines.push(`  Person(${id}, "${data.label}", "${data.description || ""}")`);
  }
  lines.push("");

  for (const boundary of boundaries) {
    const data = boundary.data as BoundaryNodeData;
    const boundaryId = sanitizeId(boundary.id);
    lines.push(`  System_Boundary(${boundaryId}, "${data.label}") {`);
    const children = components.filter(
      (c) =>
        c.parentId === boundary.id &&
        (c.data as ComponentNodeData).type !== "ACTOR",
    );
    for (const child of children) {
      const childData = child.data as ComponentNodeData;
      const childId = sanitizeId(child.id);
      const containerType = mapToC4Type(childData.type);
      lines.push(
        `    ${containerType}(${childId}, "${childData.label}", "${childData.technologies?.join(", ") || ""}", "${childData.description || ""}")`,
      );
    }
    lines.push("  }");
    lines.push("");
  }

  const orphans = components.filter(
    (c) => !c.parentId && (c.data as ComponentNodeData).type !== "ACTOR",
  );
  for (const node of orphans) {
    const data = node.data as ComponentNodeData;
    const id = sanitizeId(node.id);
    if (data.type === "EXTERNAL_ENTITY") {
      lines.push(
        `  System_Ext(${id}, "${data.label}", "${data.description || ""}")`,
      );
    } else {
      lines.push(
        `  System(${id}, "${data.label}", "${data.description || ""}")`,
      );
    }
  }
  lines.push("");

  lines.push("  %% Relationships");
  for (const edge of edges) {
    const sourceId = sanitizeId(edge.source);
    const targetId = sanitizeId(edge.target);
    const label = edge.label ? String(edge.label) : "Uses";
    lines.push(`  Rel(${sourceId}, ${targetId}, "${label}")`);
  }

  return lines.join("\n");
}
