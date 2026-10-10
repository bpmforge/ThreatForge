/**
 * Threat Model Tool Importer
 *
 * Imports threat models from other tools:
 * - Microsoft Threat Modeling Tool (.tm7 XML)
 * - OWASP Threat Dragon (.json)
 * - Threagile (.yaml)
 *
 * Converts to FTM's internal format for canvas display.
 */
import logger from "../../utils/logger.js";

export interface ImportedModel {
  name: string;
  source: "microsoft-tmt" | "owasp-dragon" | "threagile" | "unknown";
  components: Array<{
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number };
    properties?: Record<string, unknown>;
  }>;
  connections: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    properties?: Record<string, unknown>;
  }>;
  threats: Array<{
    name: string;
    description?: string;
    strideCategory: string;
    severity: string;
    status: string;
    componentId?: string;
  }>;
  boundaries: Array<{
    name: string;
    componentIds: string[];
  }>;
  warnings: string[];
}

/**
 * Auto-detect format and import.
 */
export function importThreatModel(
  content: string,
  filename?: string,
): ImportedModel {
  const ext = filename?.split(".").pop()?.toLowerCase();

  if (ext === "tm7" || content.includes("<ThreatModel")) {
    return importMicrosoftTMT(content);
  }
  if (ext === "json" || content.trim().startsWith("{")) {
    try {
      const json = JSON.parse(content);
      if (json.summary?.title || json.detail) {
        return importOWASPDragon(content);
      }
    } catch {
      /* not valid JSON */
    }
  }
  if (
    ext === "yaml" ||
    ext === "yml" ||
    content.includes("threagile_version:")
  ) {
    return importThreagile(content);
  }

  return {
    name: filename || "Imported Model",
    source: "unknown",
    components: [],
    connections: [],
    threats: [],
    boundaries: [],
    warnings: [
      "Could not detect source format. Supported: .tm7 (Microsoft TMT), .json (Threat Dragon), .yaml (Threagile)",
    ],
  };
}

// =============================================================================
// Microsoft Threat Modeling Tool (.tm7 XML)
// =============================================================================

function importMicrosoftTMT(xml: string): ImportedModel {
  const warnings: string[] = [];
  const components: ImportedModel["components"] = [];
  const connections: ImportedModel["connections"] = [];
  const threats: ImportedModel["threats"] = [];

  // Extract model name
  const nameMatch = xml.match(/<Name>([^<]+)<\/Name>/);
  const name = nameMatch?.[1] || "Microsoft TMT Import";

  // Extract elements (components)
  const elementPattern = /<Element[^>]*>([\s\S]*?)<\/Element>/g;
  let match;
  let idx = 0;

  while ((match = elementPattern.exec(xml)) !== null) {
    const block = match[1]!;
    const id = extractXMLField(block, "Id") || `tmt-${idx}`;
    const elemName = extractXMLField(block, "Name") || `Element ${idx}`;
    const elemType = extractXMLField(block, "GenericTypeId") || "";

    components.push({
      id,
      name: elemName,
      type: mapTMTType(elemType),
      position: {
        x: (idx % 5) * 200 + 100,
        y: Math.floor(idx / 5) * 200 + 100,
      },
    });
    idx++;
  }

  // Extract flows (connections)
  const flowPattern = /<Flow[^>]*>([\s\S]*?)<\/Flow>/g;
  let flowIdx = 0;

  while ((match = flowPattern.exec(xml)) !== null) {
    const block = match[1]!;
    const source = extractXMLField(block, "SourceGuid") || "";
    const target = extractXMLField(block, "TargetGuid") || "";
    const flowName = extractXMLField(block, "Name") || "";

    if (source && target) {
      connections.push({
        id: `flow-${flowIdx}`,
        source,
        target,
        label: flowName,
      });
    }
    flowIdx++;
  }

  // Extract threats
  const threatPattern = /<Threat[^>]*>([\s\S]*?)<\/Threat>/g;

  while ((match = threatPattern.exec(xml)) !== null) {
    const block = match[1]!;
    const threatName = extractXMLField(block, "Title") || "Unknown Threat";
    const category = extractXMLField(block, "Category") || "TAMPERING";
    const priority = extractXMLField(block, "Priority") || "Medium";

    threats.push({
      name: threatName,
      description: extractXMLField(block, "Description"),
      strideCategory: mapTMTStride(category),
      severity: mapTMTPriority(priority),
      status: "OPEN",
    });
  }

  logger.info(
    { name, components: components.length, threats: threats.length },
    "Microsoft TMT import complete",
  );

  return {
    name,
    source: "microsoft-tmt",
    components,
    connections,
    threats,
    boundaries: [],
    warnings,
  };
}

