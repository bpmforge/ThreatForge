/**
 * Converts parsed diagrams to DFD canvas format.
 * Maps shapes to DFD elements (Process, DataStore, ExternalEntity)
 * and connections to DataFlows.
 */
import type { ParsedDiagram, ParsedShape } from "../types";
import type {
  DFDNode,
  DFDEdge,
  DFDProcessNodeData,
  DFDDataStoreNodeData,
  DFDExternalEntityNodeData,
  DFDDataFlowEdgeData,
} from "@/types/dfd-canvas";
import type { DataType, ExternalEntityType } from "@/features/dfd";

export interface DFDConversionResult {
  nodes: DFDNode[];
  edges: DFDEdge[];
  warnings: string[];
}

export interface DFDConversionOptions {
  /** Offset for all positions */
  offset?: { x: number; y: number };
  /** Whether to auto-layout nodes or preserve original positions */
  preserveLayout?: boolean;
}

const DEFAULT_OPTIONS: DFDConversionOptions = {
  offset: { x: 100, y: 100 },
  preserveLayout: true,
};

/**
 * Convert a parsed diagram to DFD canvas format.
 */
export function convertDiagramToDFD(
  diagram: ParsedDiagram,
  options: DFDConversionOptions = {},
): DFDConversionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];
  const nodeIdMap = new Map<string, string>(); // Original ID -> New ID

  const nodes: DFDNode[] = [];
  const edges: DFDEdge[] = [];

  let processCount = 0;
  let dataStoreCount = 0;

  // Convert shapes to DFD nodes
  for (const shape of diagram.shapes) {
    const dfdType = inferDFDNodeType(shape);
    const newId = `dfd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    nodeIdMap.set(shape.id, newId);

    const position = {
      x: shape.position.x + (opts.offset?.x || 0),
      y: shape.position.y + (opts.offset?.y || 0),
    };

    if (dfdType === "process") {
      processCount++;
      const node: DFDNode = {
        id: newId,
        type: "dfd-process",
        position,
        data: {
          number: String(processCount),
          name: shape.label || `Process ${processCount}`,
          description: (shape.properties?.description as string) || undefined,
        } as DFDProcessNodeData,
      };
      nodes.push(node);
    } else if (dfdType === "datastore") {
      dataStoreCount++;
      const node: DFDNode = {
        id: newId,
        type: "dfd-datastore",
        position,
        data: {
          number: String(dataStoreCount),
          name: shape.label || `Data Store ${dataStoreCount}`,
          description: (shape.properties?.description as string) || undefined,
          dataTypes: inferDataTypes(shape),
        } as DFDDataStoreNodeData,
      };
      nodes.push(node);
    } else {
      // External entity
      const node: DFDNode = {
        id: newId,
        type: "dfd-entity",
        position,
        data: {
          name: shape.label || "External Entity",
          entityType: inferEntityType(shape),
          description: (shape.properties?.description as string) || undefined,
        } as DFDExternalEntityNodeData,
      };
      nodes.push(node);
    }
  }

  // Convert connections to DFD edges (data flows)
  for (const conn of diagram.connections) {
    const sourceId = nodeIdMap.get(conn.sourceId);
    const targetId = nodeIdMap.get(conn.targetId);

    if (!sourceId || !targetId) {
      warnings.push(
        `Skipped flow "${conn.label || conn.id}": missing source or target`,
      );
      continue;
    }

    const edge: DFDEdge = {
      id: `dfd-edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "dfd-flow",
      source: sourceId,
      target: targetId,
      data: {
        name: conn.label || "Data Flow",
        dataTypes: inferDataTypesFromLabel(conn.label || ""),
      } as DFDDataFlowEdgeData,
    };
    edges.push(edge);
  }

  // Auto-layout if positions are all zero
  if (!opts.preserveLayout || allPositionsZero(nodes)) {
    autoLayoutDFDNodes(nodes);
  }

  return { nodes, edges, warnings };
}

/**
 * Infer what type of DFD node a shape should become.
 */
