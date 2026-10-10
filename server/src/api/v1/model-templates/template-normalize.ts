/**
 * Normalizes a ModelTemplate row into the shape POST /threat-models/from-template
 * writes to the database.
 *
 * Two producers write ModelTemplate rows with different shapes:
 *  - "Save as template" stores flat items: components with positionX/positionY,
 *    boundaries with geometry, threats with strideCategories[] and mitigations[].
 *  - The built-in seed (prisma/seed/templates.ts) stores canvasState nodes only
 *    (`components` is left empty), boundaries as { name, componentIds }, and
 *    threats with a single strideCategory and a mitigation string, using
 *    design-time component types and trust names (WEB_APP, DMZ, ...) that are not
 *    Prisma enum values.
 * Both must instantiate; before this, built-ins failed on a missing positionX.
 */

type ComponentTypeEnum =
  | "EXTERNAL_USER"
  | "INTERNAL_USER"
  | "EXTERNAL_SYSTEM"
  | "SERVICE"
  | "API"
  | "FUNCTION"
  | "PROCESS"
  | "DATABASE"
  | "FILE_STORAGE"
  | "CACHE"
  | "QUEUE"
  | "LOAD_BALANCER"
  | "FIREWALL"
  | "API_GATEWAY";

type TrustLevelEnum = "HIGH" | "MEDIUM" | "LOW" | "UNTRUSTED";
type SeverityEnum = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

const COMPONENT_TYPES = new Set<string>([
  "EXTERNAL_USER",
  "INTERNAL_USER",
  "EXTERNAL_SYSTEM",
  "SERVICE",
  "API",
  "FUNCTION",
  "PROCESS",
  "DATABASE",
  "FILE_STORAGE",
  "CACHE",
  "QUEUE",
  "LOAD_BALANCER",
  "FIREWALL",
  "API_GATEWAY",
]);

// Seed/design-time type names with no Prisma enum value of their own.
const TYPE_ALIASES: Record<string, ComponentTypeEnum> = {
  DATA_STORE: "DATABASE",
  OBJECT_STORAGE: "FILE_STORAGE",
  SERVERLESS: "FUNCTION",
  EXTERNAL_ENTITY: "EXTERNAL_SYSTEM",
  ACTOR: "EXTERNAL_USER",
};

const TRUST_LEVELS = new Set<string>(["HIGH", "MEDIUM", "LOW", "UNTRUSTED"]);
const TRUST_ALIASES: Record<string, TrustLevelEnum> = {
  EXTERNAL: "UNTRUSTED",
  DMZ: "LOW",
  INTERNAL: "MEDIUM",
};

const SEVERITIES = new Set<string>([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
]);

// Canvas node footprint and the margin a derived boundary leaves around members.
const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const BOUNDARY_PADDING = 60;

export interface NormalizedComponent {
  /** Id the template uses to refer to this component (boundary membership). */
  templateId?: string;
  type: ComponentTypeEnum;
  name: string;
  description?: string;
  trustLevel: TrustLevelEnum;
  properties: Record<string, unknown>;
  positionX: number;
  positionY: number;
}

