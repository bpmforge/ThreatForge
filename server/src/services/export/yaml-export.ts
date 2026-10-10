/**
 * YAML Export/Import
 *
 * Exports threat models as human-readable YAML for git versioning.
 * Imports YAML back into canvas format for round-trip editing.
 *
 * The YAML format is designed to be:
 * - Diffable (git diff shows meaningful changes)
 * - Readable (a human can understand the threat model)
 * - Complete (round-trip: export → edit → import preserves all data)
 */

export interface YAMLThreatModel {
  version: "1.0";
  name: string;
  description?: string;
  generatedAt: string;
  components: YAMLComponent[];
  connections: YAMLConnection[];
  boundaries: YAMLBoundary[];
  threats: YAMLThreat[];
  mitigations: YAMLMitigation[];
}

interface YAMLComponent {
  id: string;
  name: string;
  type: string;
  trustLevel?: string;
  description?: string;
  dataClassification?: string;
  technology?: string;
  /** Rich label, constrained Markdown subset). `name` stays the plain fallback. */
  richLabel?: string;
}

interface YAMLConnection {
  from: string;
  to: string;
  label?: string;
  protocol?: string;
  encrypted?: boolean;
  authMethod?: string;
}

interface YAMLBoundary {
  name: string;
  components: string[]; // Component IDs
}

interface YAMLThreat {
  name: string;
  description?: string;
  stride: string;
  severity: string;
  status: string;
  component?: string; // Component ID
  evidence?: {
    owasp?: string;
    cwe?: string;
    compliance?: string;
  };
}

interface YAMLMitigation {
  threat: string; // Threat name
  description: string;
  status: string;
  priority: string;
  strategy?: string;
}

/**
 * Export a threat model to YAML format.
 */