// =============================================================================
// OWASP Threat Dragon (.json)
// =============================================================================

function importOWASPDragon(jsonStr: string): ImportedModel {
  const warnings: string[] = [];

  try {
    const data = JSON.parse(jsonStr) as {
      summary?: { title?: string };
      detail?: {
        diagrams?: Array<{
          cells?: Array<{
            type?: string;
            attrs?: { text?: { text?: string } };
            id?: string;
            position?: { x: number; y: number };
            source?: { id?: string };
            target?: { id?: string };
            threats?: Array<{
              title?: string;
              type?: string;
              severity?: string;
              status?: string;
              description?: string;
            }>;
          }>;
        }>;
      };
    };

    const name = data.summary?.title || "Threat Dragon Import";
    const components: ImportedModel["components"] = [];
    const connections: ImportedModel["connections"] = [];
    const threats: ImportedModel["threats"] = [];

    const diagrams = data.detail?.diagrams || [];
    for (const diagram of diagrams) {
      for (const cell of diagram.cells || []) {
        if (cell.source?.id && cell.target?.id) {
          // It's a connection
          connections.push({
            id: cell.id || `conn-${connections.length}`,
            source: cell.source.id,
            target: cell.target.id,
          });
          // Threats can also live on flow cells in Threat Dragon
          for (const threat of cell.threats || []) {
            threats.push({
              name: threat.title || "Unknown",
              description: threat.description,
              strideCategory: mapDragonStride(threat.type || ""),
              severity: (threat.severity || "Medium").toUpperCase(),
              status: threat.status === "Mitigated" ? "MITIGATED" : "OPEN",
            });
          }
        } else if (cell.id && cell.attrs?.text?.text) {
          // It's a component
          components.push({
            id: cell.id,
            name: cell.attrs.text.text,
            type: mapDragonType(cell.type || ""),
            position: cell.position || { x: components.length * 200, y: 100 },
          });

          // Extract threats from component
          for (const threat of cell.threats || []) {
            threats.push({
              name: threat.title || "Unknown",
              description: threat.description,
              strideCategory: mapDragonStride(threat.type || ""),
              severity: (threat.severity || "Medium").toUpperCase(),
              status: threat.status === "Mitigated" ? "MITIGATED" : "OPEN",
              componentId: cell.id,
            });
          }
        }
      }
    }

    return {
      name,
      source: "owasp-dragon",
      components,
      connections,
      threats,
      boundaries: [],
      warnings,
    };
  } catch (err) {
    return {
      name: "Failed Import",
      source: "owasp-dragon",
      components: [],
      connections: [],
      threats: [],
      boundaries: [],
      warnings: [
        `Failed to parse Threat Dragon JSON: ${err instanceof Error ? err.message : "unknown"}`,
      ],
    };
  }
}

// =============================================================================
// Threagile (.yaml)
// =============================================================================