export interface NormalizedBoundary {
  name: string;
  trustLevel: TrustLevelEnum;
  description?: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export interface NormalizedThreat {
  /** Template id of the component this threat applies to, when it names one. */
  componentTemplateId?: string;
  name: string;
  description?: string;
  strideCategories: string[];
  severity: SeverityEnum;
  category?: string;
  complianceControls: Record<string, string[]>;
  cweIds: string[];
  owaspIds: string[];
  mitigations: Array<{
    description: string;
    strategy: string;
    priority: string;
  }>;
}

export interface TemplateRow {
  canvasState: string | null;
  components: string | null;
  boundaries: string | null;
  threats: string | null;
}

type Json = Record<string, unknown>;

function parseArray(raw: string | null): Json[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Json[]) : [];
  } catch {
    return [];
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function toComponentType(raw: unknown): ComponentTypeEnum {
  const t = typeof raw === "string" ? raw.toUpperCase() : "";
  if (COMPONENT_TYPES.has(t)) return t as ComponentTypeEnum;
  return TYPE_ALIASES[t] ?? "SERVICE";
}

function toTrust(raw: unknown): TrustLevelEnum {
  const t = typeof raw === "string" ? raw.toUpperCase() : "";
  if (TRUST_LEVELS.has(t)) return t as TrustLevelEnum;
  return TRUST_ALIASES[t] ?? "MEDIUM";
}

/** Components from the flat column, else derived from the canvasState nodes. */
function normalizeComponents(row: TemplateRow): NormalizedComponent[] {
  const flat = parseArray(row.components);
  if (flat.length > 0) {
    return flat.map((c) => ({
      templateId: str(c.id),
      type: toComponentType(c.type),
      name: str(c.name) ?? "Component",
      description: str(c.description),
      trustLevel: toTrust(c.trustLevel),
      properties: (c.properties as Record<string, unknown>) ?? {},
      positionX: num(c.positionX, 0),
      positionY: num(c.positionY, 0),
    }));
  }

  let nodes: Json[] = [];
  try {
    const canvas = JSON.parse(row.canvasState ?? "{}") as { nodes?: Json[] };
    nodes = Array.isArray(canvas.nodes) ? canvas.nodes : [];
  } catch {
    nodes = [];
  }
  return nodes.map((n) => {
    const data = (n.data as Json | undefined) ?? {};
    const pos = (n.position as { x?: unknown; y?: unknown } | undefined) ?? {};
    return {
      templateId: str(n.id),
      type: toComponentType(data.type),
      name: str(data.name) ?? "Component",
      description: str(data.description),
      trustLevel: toTrust(data.trustLevel),
      properties: {},
      positionX: num(pos.x, 0),
      positionY: num(pos.y, 0),
    };
  });
}

function boundaryTrust(name: string): TrustLevelEnum {
  const n = name.toLowerCase();
  if (n.includes("internet") || n.includes("external")) return "UNTRUSTED";
  if (n.includes("dmz")) return "LOW";
  return "MEDIUM";
}

function normalizeBoundaries(
  row: TemplateRow,
  components: NormalizedComponent[],
): NormalizedBoundary[] {
  const byId = new Map(
    components.filter((c) => c.templateId).map((c) => [c.templateId, c]),
  );
  const members: Array<Extent | null> = [];
  const boxes = parseArray(row.boundaries).map((b) => {
    const name = str(b.name) ?? "Trust Boundary";
    const hasGeometry =
      typeof b.positionX === "number" && typeof b.width === "number";
    if (hasGeometry) {
      members.push(null);
      return {
        name,
        trustLevel: toTrust(b.trustLevel),
        description: str(b.description),
        positionX: num(b.positionX, 0),
        positionY: num(b.positionY, 0),
        width: num(b.width, NODE_WIDTH),
        height: num(b.height, NODE_HEIGHT),
      };
    }
    // Seed boundary: { name, componentIds } -> box around the member components.
    const ids = Array.isArray(b.componentIds)
      ? (b.componentIds as string[])
      : [];
    const inside = ids
      .map((id) => byId.get(id))
      .filter((c): c is NormalizedComponent => c !== undefined);
    if (inside.length === 0) {
      members.push(null);
      return {
        name,
        trustLevel: boundaryTrust(name),
        description: str(b.description),
        positionX: 0,
        positionY: 0,
        width: NODE_WIDTH + 2 * BOUNDARY_PADDING,
        height: NODE_HEIGHT + 2 * BOUNDARY_PADDING,
      };
    }
    const minX = Math.min(...inside.map((c) => c.positionX));
    const minY = Math.min(...inside.map((c) => c.positionY));
    const maxX = Math.max(...inside.map((c) => c.positionX)) + NODE_WIDTH;
    const maxY = Math.max(...inside.map((c) => c.positionY)) + NODE_HEIGHT;
    members.push({ minX, minY, maxX, maxY, ids: new Set(ids) });
    return {
      name,
      trustLevel: boundaryTrust(name),
      description: str(b.description),
      positionX: minX - BOUNDARY_PADDING,
      positionY: minY - BOUNDARY_PADDING,
      width: maxX - minX + 2 * BOUNDARY_PADDING,
      height: maxY - minY + 2 * BOUNDARY_PADDING,
    };
  });
  separateSiblings(boxes, members);
  return boxes;
}

interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ids: Set<string>;
}

