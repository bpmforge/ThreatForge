/**
 * Converts parsed diagrams to ThreatForge canvas format
 */
import type { Node, Edge } from "@xyflow/react";
import type {
  ComponentNodeData,
  BoundaryNodeData,
  ConnectionData,
  ComponentType,
  Protocol,
} from "@/types/canvas";
import type {
  ParsedDiagram,
  ParsedShape,
  ParsedConnection,
  ParsedGroup,
} from "../types";

export interface ConversionResult {
  nodes: Node<ComponentNodeData | BoundaryNodeData>[];
  edges: Edge<ConnectionData>[];
  warnings: string[];
}

export interface ConversionOptions {
  /** Offset for all positions (useful when adding to existing canvas) */
  offset?: { x: number; y: number };
  /** Whether to auto-layout nodes or preserve original positions */
  preserveLayout?: boolean;
  /** Default trust level for imported components */
  defaultTrustLevel?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
}

const DEFAULT_OPTIONS: ConversionOptions = {
  offset: { x: 100, y: 100 },
  preserveLayout: true,
  defaultTrustLevel: "INTERNAL",
};

export function convertDiagramToCanvas(
  diagram: ParsedDiagram,
  options: ConversionOptions = {},
): ConversionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];
  const nodeIdMap = new Map<string, string>(); // Original ID -> New ID

  // Convert groups to boundary nodes first
  const boundaryNodes = diagram.groups.map((group, index) => {
    const newId = `boundary-${Date.now()}-${index}`;
    nodeIdMap.set(group.id, newId);

    return createBoundaryNode(newId, group, opts);
  });

  // Convert shapes to component nodes
  const componentNodes = diagram.shapes.map((shape, index) => {
    const newId = `component-${Date.now()}-${index}`;
    nodeIdMap.set(shape.id, newId);

    // Find parent boundary if shape is in a group
    const parentGroup = diagram.groups.find((g) =>
      g.childIds.includes(shape.id),
    );
    const parentId = parentGroup ? nodeIdMap.get(parentGroup.id) : undefined;

    return createComponentNode(newId, shape, opts, parentId);
  });

  // Convert connections to edges
  const edges: Edge<ConnectionData>[] = [];
  for (const conn of diagram.connections) {
    const sourceId = nodeIdMap.get(conn.sourceId);
    const targetId = nodeIdMap.get(conn.targetId);

    if (!sourceId || !targetId) {
      warnings.push(
        `Skipped connection "${conn.label || conn.id}": missing source or target node`,
      );
      continue;
    }

    edges.push(createEdge(conn, sourceId, targetId));
  }

  // Auto-layout if positions are all zero or not preserved
  let allNodes: Node<ComponentNodeData | BoundaryNodeData>[] = [
    ...boundaryNodes,
    ...componentNodes,
  ];
  if (!opts.preserveLayout || allPositionsZero(allNodes)) {
    allNodes = autoLayoutNodes(allNodes, boundaryNodes.length) as Node<
      ComponentNodeData | BoundaryNodeData
    >[];
  }

  return {
    nodes: allNodes,
    edges,
    warnings,
  };
}

function createBoundaryNode(
  id: string,
  group: ParsedGroup,
  opts: ConversionOptions,
): Node<BoundaryNodeData> {
  return {
    id,
    type: "boundary",
    position: {
      x: group.bounds.x + (opts.offset?.x || 0),
      y: group.bounds.y + (opts.offset?.y || 0),
    },
    data: {
      label: group.label || "Trust Boundary",
      description: "",
      trustLevel: opts.defaultTrustLevel || "INTERNAL",
      color: "#3b82f6",
      opacity: 30,
    },
    style: {
      width: group.bounds.width,
      height: group.bounds.height,
    },
  };
}

function createComponentNode(
  id: string,
  shape: ParsedShape,
  opts: ConversionOptions,
  parentId?: string,
): Node<ComponentNodeData> {
  const componentType = shape.inferredType || "MICROSERVICE";

  const node: Node<ComponentNodeData> = {
    id,
    type: "component",
    position: {
      x: shape.position.x + (opts.offset?.x || 0),
      y: shape.position.y + (opts.offset?.y || 0),
    },
    data: {
      label: shape.label || "Component",
      type: componentType as ComponentType,
      description: (shape.properties?.description as string) || "",
      trustLevel: opts.defaultTrustLevel || "INTERNAL",
      technologies: extractTechnologies(shape),
    },
  };

  if (parentId) {
    node.parentId = parentId;
    node.extent = "parent";
  }

  return node;
}

