/**
 * Threat Dragon parser — supports v1 (JSON with cells[]) and v2 format.
 */
import type { ComponentType } from "@/types/canvas";
import type { ParsedDiagram, ParsedShape, ParsedConnection } from "../../types";

// Threat Dragon shape type → ThreatForge ComponentType
const TD_TYPE_MAP: Record<string, ComponentType> = {
  "tm.Actor": "ACTOR",
  "td.Actor": "ACTOR",
  "tm.Process": "PROCESS",
  "td.Process": "PROCESS",
  "tm.Store": "DATA_STORE",
  "td.Store": "DATA_STORE",
  "tm.Flow": "DATA_FLOW",
  "td.Flow": "DATA_FLOW",
};

interface TDCell {
  id?: string;
  type?: string;
  shape?: string; // v1 sometimes uses 'shape'
  value?: string;
  label?: string;
  data?: { name?: string; type?: string };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  source?: string | null;
  target?: string | null;
  zIndex?: number;
}

interface TDDiagram {
  id?: number | string;
  title?: string;
  cells?: TDCell[];
  // v1 format
  shapes?: TDCell[];
  flows?: TDCell[];
}

interface ThreatDragonDoc {
  version?: string;
  summary?: { title?: string };
  // v2
  detail?: { diagrams?: TDDiagram[] };
  // v1
  diagrams?: TDDiagram[];
}

function tdTypeToComponent(cell: TDCell): ComponentType {
  const raw = cell.type ?? cell.shape ?? cell.data?.type ?? "";
  return TD_TYPE_MAP[raw] ?? "PROCESS";
}

function labelOf(cell: TDCell): string {
  return cell.value ?? cell.label ?? cell.data?.name ?? "Component";
}

export function parseThreatDragon(content: string): ParsedDiagram {
  let doc: ThreatDragonDoc;
  try {
    doc = JSON.parse(content) as ThreatDragonDoc;
  } catch {
    throw new Error("Invalid Threat Dragon file — expected JSON");
  }

  const diagrams: TDDiagram[] = doc.detail?.diagrams ?? doc.diagrams ?? [];

  if (diagrams.length === 0) {
    throw new Error("No diagrams found in Threat Dragon file");
  }

  // Use first diagram
  const diagram = diagrams[0];
  const allCells: TDCell[] = [
    ...(diagram.cells ?? []),
    ...(diagram.shapes ?? []),
    ...(diagram.flows ?? []),
  ];

  const shapes: ParsedShape[] = [];
  const connections: ParsedConnection[] = [];

  for (const cell of allCells) {
    const id = String(cell.id ?? Math.random());
    const type = cell.type ?? cell.shape ?? "";
    const isFlow =
      type.includes("Flow") ||
      type.includes("flow") ||
      (cell.source != null && cell.target != null);

    if (isFlow && cell.source && cell.target) {
      connections.push({
        id,
        label: labelOf(cell),
        sourceId: String(cell.source),
        targetId: String(cell.target),
      });
    } else if (!type.includes("Boundary") && !type.includes("boundary")) {
      shapes.push({
        id,
        label: labelOf(cell),
        type: type || "component",
        inferredType: tdTypeToComponent(cell),
        position: { x: cell.x ?? 0, y: cell.y ?? 0 },
        size: { width: cell.width ?? 120, height: cell.height ?? 60 },
        style: {},
      });
    }
  }

  return {
    source: "threat-dragon",
    shapes,
    connections,
    groups: [],
    metadata: {
      title: doc.summary?.title ?? diagram.title ?? "Threat Dragon Import",
    },
  };
}
