import type { ComponentType } from "@/types/canvas";
import type { MermaidParseContext } from "./mermaid-parser";

function calculatePosition(index: number): { x: number; y: number } {
  const cols = 4;
  return {
    x: 100 + (index % cols) * 200,
    y: 100 + Math.floor(index / cols) * 150,
  };
}

function addC4Node(
  ctx: MermaidParseContext,
  id: string,
  label: string,
  description: string | undefined,
  type: ComponentType,
): void {
  ctx.shapes.set(id, {
    id,
    label,
    type: type.toLowerCase(),
    inferredType: type,
    position: calculatePosition(ctx.nodeIndex++),
    size: { width: 150, height: 80 },
    properties: description ? { description } : undefined,
  });
}

function addSequenceParticipant(
  ctx: MermaidParseContext,
  id: string,
  label: string,
  type: ComponentType,
): void {
  ctx.shapes.set(id, {
    id,
    label,
    type: type.toLowerCase(),
    inferredType: type,
    position: { x: ctx.nodeIndex * 200, y: 100 },
    size: { width: 120, height: 60 },
  });
  ctx.nodeIndex++;
}

export function parseC4Diagram(
  content: string,
  ctx: MermaidParseContext,
): void {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;

    const personMatch = trimmed.match(
      /Person(?:_Ext)?\s*\(\s*(\w+)\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\)/i,
    );
    if (personMatch) {
      addC4Node(ctx, personMatch[1], personMatch[2], personMatch[3], "ACTOR");
      continue;
    }

    const systemMatch = trimmed.match(
      /System(?:_Ext|_Boundary)?\s*\(\s*(\w+)\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\)/i,
    );
    if (systemMatch) {
      addC4Node(
        ctx,
        systemMatch[1],
        systemMatch[2],
        systemMatch[3],
        "EXTERNAL_ENTITY",
      );
      continue;
    }

    const containerMatch = trimmed.match(
      /Container(?:_Ext|_Boundary|_Db|_Queue)?\s*\(\s*(\w+)\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?(?:\s*,\s*"([^"]+)")?\)/i,
    );
    if (containerMatch) {
      const type = trimmed.toLowerCase().includes("_db")
        ? "DATABASE"
        : trimmed.toLowerCase().includes("_queue")
          ? "QUEUE"
          : "MICROSERVICE";
      addC4Node(
        ctx,
        containerMatch[1],
        containerMatch[2],
        containerMatch[4],
        type,
      );
      continue;
    }

    const componentMatch = trimmed.match(
      /Component(?:_Ext|_Db)?\s*\(\s*(\w+)\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?(?:\s*,\s*"([^"]+)")?\)/i,
    );
    if (componentMatch) {
      const type = trimmed.toLowerCase().includes("_db")
        ? "DATABASE"
        : "PROCESS";
      addC4Node(
        ctx,
        componentMatch[1],
        componentMatch[2],
        componentMatch[4],
        type,
      );
      continue;
    }

    const relMatch = trimmed.match(
      /(?:Rel|BiRel)(?:_\w+)?\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\)/i,
    );
    if (relMatch) {
      ctx.connections.push({
        id: `conn-${ctx.connections.length}`,
        sourceId: relMatch[1],
        targetId: relMatch[2],
        label: relMatch[3],
      });
      continue;
    }

    const boundaryMatch = trimmed.match(
      /(?:System_Boundary|Container_Boundary|Enterprise_Boundary|Boundary)\s*\(\s*(\w+)\s*,\s*"([^"]+)"\)/i,
    );
    if (boundaryMatch) {
      ctx.groups.push({
        id: boundaryMatch[1],
        label: boundaryMatch[2],
        childIds: [],
        bounds: { x: 0, y: 0, width: 400, height: 300 },
      });
    }
  }
}

export function parseSequenceDiagram(
  content: string,
  ctx: MermaidParseContext,
): void {
  const lines = content.split("\n").slice(1);
  const participants = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;

    const participantMatch = trimmed.match(
      /(?:participant|actor)\s+(\w+)(?:\s+as\s+"?([^"]+)"?)?/i,
    );
    if (participantMatch) {
      const id = participantMatch[1];
      const label = participantMatch[2] || participantMatch[1];
      const type: ComponentType = trimmed.toLowerCase().startsWith("actor")
        ? "ACTOR"
        : "MICROSERVICE";
      addSequenceParticipant(ctx, id, label, type);
      participants.add(id);
      continue;
    }

    const messageMatch = trimmed.match(
      /(\w+)\s*(->>?|-->>?|->|-->)\s*(\w+)\s*:\s*(.+)/,
    );
    if (messageMatch) {
      const sourceId = messageMatch[1];
      const targetId = messageMatch[3];
      if (!participants.has(sourceId)) {
        addSequenceParticipant(ctx, sourceId, sourceId, "MICROSERVICE");
        participants.add(sourceId);
      }
      if (!participants.has(targetId)) {
        addSequenceParticipant(ctx, targetId, targetId, "MICROSERVICE");
        participants.add(targetId);
      }
      ctx.connections.push({
        id: `conn-${ctx.connections.length}`,
        sourceId,
        targetId,
        label: messageMatch[4].trim(),
      });
    }
  }
}