function createEdge(
  conn: ParsedConnection,
  sourceId: string,
  targetId: string,
): Edge<ConnectionData> {
  // Infer encryption from label
  const label = (conn.label || "").toLowerCase();
  const encrypted =
    label.includes("https") ||
    label.includes("tls") ||
    label.includes("ssl") ||
    label.includes("encrypted");

  // Infer authentication from label
  const authenticated =
    label.includes("auth") ||
    label.includes("jwt") ||
    label.includes("oauth") ||
    label.includes("token");

  // Infer protocol from label
  const protocol = inferProtocol(conn.label || "");

  return {
    id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    source: sourceId,
    target: targetId,
    type: "security",
    label: conn.label || "",
    data: {
      encrypted,
      authenticated,
      protocol,
    },
  };
}

function inferProtocol(label: string): Protocol | undefined {
  const lower = label.toLowerCase();
  if (lower.includes("https")) return "HTTPS";
  if (lower.includes("http")) return "HTTP";
  if (lower.includes("grpc")) return "gRPC";
  if (
    lower.includes("websocket") ||
    lower.includes("ws://") ||
    lower.includes("wss://")
  )
    return "WebSocket";
  if (lower.includes("tcp")) return "TCP";
  if (lower.includes("udp")) return "UDP";
  if (lower.includes("amqp") || lower.includes("rabbitmq")) return "AMQP";
  if (lower.includes("kafka")) return "Kafka";
  if (lower.includes("postgres")) return "PostgreSQL";
  if (lower.includes("mysql")) return "MySQL";
  if (lower.includes("mongo")) return "MongoDB";
  if (lower.includes("redis")) return "Redis";
  if (lower.includes("ssh")) return "SSH";
  if (lower.includes("mqtt")) return "MQTT";
  return undefined;
}

function extractTechnologies(shape: ParsedShape): string[] {
  const technologies: string[] = [];
  const label = (shape.label || "").toLowerCase();
  const props = shape.properties || {};

  // Extract from properties
  if (props.technology) {
    technologies.push(String(props.technology));
  }

  // Infer from label
  const techKeywords = [
    "node",
    "python",
    "java",
    "go",
    "rust",
    "ruby",
    "php",
    ".net",
    "c#",
    "react",
    "vue",
    "angular",
    "nextjs",
    "express",
    "fastify",
    "django",
    "flask",
    "spring",
    "rails",
    "laravel",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "kafka",
    "rabbitmq",
    "nginx",
    "apache",
    "docker",
    "kubernetes",
    "k8s",
    "aws",
    "azure",
    "gcp",
    "terraform",
    "graphql",
    "rest",
  ];

  for (const tech of techKeywords) {
    if (label.includes(tech)) {
      technologies.push(tech);
    }
  }

  return [...new Set(technologies)]; // Remove duplicates
}

function allPositionsZero(nodes: Node[]): boolean {
  return nodes.every((n) => n.position.x === 0 && n.position.y === 0);
}

function autoLayoutNodes(nodes: Node[], boundaryCount: number): Node[] {
  // Simple grid layout for components
  const GRID_COLS = 4;
  const CELL_WIDTH = 200;
  const CELL_HEIGHT = 150;
  const START_X = 100;
  const START_Y = 100;

  // Keep boundaries at their original positions or layout them vertically
  const boundaryNodes = nodes.slice(0, boundaryCount);
  const componentNodes = nodes.slice(boundaryCount);

  // Layout boundaries vertically on the left
  boundaryNodes.forEach((node, i) => {
    node.position = {
      x: START_X,
      y: START_Y + i * 350,
    };
  });

  // Layout components in a grid, grouped by parent
  const orphanComponents = componentNodes.filter((n) => !n.parentId);
  orphanComponents.forEach((node, i) => {
    const row = Math.floor(i / GRID_COLS);
    const col = i % GRID_COLS;
    node.position = {
      x: START_X + 450 + col * CELL_WIDTH,
      y: START_Y + row * CELL_HEIGHT,
    };
  });

  // Layout children within their parent boundaries
  const childComponents = componentNodes.filter((n) => n.parentId);
  const groupedByParent = new Map<string, Node[]>();
  childComponents.forEach((node) => {
    const parentId = node.parentId!;
    if (!groupedByParent.has(parentId)) {
      groupedByParent.set(parentId, []);
    }
    groupedByParent.get(parentId)!.push(node);
  });

  for (const [, children] of groupedByParent) {
    children.forEach((node, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      // Position relative to parent
      node.position = {
        x: 20 + col * 140,
        y: 50 + row * 100,
      };
    });
  }

  return [...boundaryNodes, ...componentNodes];
}
