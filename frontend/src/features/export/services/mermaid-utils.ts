import type { Node } from "@xyflow/react";
import type { ComponentNodeData } from "@/types/canvas";

export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}

export function sanitizeLabel(label: string): string {
  return label
    .replace(/"/g, "'")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\|/g, "/")
    .replace(/\n/g, " ");
}

export function generateStyles(nodes: Node[]): string[] {
  const lines: string[] = [];
  const typeGroups = new Map<string, string[]>();

  for (const node of nodes) {
    const data = node.data as ComponentNodeData;
    const type = data.type;
    if (!typeGroups.has(type)) typeGroups.set(type, []);
    typeGroups.get(type)!.push(sanitizeId(node.id));
  }

  const styleColors: Record<string, string> = {
    DATABASE: "#f9a825",
    ACTOR: "#4caf50",
    EXTERNAL_ENTITY: "#9e9e9e",
    API_GATEWAY: "#2196f3",
    MICROSERVICE: "#00bcd4",
    WEB_APP: "#673ab7",
    MOBILE_APP: "#e91e63",
    SERVERLESS: "#ff5722",
    QUEUE: "#795548",
    CACHE: "#607d8b",
    FIREWALL: "#f44336",
  };

  for (const [type, nodeIds] of typeGroups) {
    const color = styleColors[type] || "#333";
    lines.push(`  classDef ${type.toLowerCase()} fill:${color},color:#fff`);
    lines.push(`  class ${nodeIds.join(",")} ${type.toLowerCase()}`);
  }

  return lines;
}