/** Space left between two sibling boundaries whose padding would collide. */
const BOUNDARY_GAP = 8;

/**
 * Seed templates space components closer than two boundary paddings, so boxes
 * drawn around disjoint member sets overlapped. Where two sibling boxes
 * overlap, move their shared edge to the middle of the gap between their
 * members. Edges only move inward, so this never creates a new overlap, and
 * nested boundaries (one member set inside the other) are left alone.
 */
function separateSiblings(
  boxes: NormalizedBoundary[],
  members: Array<Extent | null>,
): void {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const ma = members[i];
      const mb = members[j];
      if (!ma || !mb || [...ma.ids].some((id) => mb.ids.has(id))) continue;
      const a = boxes[i];
      const b = boxes[j];
      const overlap =
        a.positionX < b.positionX + b.width &&
        b.positionX < a.positionX + a.width &&
        a.positionY < b.positionY + b.height &&
        b.positionY < a.positionY + a.height;
      if (!overlap) continue;
      const gapX = Math.max(mb.minX - ma.maxX, ma.minX - mb.maxX);
      const gapY = Math.max(mb.minY - ma.maxY, ma.minY - mb.maxY);
      if (Math.max(gapX, gapY) < BOUNDARY_GAP) continue;
      if (gapX >= gapY) {
        const [l, r, ml, mr] =
          ma.maxX <= mb.minX ? [a, b, ma, mb] : [b, a, mb, ma];
        const mid = (ml.maxX + mr.minX) / 2;
        l.width =
          Math.min(l.positionX + l.width, mid - BOUNDARY_GAP / 2) - l.positionX;
        const right = r.positionX + r.width;
        r.positionX = Math.max(r.positionX, mid + BOUNDARY_GAP / 2);
        r.width = right - r.positionX;
      } else {
        const [t, u, mt, mu] =
          ma.maxY <= mb.minY ? [a, b, ma, mb] : [b, a, mb, ma];
        const mid = (mt.maxY + mu.minY) / 2;
        t.height =
          Math.min(t.positionY + t.height, mid - BOUNDARY_GAP / 2) -
          t.positionY;
        const bottom = u.positionY + u.height;
        u.positionY = Math.max(u.positionY, mid + BOUNDARY_GAP / 2);
        u.height = bottom - u.positionY;
      }
    }
  }
}

function normalizeThreats(row: TemplateRow): NormalizedThreat[] {
  return parseArray(row.threats).map((t) => {
    const stride = Array.isArray(t.strideCategories)
      ? (t.strideCategories as string[])
      : str(t.strideCategory)
        ? [t.strideCategory as string]
        : [];
    const severity = String(t.severity ?? "MEDIUM").toUpperCase();
    const mitigations = Array.isArray(t.mitigations)
      ? (t.mitigations as NormalizedThreat["mitigations"])
      : str(t.mitigation)
        ? [
            {
              description: t.mitigation as string,
              strategy: "PREVENTION",
              priority: "MEDIUM",
            },
          ]
        : [];
    return {
      componentTemplateId: str(t.componentId),
      name: str(t.name) ?? "Threat",
      description: str(t.description),
      strideCategories: stride,
      severity: SEVERITIES.has(severity)
        ? (severity as SeverityEnum)
        : "MEDIUM",
      category: str(t.category),
      complianceControls:
        (t.complianceControls as Record<string, string[]> | undefined) ?? {},
      cweIds: Array.isArray(t.cweIds) ? (t.cweIds as string[]) : [],
      owaspIds: Array.isArray(t.owaspIds) ? (t.owaspIds as string[]) : [],
      mitigations,
    };
  });
}