function inferDFDNodeType(
  shape: ParsedShape,
): "process" | "datastore" | "entity" {
  const label = (shape.label || "").toLowerCase();
  const type = (shape.type || "").toLowerCase();
  const inferredType = (shape.inferredType || "").toLowerCase();

  // Check for data store indicators
  if (
    type.includes("cylinder") ||
    type.includes("database") ||
    type.includes("storage") ||
    label.includes("database") ||
    label.includes("db") ||
    label.includes("store") ||
    label.includes("repository") ||
    label.includes("cache") ||
    label.includes("redis") ||
    label.includes("postgres") ||
    label.includes("mysql") ||
    label.includes("mongo") ||
    inferredType.includes("database") ||
    inferredType.includes("cache") ||
    inferredType.includes("s3") ||
    inferredType.includes("blob") ||
    inferredType.includes("storage")
  ) {
    return "datastore";
  }

  // Check for external entity indicators
  if (
    type.includes("actor") ||
    type.includes("user") ||
    type.includes("person") ||
    type.includes("cloud") ||
    type.includes("external") ||
    label.includes("user") ||
    label.includes("client") ||
    label.includes("browser") ||
    label.includes("mobile") ||
    label.includes("external") ||
    label.includes("third party") ||
    label.includes("3rd party") ||
    inferredType.includes("actor") ||
    inferredType.includes("external") ||
    inferredType.includes("mobile_app") ||
    inferredType.includes("web_app")
  ) {
    return "entity";
  }

  // Default to process (most common)
  return "process";
}

/**
 * Infer data types from shape properties.
 */
function inferDataTypes(shape: ParsedShape): DataType[] {
  const label = (shape.label || "").toLowerCase();
  const types: DataType[] = [];

  if (
    label.includes("user") ||
    label.includes("customer") ||
    label.includes("personal")
  ) {
    types.push("PII");
  }
  if (
    label.includes("health") ||
    label.includes("medical") ||
    label.includes("patient")
  ) {
    types.push("PHI");
  }
  if (
    label.includes("payment") ||
    label.includes("financial") ||
    label.includes("billing")
  ) {
    types.push("FINANCIAL");
  }
  if (
    label.includes("credential") ||
    label.includes("password") ||
    label.includes("secret") ||
    label.includes("key")
  ) {
    types.push("CREDENTIALS");
  }

  return types.length > 0 ? types : ["INTERNAL"];
}

/**
 * Infer data types from connection label.
 */
function inferDataTypesFromLabel(label: string): DataType[] {
  const lower = label.toLowerCase();
  const types: DataType[] = [];

  if (
    lower.includes("user") ||
    lower.includes("personal") ||
    lower.includes("profile")
  ) {
    types.push("PII");
  }
  if (lower.includes("health") || lower.includes("medical")) {
    types.push("PHI");
  }
  if (
    lower.includes("payment") ||
    lower.includes("card") ||
    lower.includes("transaction")
  ) {
    types.push("FINANCIAL");
  }
  if (
    lower.includes("auth") ||
    lower.includes("token") ||
    lower.includes("credential") ||
    lower.includes("password")
  ) {
    types.push("CREDENTIALS");
  }
  if (lower.includes("public") || lower.includes("open")) {
    types.push("PUBLIC");
  }

  return types.length > 0 ? types : ["INTERNAL"];
}

/**
 * Infer external entity type from shape.
 */
function inferEntityType(shape: ParsedShape): ExternalEntityType {
  const label = (shape.label || "").toLowerCase();
  const type = (shape.type || "").toLowerCase();

  if (
    label.includes("user") ||
    label.includes("person") ||
    label.includes("customer") ||
    label.includes("admin") ||
    type.includes("actor") ||
    type.includes("person")
  ) {
    return "USER";
  }

  if (
    label.includes("service") ||
    label.includes("api") ||
    label.includes("microservice")
  ) {
    return "SERVICE";
  }

  return "SYSTEM";
}

function allPositionsZero(nodes: DFDNode[]): boolean {
  return nodes.every((n) => n.position.x === 0 && n.position.y === 0);
}

/**
 * Simple auto-layout for DFD nodes.
 */
function autoLayoutDFDNodes(nodes: DFDNode[]): void {
  // Group by type
  const entities = nodes.filter((n) => n.type === "dfd-entity");
  const processes = nodes.filter((n) => n.type === "dfd-process");
  const datastores = nodes.filter((n) => n.type === "dfd-datastore");

  const START_X = 100;
  const START_Y = 100;
  const SPACING_X = 200;
  const SPACING_Y = 150;

  // Layout external entities on the left
  entities.forEach((node, i) => {
    node.position = { x: START_X, y: START_Y + i * SPACING_Y };
  });

  // Layout processes in the center
  processes.forEach((node, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    node.position = {
      x: START_X + SPACING_X + col * SPACING_X,
      y: START_Y + row * SPACING_Y,
    };
  });

  // Layout data stores on the right
  datastores.forEach((node, i) => {
    node.position = { x: START_X + SPACING_X * 4, y: START_Y + i * SPACING_Y };
  });
}
