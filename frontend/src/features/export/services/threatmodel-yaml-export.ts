/**
 * Threat Model as Code — security-focused YAML export.
 *
 * Produces a human-readable, git-committable threatforge.yaml with:
 *   version, model metadata, components, connections, threats + mitigations.
 *
 * This is intentionally different from yaml-export.ts (which dumps raw canvas JSON).
 */
import type { Node, Edge } from "@xyflow/react";
import type { ExportThreat } from "../types";
import { downloadBlob, sanitizeFilename } from "./download";
import { normalizeRichLabel } from "@/lib/rich-label";

interface ComponentData {
  label?: string;
  name?: string;
  type?: string;
  technology?: string;
  trustZone?: string;
  dataHandled?: string[];
  [key: string]: unknown;
}

interface SecurityYamlComponent {
  id: string;
  type: string;
  name: string;
  technology?: string;
  trustZone?: string;
  dataHandled?: string[];
  richLabel?: string;
}

interface SecurityYamlConnection {
  source: string;
  target: string;
  protocol?: string;
  encrypted?: boolean;
  label?: string;
}

interface SecurityYamlMitigation {
  description: string;
  status: string;
  priority: string;
  controlCategory?: string;
  testCriteria?: string;
}

interface SecurityYamlThreat {
  id: string;
  name: string;
  description?: string;
  categories: string[];
  severity: string;
  status: string;
  componentId?: string;
  cweIds?: string[];
  mitigations: SecurityYamlMitigation[];
}

interface SecurityYamlModel {
  version: "1.0";
  exportedAt: string;
  model: {
    id: string | null;
    name: string;
  };
  components: SecurityYamlComponent[];
  connections: SecurityYamlConnection[];
  threats: SecurityYamlThreat[];
}

/** Simple YAML serializer (scalar-safe) */
function toYaml(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return String(obj);
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") {
    if (
      obj.includes("\n") ||
      obj.includes(":") ||
      obj.includes("#") ||
      obj.includes('"') ||
      obj.includes("'") ||
      obj === ""
    ) {
      return `"${obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => {
        const val = toYaml(item, indent + 1);
        if (typeof item === "object" && item !== null) {
          return `${pad}- ${val.trimStart()}`;
        }
        return `${pad}- ${val}`;
      })
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && v !== null,
    );
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        if (
          typeof v === "object" &&
          v !== null &&
          !Array.isArray(v) &&
          Object.keys(v).length > 0
        ) {
          return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
        }
        if (Array.isArray(v) && v.length > 0) {
          return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${toYaml(v, indent)}`;
      })
      .join("\n");
  }

  return String(obj);
}

/** Build security-focused YAML from canvas + threats */
export function exportThreatModelAsCode(
  modelId: string | null,
  modelName: string,
  nodes: Node[],
  edges: Edge[],
  threats: ExportThreat[],
): void {
  // Extract components (non-boundary nodes)
  const components: SecurityYamlComponent[] = nodes
    .filter((n) => n.type !== "boundary" && n.type !== "groupNode")
    .map((n) => {
      const data = (n.data ?? {}) as ComponentData;
      return {
        id: n.id,
        type: data.type ?? n.type ?? "unknown",
        name: data.label ?? data.name ?? n.id,
        ...(data.technology ? { technology: String(data.technology) } : {}),
        ...(normalizeRichLabel(data.richLabel)
          ? { richLabel: normalizeRichLabel(data.richLabel) }
          : {}),
        ...(data.trustZone ? { trustZone: String(data.trustZone) } : {}),
        ...(Array.isArray(data.dataHandled) && data.dataHandled.length > 0
          ? { dataHandled: data.dataHandled }
          : {}),
      };
    });

  // Extract connections
  const connections: SecurityYamlConnection[] = edges.map((e) => {
    const data = (e.data ?? {}) as Record<string, unknown>;
    return {
      source: e.source,
      target: e.target,
      ...(data.protocol ? { protocol: String(data.protocol) } : {}),
      ...(data.encrypted !== undefined
        ? { encrypted: Boolean(data.encrypted) }
        : {}),
      ...(e.label ? { label: String(e.label) } : {}),
    };
  });

  // Map threats to security schema
  const securityThreats: SecurityYamlThreat[] = threats.map((t) => ({
    id: t.id,
    name: t.name,
    ...(t.description ? { description: t.description } : {}),
    categories: t.strideCategories,
    severity: t.severity,
    status: t.status,
    ...(t.componentId ? { componentId: t.componentId } : {}),
    ...(t.cweIds && t.cweIds.length > 0 ? { cweIds: t.cweIds } : {}),
    mitigations: t.mitigations.map((m) => ({
      description: m.description,
      status: m.status,
      priority: m.priority,
    })),
  }));

  const doc: SecurityYamlModel = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    model: { id: modelId, name: modelName },
    components,
    connections,
    threats: securityThreats,
  };

  const lines = [
    "# ThreatForge — Threat Model as Code",
    `# Generated: ${doc.exportedAt}`,
    `# Validate with: ftm validate threatforge.yaml`,
    "",
    toYaml(doc),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/yaml" });
  downloadBlob(blob, `${sanitizeFilename(modelName)}-threatmodel.yaml`);
}
