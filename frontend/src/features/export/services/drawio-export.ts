/**
 * Draw.io export service
 * Exports canvas to Draw.io XML format
 */
import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData, BoundaryNodeData } from "@/types/canvas";
import { downloadBlob, sanitizeFilename } from "./download";
import { getNodeSize } from "@/stores/canvas/geometry";

export interface DrawioExportOptions {
  /** Include grid in the exported diagram */
  includeGrid?: boolean;
  /** Page width */
  pageWidth?: number;
  /** Page height */
  pageHeight?: number;
}

const DEFAULT_OPTIONS: DrawioExportOptions = {
  includeGrid: true,
  pageWidth: 1169,
  pageHeight: 827,
};

export function exportToDrawio(
  modelName: string,
  nodes: Node[],
  edges: Edge[],
  options: DrawioExportOptions = {},
): void {
  const content = generateDrawioXml(nodes, edges, options);
  const blob = new Blob([content], { type: "application/xml" });
  downloadBlob(blob, `${sanitizeFilename(modelName)}.drawio`);
}

function generateDrawioXml(
  nodes: Node[],
  edges: Edge[],
  options: DrawioExportOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cells: string[] = [];

  // Root cells (required by Draw.io)
  cells.push('<mxCell id="0"/>');
  cells.push('<mxCell id="1" parent="0"/>');

  // Generate boundary cells first (as parents)
  const boundaries = nodes.filter((n) => n.type === "boundary");
  for (const boundary of boundaries) {
    cells.push(generateBoundaryCell(boundary));
  }

  // Generate component cells
  const components = nodes.filter((n) => n.type === "component");
  for (const component of components) {
    cells.push(generateComponentCell(component));
  }

  // Generate edge cells
  for (const edge of edges) {
    cells.push(generateEdgeCell(edge));
  }

  // Assemble full XML
  const gridSettings = opts.includeGrid ? 'grid="1" gridSize="10"' : 'grid="0"';

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="ThreatForge" version="21.0.0" type="device">
  <diagram id="threat-model" name="Threat Model">
    <mxGraphModel dx="1422" dy="794" ${gridSettings} guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${opts.pageWidth}" pageHeight="${opts.pageHeight}" math="0" shadow="0">
      <root>
${cells.join("\n")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function generateBoundaryCell(node: Node): string {
  const data = node.data as BoundaryNodeData;
  const id = escapeXml(node.id);
  const label = escapeXml(data.label || "Trust Boundary");
  const x = Math.round(node.position.x);
  const y = Math.round(node.position.y);
  const { width, height } = getNodeSize(
    node as Parameters<typeof getNodeSize>[0],
  );

  const fillColor = data.color || "#dae8fc";
  const strokeColor = "#6c8ebf";

  return `        <mxCell id="${id}" value="${label}" style="swimlane;whiteSpace=wrap;html=1;fillColor=${fillColor};strokeColor=${strokeColor};startSize=23;rounded=1;opacity=${data.opacity || 30};" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
        </mxCell>`;
}

function generateComponentCell(node: Node): string {
  const data = node.data as ComponentNodeData;
  const id = escapeXml(node.id);
  const label = escapeXml(data.label || "Component");
  const x = Math.round(node.position.x);
  const y = Math.round(node.position.y);
  const width = 120;
  const height = 60;

  const parentId = node.parentId ? escapeXml(node.parentId) : "1";
  const { shape, fillColor, strokeColor } = getDrawioStyle(data.type);

  const style = buildStyle({
    shape,
    rounded: "1",
    whiteSpace: "wrap",
    html: "1",
    fillColor,
    strokeColor,
    verticalAlign: "middle",
    align: "center",
  });

  return `        <mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="${parentId}">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
        </mxCell>`;
}

function generateEdgeCell(edge: Edge): string {
  const id = escapeXml(edge.id);
  const sourceId = escapeXml(edge.source);
  const targetId = escapeXml(edge.target);
  const label = edge.label ? escapeXml(String(edge.label)) : "";

  const data = edge.data as { encrypted?: boolean } | undefined;
  const strokeColor = data?.encrypted ? "#82b366" : "#000000";
  const strokeWidth = data?.encrypted ? "2" : "1";
  const dashed = data?.encrypted ? "0" : "0";

  const style = buildStyle({
    edgeStyle: "orthogonalEdgeStyle",
    rounded: "1",
    orthogonalLoop: "1",
    jettySize: "auto",
    html: "1",
    strokeColor,
    strokeWidth,
    dashed,
    endArrow: "classic",
    endFill: "1",
  });

  return `        <mxCell id="${id}" value="${label}" style="${style}" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

function getDrawioStyle(type: string): {
  shape: string;
  fillColor: string;
  strokeColor: string;
} {
  const styles: Record<
    string,
    { shape: string; fillColor: string; strokeColor: string }
  > = {
    // Databases
    DATABASE: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#f9a825",
      strokeColor: "#c6a008",
    },
    AWS_RDS: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#f9a825",
      strokeColor: "#c6a008",
    },
    AWS_DYNAMODB: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#4527a0",
      strokeColor: "#311b92",
    },
    AZURE_SQL: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#0078d4",
      strokeColor: "#005a9e",
    },
    GCP_CLOUD_SQL: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#4285f4",
      strokeColor: "#185abc",
    },

    // Actors
    ACTOR: {
      shape: "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top",
      fillColor: "#4caf50",
      strokeColor: "#388e3c",
    },

    // External
    EXTERNAL_ENTITY: {
      shape: "shape=cloud",
      fillColor: "#e0e0e0",
      strokeColor: "#9e9e9e",
    },

    // Gateways
    API_GATEWAY: {
      shape: "rhombus",
      fillColor: "#2196f3",
      strokeColor: "#1565c0",
    },
    AWS_API_GATEWAY: {
      shape: "rhombus",
      fillColor: "#ff9800",
      strokeColor: "#f57c00",
    },

    // Serverless
    SERVERLESS: {
      shape: "hexagon",
      fillColor: "#ff5722",
      strokeColor: "#e64a19",
    },
    AWS_LAMBDA: {
      shape: "hexagon",
      fillColor: "#ff9800",
      strokeColor: "#f57c00",
    },
    AZURE_FUNCTIONS: {
      shape: "hexagon",
      fillColor: "#0078d4",
      strokeColor: "#005a9e",
    },
    GCP_CLOUD_FUNCTIONS: {
      shape: "hexagon",
      fillColor: "#4285f4",
      strokeColor: "#185abc",
    },

    // Queues
    QUEUE: {
      shape: "shape=parallelogram",
      fillColor: "#795548",
      strokeColor: "#5d4037",
    },
    AWS_SQS: {
      shape: "shape=parallelogram",
      fillColor: "#ff9800",
      strokeColor: "#f57c00",
    },

    // Web/Mobile
    WEB_APP: {
      shape: "rounded=1",
      fillColor: "#673ab7",
      strokeColor: "#512da8",
    },
    MOBILE_APP: {
      shape: "rounded=1",
      fillColor: "#e91e63",
      strokeColor: "#c2185b",
    },

    // Services
    MICROSERVICE: {
      shape: "rounded=1",
      fillColor: "#00bcd4",
      strokeColor: "#00838f",
    },
    API: { shape: "rounded=1", fillColor: "#00bcd4", strokeColor: "#00838f" },

    // Infrastructure
    LOAD_BALANCER: {
      shape: "shape=mxgraph.arrows2.arrow;dy=0.6;dx=40;notch=0",
      fillColor: "#9c27b0",
      strokeColor: "#7b1fa2",
    },
    FIREWALL: {
      shape: "shape=mxgraph.azure.firewall",
      fillColor: "#f44336",
      strokeColor: "#d32f2f",
    },
    CDN: { shape: "ellipse", fillColor: "#3f51b5", strokeColor: "#303f9f" },

    // Cache
    CACHE: {
      shape: "shape=parallelogram",
      fillColor: "#607d8b",
      strokeColor: "#455a64",
    },

    // Containers
    CONTAINER: {
      shape: "rounded=1;arcSize=10",
      fillColor: "#2196f3",
      strokeColor: "#1565c0",
    },
    AWS_ECS: {
      shape: "rounded=1;arcSize=10",
      fillColor: "#ff9800",
      strokeColor: "#f57c00",
    },
    AWS_EKS: {
      shape: "rounded=1;arcSize=10",
      fillColor: "#ff9800",
      strokeColor: "#f57c00",
    },

    // Storage
    AWS_S3: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#e57373",
      strokeColor: "#d32f2f",
    },
    AZURE_BLOB_STORAGE: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#0078d4",
      strokeColor: "#005a9e",
    },
    GCP_CLOUD_STORAGE: {
      shape: "shape=cylinder3;boundedLbl=1;stencilFlipV=1",
      fillColor: "#4285f4",
      strokeColor: "#185abc",
    },
  };

  return (
    styles[type] || {
      shape: "rounded=1",
      fillColor: "#ffffff",
      strokeColor: "#000000",
    }
  );
}

function buildStyle(props: Record<string, string>): string {
  return (
    Object.entries(props)
      .map(([key, value]) => `${key}=${value}`)
      .join(";") + ";"
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