export function normalizeTemplate(row: TemplateRow): {
  components: NormalizedComponent[];
  boundaries: NormalizedBoundary[];
  threats: NormalizedThreat[];
} {
  const components = normalizeComponents(row);
  return {
    components,
    boundaries: normalizeBoundaries(row, components),
    threats: normalizeThreats(row),
  };
}

// --- Canvas state -----------------------------------------------------------
// The editor reads `data.label`, canvas trust levels (PUBLIC..RESTRICTED) and
// explicit boundary nodes; the seed writes `data.name`, design-time trust names
// and keeps boundaries only as column data. Rebuild the editor shape for seeded
// templates; a template saved from the editor already has it and passes through.

type Canvas = { nodes?: Json[]; edges?: Json[]; [k: string]: unknown };

const CANVAS_TRUST = new Set([
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
]);
const NODE_TRUST: Record<string, string> = {
  EXTERNAL: "PUBLIC",
  DMZ: "INTERNAL",
};
const BOUNDARY_TRUST: Record<TrustLevelEnum, string> = {
  UNTRUSTED: "PUBLIC",
  // A DMZ (LOW) is internet-facing; the canvas has no DMZ level, and INTERNAL
  // told users the zone was private.
  LOW: "PUBLIC",
  MEDIUM: "INTERNAL",
  HIGH: "RESTRICTED",
};
const AUTH_LABELS: Record<string, string> = {
  NONE: "None",
  API_KEY: "API_KEY",
  JWT: "JWT",
  OAUTH2: "OAuth2",
  MTLS: "mTLS",
  BASIC: "Basic",
  SAML: "SAML",
};

function canvasNodeTrust(raw: unknown): string {
  const t = typeof raw === "string" ? raw.toUpperCase() : "";
  if (CANVAS_TRUST.has(t)) return t;
  return NODE_TRUST[t] ?? "INTERNAL";
}

export function buildCanvasState(
  canvasState: string | null,
  boundaries: NormalizedBoundary[],
): string | null {
  if (!canvasState) return canvasState;
  let canvas: Canvas;
  try {
    canvas = JSON.parse(canvasState) as Canvas;
  } catch {
    return canvasState;
  }
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : [];
  const seeded = nodes.some(
    (n) => n.type !== "boundary" && !str((n.data as Json | undefined)?.label),
  );
  if (!seeded) return canvasState;

  const componentNodes = nodes.map((n) => {
    const data = (n.data as Json | undefined) ?? {};
    return {
      ...n,
      data: {
        ...data,
        label: str(data.label) ?? str(data.name) ?? "Component",
        trustLevel: canvasNodeTrust(data.trustLevel),
      },
    };
  });
  const boundaryNodes = boundaries.map((b, i) => ({
    id: `boundary-${i}`,
    type: "boundary",
    position: { x: b.positionX, y: b.positionY },
    style: { width: b.width, height: b.height },
    zIndex: -1000,
    data: {
      label: b.name,
      description: b.description,
      trustLevel: BOUNDARY_TRUST[b.trustLevel],
    },
  }));
  const edges = (Array.isArray(canvas.edges) ? canvas.edges : []).map((e) => {
    const data = (e.data as Json | undefined) ?? {};
    const auth =
      AUTH_LABELS[String(data.authMethod ?? "NONE").toUpperCase()] ?? "None";
    return {
      ...e,
      data: {
        ...data,
        authentication: auth,
        authenticated: auth !== "None",
      },
    };
  });
  return JSON.stringify({
    ...canvas,
    nodes: [...boundaryNodes, ...componentNodes],
    edges,
  });
}