function importThreagile(yaml: string): ImportedModel {
  const warnings: string[] = [];
  const components: ImportedModel["components"] = [];
  const connections: ImportedModel["connections"] = [];

  // Extract title
  const titleMatch = yaml.match(/title:\s*"?([^"\n]+)"?/);
  const name = titleMatch?.[1] || "Threagile Import";

  // Extract technical assets (components)
  const assetsSection =
    yaml.match(/technical_assets:([\s\S]*?)(?=\n\w|$)/)?.[1] || "";
  const assetPattern = /\s{2}(\w[\w-]*):\s*\n((?:\s{4}.*\n)*)/g;
  let match;
  let idx = 0;

  while ((match = assetPattern.exec(assetsSection)) !== null) {
    const assetId = match[1]!;
    const block = match[2]!;

    const assetType = extractYAMLField(block, "type") || "process";
    const assetName = extractYAMLField(block, "description") || assetId;

    components.push({
      id: assetId,
      name: assetName,
      type: mapThreagileType(assetType),
      position: {
        x: (idx % 5) * 200 + 100,
        y: Math.floor(idx / 5) * 200 + 100,
      },
    });
    idx++;
  }

  // Extract communication links (connections)
  const commSection =
    yaml.match(/communication_links:([\s\S]*?)(?=\n\w|$)/)?.[1] || "";
  const commPattern = /\s{4}(\w[\w-]*):\s*\n((?:\s{6}.*\n)*)/g;

  while ((match = commPattern.exec(commSection)) !== null) {
    const block = match[2]!;
    const target = extractYAMLField(block, "target") || "";
    const source = extractYAMLField(block, "source") || "";

    if (source && target) {
      connections.push({
        id: `comm-${connections.length}`,
        source,
        target,
        label: match[1],
      });
    }
  }

  logger.info(
    { name, components: components.length, connections: connections.length },
    "Threagile import complete",
  );

  return {
    name,
    source: "threagile",
    components,
    connections,
    threats: [],
    boundaries: [],
    warnings,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function extractXMLField(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match?.[1];
}

function extractYAMLField(block: string, field: string): string | undefined {
  const match = block.match(new RegExp(`${field}:\\s*"?([^"\\n]+)"?`));
  return match?.[1]?.trim();
}

function mapTMTType(type: string): string {
  if (type.includes("Process")) return "SERVICE";
  if (type.includes("DataStore")) return "DATABASE";
  if (type.includes("ExternalInteractor")) return "EXTERNAL_USER";
  if (type.includes("DataFlow")) return "API";
  return "SERVICE";
}

function mapTMTStride(category: string): string {
  const map: Record<string, string> = {
    Spoofing: "SPOOFING",
    Tampering: "TAMPERING",
    Repudiation: "REPUDIATION",
    "Information Disclosure": "INFORMATION_DISCLOSURE",
    "Denial of Service": "DENIAL_OF_SERVICE",
    "Elevation of Privilege": "ELEVATION_OF_PRIVILEGE",
  };
  return map[category] || "TAMPERING";
}

function mapTMTPriority(priority: string): string {
  const map: Record<string, string> = {
    High: "HIGH",
    Medium: "MEDIUM",
    Low: "LOW",
    Critical: "CRITICAL",
  };
  return map[priority] || "MEDIUM";
}

function mapDragonType(type: string): string {
  if (type.includes("process")) return "SERVICE";
  if (type.includes("store")) return "DATABASE";
  if (type.includes("actor")) return "EXTERNAL_USER";
  if (type.includes("flow")) return "API";
  return "SERVICE";
}

function mapDragonStride(type: string): string {
  const map: Record<string, string> = {
    Spoofing: "SPOOFING",
    Tampering: "TAMPERING",
    Repudiation: "REPUDIATION",
    "Information disclosure": "INFORMATION_DISCLOSURE",
    "Denial of service": "DENIAL_OF_SERVICE",
    "Elevation of privilege": "ELEVATION_OF_PRIVILEGE",
  };
  return map[type] || "TAMPERING";
}

function mapThreagileType(type: string): string {
  const map: Record<string, string> = {
    process: "SERVICE",
    datastore: "DATABASE",
    external_entity: "EXTERNAL_USER",
    "web-application": "WEB_APP",
    "web-service": "API",
  };
  return map[type] || "SERVICE";
}
