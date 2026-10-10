import type { ComponentType } from "@/types/canvas";
import type { MermaidParseContext } from "./mermaid-parser";

function calculatePosition(index: number): { x: number; y: number } {
  const cols = 4;
  return {
    x: 100 + (index % cols) * 200,
    y: 100 + Math.floor(index / cols) * 150,
  };
}

function inferMermaidNodeType(line: string): ComponentType {
  const lower = line.toLowerCase();
  if (line.includes("[(") && line.includes(")]")) return "DATABASE";
  if (line.includes("((") && line.includes("))")) return "PROCESS";
  if (line.includes("{") && line.includes("}")) return "API_GATEWAY";
  if (
    lower.includes("database") ||
    lower.includes("db") ||
    lower.includes("storage")
  )
    return "DATABASE";
  if (lower.includes("api") || lower.includes("gateway")) return "API_GATEWAY";
  if (
    lower.includes("user") ||
    lower.includes("client") ||
    lower.includes("browser")
  )
    return "ACTOR";
  if (
    lower.includes("queue") ||
    lower.includes("kafka") ||
    lower.includes("rabbitmq")
  )
    return "QUEUE";
  if (lower.includes("cache") || lower.includes("redis")) return "CACHE";
  if (lower.includes("load") && lower.includes("balancer"))
    return "LOAD_BALANCER";
  if (
    lower.includes("external") ||
    lower.includes("third") ||
    lower.includes("3rd")
  )
    return "EXTERNAL_ENTITY";
  if (lower.includes("service") || lower.includes("server"))
    return "MICROSERVICE";
  if (
    lower.includes("web") ||
    lower.includes("frontend") ||
    lower.includes("ui")
  )
    return "WEB_APP";
  if (lower.includes("mobile") || lower.includes("app")) return "MOBILE_APP";
  return "MICROSERVICE";
}

function updateOrCreateNode(
  ctx: MermaidParseContext,
  nodeId: string,
  label: string,
  type: ComponentType,
): void {
  const existing = ctx.shapes.get(nodeId);
  if (existing) {
    existing.label = label;
    existing.inferredType = type;
    existing.type = type.toLowerCase();
  } else {
    const position = calculatePosition(ctx.nodeIndex++);
    ctx.shapes.set(nodeId, {
      id: nodeId,
      label,
      type: type.toLowerCase(),
      inferredType: type,
      position,
      size: { width: 150, height: 80 },
    });
  }
}

function ensureNode(
  ctx: MermaidParseContext,
  nodeId: string,
  line: string,
): void {
  if (!ctx.shapes.has(nodeId)) {
    const labelMatch =
      line.match(new RegExp(`${nodeId}\\[([^\\]]+)\\]`)) ||
      line.match(new RegExp(`${nodeId}\\{([^}]+)\\}`)) ||
      line.match(new RegExp(`${nodeId}\\(\\(([^)]+)\\)\\)`)) ||
      line.match(new RegExp(`${nodeId}\\(([^)]+)\\)`));
    const label = labelMatch ? labelMatch[1] : nodeId;
    updateOrCreateNode(ctx, nodeId, label, inferMermaidNodeType(line));
  }
}

export function parseFlowchart(
  content: string,
  ctx: MermaidParseContext,
): void {
  const lines = content.split("\n").slice(1);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;

    const subgraphMatch = trimmed.match(
      /^subgraph\s+(\w+)(?:\s*\[([^\]]+)\])?/i,
    );
    if (subgraphMatch) {
      ctx.groups.push({
        id: subgraphMatch[1],
        label: subgraphMatch[2] || subgraphMatch[1],
        childIds: [],
        bounds: { x: 0, y: 0, width: 400, height: 300 },
      });
      continue;
    }

    const connectionPatterns = [
      /^(\w+)\s*(?:--+>?|=+>?|-.->?)\s*(?:\|([^|]*)\|)?\s*(\w+)/,
      /^(\w+)(?:\[[^\]]*\]|{[^}]*}|\([^)]*\)|>([^>]*)<)?\s*(?:--+>?|=+>?|-.->?)\s*(?:\|([^|]*)\|)?\s*(\w+)(?:\[[^\]]*\]|{[^}]*}|\([^)]*\)|>([^>]*)<)?/,
    ];

    let matched = false;
    for (const pattern of connectionPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const sourceId = match[1];
        const targetId = match[match.length - 1] || match[3] || match[4];
        const label = match[2] || match[3] || "";
        if (sourceId && targetId) {
          ensureNode(ctx, sourceId, trimmed);
          ensureNode(ctx, targetId, trimmed);
          ctx.connections.push({
            id: `conn-${ctx.connections.length}`,
            sourceId,
            targetId,
            label: label.trim(),
          });
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      const nodePatterns = [
        /^(\w+)\[([^\]]+)\]/,
        /^(\w+)\{([^}]+)\}/,
        /^(\w+)\(\(([^)]+)\)\)/,
        /^(\w+)\(([^)]+)\)/,
        /^(\w+)>([^<]+)</,
        /^(\w+)\[\[([^\]]+)\]\]/,
        /^(\w+)\[\/([^\]]+)\/\]/,
        /^(\w+)\[\(([^\]]+)\)\]/,
      ];
      for (const pattern of nodePatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          updateOrCreateNode(
            ctx,
            match[1],
            match[2],
            inferMermaidNodeType(trimmed),
          );
          break;
        }
      }
    }
  }
}
