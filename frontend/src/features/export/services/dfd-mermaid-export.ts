/**
 * Export Data Flow Diagrams (DFD) to Mermaid format.
 * Uses flowchart with styled nodes to represent DFD elements.
 */
import type { DataFlowDiagram, DFDDataFlow } from "@/features/dfd";
import { downloadFile } from "./download";

export interface DFDMermaidOptions {
  /** Direction: TB (top-bottom), LR (left-right) */
  direction?: "TB" | "LR";
  /** Include data types on flows */
  includeDataTypes?: boolean;
}

const DEFAULT_OPTIONS: DFDMermaidOptions = {
  direction: "TB",
  includeDataTypes: true,
};

/**
 * Generate Mermaid flowchart content from a DFD.
 * DFD elements are mapped to Mermaid shapes:
 * - Process: rounded rectangle ((...))
 * - Data Store: cylinder [(...)]
 * - External Entity: rectangle [...]
 * - Data Flow: arrows with labels
 */
function generateDFDMermaid(
  dfd: DataFlowDiagram,
  options: DFDMermaidOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [`flowchart ${opts.direction}`];
  lines.push("");

  // Track all node IDs for reference
  const nodeMap = new Map<string, string>();

  // Add external entities (rectangles) - typically at the edges
  if (dfd.externalEntities.length > 0) {
    lines.push("    %% External Entities");
    for (const entity of dfd.externalEntities) {
      const nodeId = sanitizeId(entity.nodeId);
      nodeMap.set(entity.id, nodeId);
      const label = sanitizeLabel(entity.name);
      // External entities use square brackets (rectangle)
      lines.push(`    ${nodeId}[${label}]`);
    }
    lines.push("");
  }

  // Add processes (circles/rounded rectangles)
  if (dfd.processes.length > 0) {
    lines.push("    %% Processes");
    for (const process of dfd.processes) {
      const nodeId = sanitizeId(process.nodeId);
      nodeMap.set(process.id, nodeId);
      const label = process.number
        ? `${process.number}. ${process.name}`
        : process.name;
      // Processes use double parentheses (rounded rectangle) or circle
      lines.push(`    ${nodeId}((${sanitizeLabel(label)}))`);
    }
    lines.push("");
  }

  // Add data stores (cylinders)
  if (dfd.dataStores.length > 0) {
    lines.push("    %% Data Stores");
    for (const store of dfd.dataStores) {
      const nodeId = sanitizeId(store.nodeId);
      nodeMap.set(store.id, nodeId);
      const label = store.number
        ? `D${store.number}: ${store.name}`
        : store.name;
      // Data stores use cylinder shape
      lines.push(`    ${nodeId}[(${sanitizeLabel(label)})]`);
    }
    lines.push("");
  }

  // Add data flows (arrows)
  if (dfd.dataFlows.length > 0) {
    lines.push("    %% Data Flows");
    for (const flow of dfd.dataFlows) {
      const sourceId = getSourceId(flow, nodeMap);
      const targetId = getTargetId(flow, nodeMap);

      if (!sourceId || !targetId) continue;

      let label = flow.name;
      if (opts.includeDataTypes && flow.dataTypes.length > 0) {
        label += ` [${flow.dataTypes.join(", ")}]`;
      }

      lines.push(`    ${sourceId} -->|${sanitizeLabel(label)}| ${targetId}`);
    }
    lines.push("");
  }

  // Add styling for DFD elements
  lines.push("    %% Styling");
  lines.push(
    "    classDef process fill:#e1f5fe,stroke:#0288d1,stroke-width:2px",
  );
  lines.push(
    "    classDef datastore fill:#fff3e0,stroke:#f57c00,stroke-width:2px",
  );
  lines.push(
    "    classDef external fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px",
  );

  // Apply classes to nodes
  const processIds = dfd.processes.map((p) => sanitizeId(p.nodeId));
  const datastoreIds = dfd.dataStores.map((d) => sanitizeId(d.nodeId));
  const externalIds = dfd.externalEntities.map((e) => sanitizeId(e.nodeId));

  if (processIds.length > 0) {
    lines.push(`    class ${processIds.join(",")} process`);
  }
  if (datastoreIds.length > 0) {
    lines.push(`    class ${datastoreIds.join(",")} datastore`);
  }
  if (externalIds.length > 0) {
    lines.push(`    class ${externalIds.join(",")} external`);
  }

  return lines.join("\n");
}

/**
 * Export a DFD to a Mermaid .mmd file.
 */
export function exportDFDToMermaid(
  dfd: DataFlowDiagram,
  options: DFDMermaidOptions = {},
): void {
  const content = generateDFDMermaid(dfd, options);
  const filename = `${sanitizeFilename(dfd.name)}-dfd.mmd`;
  downloadFile(content, filename, "text/plain");
}

function getSourceId(
  flow: DFDDataFlow,
  nodeMap: Map<string, string>,
): string | null {
  if (flow.sourceProcessId) return nodeMap.get(flow.sourceProcessId) || null;
  if (flow.sourceDataStoreId)
    return nodeMap.get(flow.sourceDataStoreId) || null;
  if (flow.sourceEntityId) return nodeMap.get(flow.sourceEntityId) || null;
  return null;
}

function getTargetId(
  flow: DFDDataFlow,
  nodeMap: Map<string, string>,
): string | null {
  if (flow.targetProcessId) return nodeMap.get(flow.targetProcessId) || null;
  if (flow.targetDataStoreId)
    return nodeMap.get(flow.targetDataStoreId) || null;
  if (flow.targetEntityId) return nodeMap.get(flow.targetEntityId) || null;
  return null;
}

function sanitizeId(id: string): string {
  // Mermaid IDs must be alphanumeric with underscores
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function sanitizeLabel(label: string): string {
  // Escape special characters in labels
  return label
    .replace(/"/g, "'")
    .replace(/[[\]{}()#&;|]/g, " ")
    .trim();
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