export function exportToYAML(model: {
  name: string;
  description?: string;
  components: Array<{
    id: string;
    name: string;
    type: string;
    data?: Record<string, unknown>;
  }>;
  connections: Array<{
    source: string;
    target: string;
    label?: string;
    data?: Record<string, unknown>;
  }>;
  boundaries: Array<{ name: string; componentIds: string[] }>;
  threats: Array<{
    name: string;
    description?: string;
    strideCategories: string;
    severity: string;
    status: string;
    componentNodeId?: string | null;
  }>;
  mitigations: Array<{
    description: string;
    status: string;
    priority: string;
    strategy?: string;
    threat?: { name: string };
  }>;
}): string {
  const lines: string[] = [];

  lines.push("# ThreatForge — YAML Export");
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(
    "# This file can be committed to git and imported back into ThreatForge.",
  );
  lines.push("");
  lines.push("version: '1.0'");
  lines.push(`name: "${escapeYaml(model.name)}"`);
  if (model.description) {
    lines.push(`description: "${escapeYaml(model.description)}"`);
  }
  lines.push("");

  // Components
  if (model.components.length > 0) {
    lines.push("components:");
    for (const comp of model.components) {
      lines.push(`  - id: ${comp.id}`);
      lines.push(`    name: "${escapeYaml(comp.name)}"`);
      lines.push(`    type: ${comp.type}`);
      if (comp.data?.trustLevel)
        lines.push(`    trustLevel: ${comp.data.trustLevel}`);
      if (comp.data?.description)
        lines.push(
          `    description: "${escapeYaml(String(comp.data.description))}"`,
        );
      if (comp.data?.dataClassification)
        lines.push(`    dataClassification: ${comp.data.dataClassification}`);
      const rich = normalizeRichLabel(comp.data?.richLabel);
      if (rich) lines.push(`    richLabel: "${escapeYaml(rich)}"`);
    }
    lines.push("");
  }

  // Connections
  if (model.connections.length > 0) {
    lines.push("connections:");
    for (const conn of model.connections) {
      lines.push(`  - from: ${conn.source}`);
      lines.push(`    to: ${conn.target}`);
      if (conn.label) lines.push(`    label: "${escapeYaml(conn.label)}"`);
      if (conn.data?.protocol)
        lines.push(`    protocol: ${conn.data.protocol}`);
      if (conn.data?.encrypted !== undefined)
        lines.push(`    encrypted: ${conn.data.encrypted}`);
      if (conn.data?.authMethod)
        lines.push(`    authMethod: ${conn.data.authMethod}`);
    }
    lines.push("");
  }

  // Boundaries
  if (model.boundaries.length > 0) {
    lines.push("boundaries:");
    for (const boundary of model.boundaries) {
      lines.push(`  - name: "${escapeYaml(boundary.name)}"`);
      lines.push(`    components: [${boundary.componentIds.join(", ")}]`);
    }
    lines.push("");
  }

  // Threats
  if (model.threats.length > 0) {
    lines.push("threats:");
    for (const threat of model.threats) {
      lines.push(`  - name: "${escapeYaml(threat.name)}"`);
      if (threat.description)
        lines.push(`    description: "${escapeYaml(threat.description)}"`);
      try {
        const cats = JSON.parse(threat.strideCategories) as string[];
        lines.push(`    stride: ${cats.join(", ")}`);
      } catch {
        lines.push(`    stride: ${threat.strideCategories}`);
      }
      lines.push(`    severity: ${threat.severity}`);
      lines.push(`    status: ${threat.status}`);
      if (threat.componentNodeId)
        lines.push(`    component: ${threat.componentNodeId}`);
    }
    lines.push("");
  }

  // Mitigations
  if (model.mitigations.length > 0) {
    lines.push("mitigations:");
    for (const mit of model.mitigations) {
      if (mit.threat?.name)
        lines.push(`  - threat: "${escapeYaml(mit.threat.name)}"`);
      else lines.push(`  - threat: "unknown"`);
      lines.push(`    description: "${escapeYaml(mit.description)}"`);
      lines.push(`    status: ${mit.status}`);
      lines.push(`    priority: ${mit.priority}`);
      if (mit.strategy) lines.push(`    strategy: ${mit.strategy}`);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Parse YAML back into a structure that can be imported to the canvas.
 * Simple parser — handles the specific format we export.
 */
export function parseYAMLThreatModel(yaml: string): YAMLThreatModel | null {
  try {
    const result: YAMLThreatModel = {
      version: "1.0",
      name: "",
      generatedAt: new Date().toISOString(),
      components: [],
      connections: [],
      boundaries: [],
      threats: [],
      mitigations: [],
    };

    // Extract top-level fields
    const nameMatch = yaml.match(/^name:\s*"([^"]+)"/m);
    if (nameMatch) {
      result.name = nameMatch[1]!;
    } else {
      // Name is required — reject YAML without it
      return null;
    }

    const descMatch = yaml.match(/^description:\s*"([^"]+)"/m);
    if (descMatch) result.description = descMatch[1];

    // Extract component blocks
    const compSection = extractSection(yaml, "components:");
    if (compSection) {
      const items = compSection.split(/\n\s*-\s+/).filter(Boolean);
      for (const rawItem of items) {
        // richLabel is quoted/escaped and may contain `key:` text; pull it out first
        const { rest: item, richLabel } = extractRichLabel(rawItem);
        const comp: YAMLComponent = {
          id:
            extractField(item, "id") ||
            `comp-${Math.random().toString(36).slice(2, 8)}`,
          name: extractField(item, "name") || "Unknown",
          type: extractField(item, "type") || "SERVICE",
          trustLevel: extractField(item, "trustLevel"),
          description: extractField(item, "description"),
          dataClassification: extractField(item, "dataClassification"),
          technology: extractField(item, "technology"),
          ...(richLabel ? { richLabel } : {}),
        };
        result.components.push(comp);
      }
    }

    // Extract threat blocks
    const threatSection = extractSection(yaml, "threats:");
    if (threatSection) {
      const items = threatSection.split(/\n\s*-\s+/).filter(Boolean);
      for (const item of items) {
        const threat: YAMLThreat = {
          name: extractField(item, "name") || "Unknown Threat",
          description: extractField(item, "description"),
          stride: extractField(item, "stride") || "TAMPERING",
          severity: extractField(item, "severity") || "MEDIUM",
          status: extractField(item, "status") || "OPEN",
          component: extractField(item, "component"),
        };
        result.threats.push(threat);
      }
    }

    // Extract connection blocks
    const connSection = extractSection(yaml, "connections:");
    if (connSection) {
      const items = connSection.split(/\n\s*-\s+/).filter(Boolean);
      for (const item of items) {
        const conn: YAMLConnection = {
          from: extractField(item, "from") || "",
          to: extractField(item, "to") || "",
          label: extractField(item, "label"),
          protocol: extractField(item, "protocol"),
          encrypted: extractField(item, "encrypted") === "true",
          authMethod: extractField(item, "authMethod"),
        };
        if (conn.from && conn.to) {
          result.connections.push(conn);
        }
      }
    }

    // Extract mitigation blocks
    const mitSection = extractSection(yaml, "mitigations:");
    if (mitSection) {
      const items = mitSection.split(/\n\s*-\s+/).filter(Boolean);
      for (const item of items) {
        const mit: YAMLMitigation = {
          threat: extractField(item, "threat") || "",
          description: extractField(item, "description") || "",
          status: extractField(item, "status") || "NOT_IMPLEMENTED",
          priority: extractField(item, "priority") || "MEDIUM",
          strategy: extractField(item, "strategy"),
        };
        if (mit.description) {
          result.mitigations.push(mit);
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

export const RICH_LABEL_MAX_LENGTH = 2000;

/** Normalize a rich label: strip control chars, unify newlines, cap length. */
export function normalizeRichLabel(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const s = input
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, RICH_LABEL_MAX_LENGTH);
  return s.trim() === "" ? undefined : s;
}

function extractRichLabel(block: string): {
  rest: string;
  richLabel?: string;
} {
  const m = block.match(/^[ \t]*richLabel:[ \t]*"((?:[^"\\\n]|\\.)*)"[ \t]*$/m);
  if (!m) return { rest: block };
  const unescaped = (m[1] ?? "").replace(/\\(.)/g, (_, c: string) =>
    c === "n" ? "\n" : c,
  );
  return {
    rest: block.replace(m[0], ""),
    richLabel: normalizeRichLabel(unescaped),
  };
}

function escapeYaml(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function extractSection(yaml: string, header: string): string | null {
  const idx = yaml.indexOf(header);
  if (idx === -1) return null;

  const start = idx + header.length;
  // Find next top-level section (line starting with a letter)
  const nextSection = yaml.substring(start).search(/^\w+:/m);
  if (nextSection === -1) return yaml.substring(start);
  return yaml.substring(start, start + nextSection);
}

function extractField(block: string, field: string): string | undefined {
  const pattern = new RegExp(`${field}:\\s*"?([^"\\n]+)"?`);
  const match = block.match(pattern);
  return match?.[1]?.trim();
}
