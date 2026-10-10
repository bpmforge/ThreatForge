/**
 * Canvas Sync Service
 *
 * Synchronizes React Flow canvas state (JSON) to normalized database tables
 * (components, interfaces, connections, boundaries) for API access.
 *
 * Callers:
 * - POST /save-canvas — the frontend auto-save, every ~2s while editing, so
 *   this IS on the hot path of every save;
 * - version restore and status change (explicit canvas state);
 * - ensureCanvasSynced() — on-demand from the normalized read endpoints.
 *
 * Performance considerations:
 * - The sync diffs the canvas against existing rows: it keeps row ids, writes
 *   only what changed, and an unchanged canvas costs reads only
 * - ensureCanvasSynced compares updatedAt timestamps to avoid re-reading; that
 *   cache is per-process and only ever causes an extra (harmless) re-sync
 */
import { getPrisma } from "../db.js";
import type {
  AuthMethod,
  ComponentType,
  InterfaceDirection,
  InterfacePosition,
  PrismaClient,
  Protocol,
  TrustLevel,
} from "@prisma/client";
import logger from "../utils/logger.js";
import { computeAnalysisHash } from "./ai/analysis-hash.js";
import {
  COMPOUND_COMPONENT_SENTINEL,
  SUPPLY_CHAIN_COMPONENT_SENTINEL,
} from "./ai/micro-analysis/compound-analyzer.js";

/** Canvas state structure from React Flow */
interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

interface CanvasNode {
  id: string;
  type: "component" | "boundary";
  position: { x: number; y: number };
  data: ComponentData | BoundaryData;
  parentId?: string;
  width?: number;
  height?: number;
  /** React Flow keeps a resized boundary's size in style / measured. */
  style?: { width?: number | string; height?: number | string };
  measured?: { width?: number; height?: number };
}

/** The size the canvas actually renders: measured, else style, else width. */
function nodeSize(
  node: CanvasNode,
  dim: "width" | "height",
): number | undefined {
  const styleVal = node.style?.[dim];
  return (
    node.measured?.[dim] ??
    (typeof styleVal === "number" ? styleVal : undefined) ??
    node[dim]
  );
}

interface ComponentData {
  label: string;
  type: string;
  description?: string;
  trustLevel?: string;
  technology?: string;
  interfaces?: InterfaceData[];
  securityContext?: {
    dataClassification?: string;
    dataTypes?: string[];
    accessPattern?: string;
    complianceFrameworks?: string[];
    existingControls?: string[];
    technologyVersion?: string;
  };
  _extraction?: {
    confidence?: number;
    sourceText?: string;
    sourceDocument?: string;
    aiNotes?: string;
  };
}

interface BoundaryData {
  label: string;
  trustLevel?: string;
  description?: string;
}

interface InterfaceData {
  id: string;
  name: string;
  direction: "ingress" | "egress" | "bidirectional";
  position: "left" | "right" | "top" | "bottom";
  port?: number;
  protocol?: string;
  authentication?: string;
  encrypted?: boolean;
  dataClassifications?: string[];
  externallyAccessible?: boolean;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: ConnectionData;
}

interface ConnectionData {
  label?: string;
  protocol?: string;
  authentication?: string;
  encrypted?: boolean;
  dataClassifications?: string[];
  description?: string;
  sourceInterfaceId?: string;
  targetInterfaceId?: string;
}

/** Map frontend types to Prisma enums */
const COMPONENT_TYPE_MAP: Record<string, string> = {
  // Frontend types -> Prisma ComponentType
  ACTOR: "EXTERNAL_USER",
  EXTERNAL_ENTITY: "EXTERNAL_SYSTEM",
  WEB_APP: "SERVICE",
  MOBILE_APP: "SERVICE",
  DESKTOP_APP: "SERVICE",
  API: "API",
  MICROSERVICE: "SERVICE",
  SERVERLESS: "FUNCTION",
  DATABASE: "DATABASE",
  FILE_SYSTEM: "FILE_STORAGE",
  OBJECT_STORAGE: "FILE_STORAGE",
  DATA_LAKE: "FILE_STORAGE",
  CACHE: "CACHE",
  QUEUE: "QUEUE",
  LOAD_BALANCER: "LOAD_BALANCER",
  API_GATEWAY: "API_GATEWAY",
  CDN: "LOAD_BALANCER",
  DNS: "LOAD_BALANCER",
  FIREWALL: "FIREWALL",
  VPN: "FIREWALL",
  IAM: "SERVICE",
  SECRETS_MANAGER: "SERVICE",
  WAF: "FIREWALL",
  ENCRYPTION: "SERVICE",
  AUTH_SERVICE: "SERVICE",
  PROCESS: "PROCESS",
  DATA_STORE: "DATABASE",
  DATA_FLOW: "PROCESS",
  TRUST_BOUNDARY: "PROCESS",
};

const PROTOCOL_MAP: Record<string, string> = {
  HTTP: "HTTP",
  HTTPS: "HTTPS",
  gRPC: "GRPC",
  WebSocket: "WEBSOCKET",
  TCP: "TCP",
  UDP: "UDP",
  AMQP: "AMQP",
  MQTT: "MQTT",
  Kafka: "KAFKA",
  PostgreSQL: "POSTGRESQL",
  MySQL: "MYSQL",
  MongoDB: "MONGODB",
  Redis: "REDIS",
  SSH: "SSH",
  SFTP: "SFTP",
  Custom: "CUSTOM",
};

const AUTH_MAP: Record<string, string> = {
  None: "NONE",
  API_KEY: "API_KEY",
  JWT: "JWT",
  OAuth2: "OAUTH2",
  mTLS: "MTLS",
  Basic: "BASIC",
  SAML: "SAML",
  Custom: "CUSTOM",
};

const TRUST_LEVEL_MAP: Record<string, string> = {
  UNTRUSTED: "UNTRUSTED",
  EXTERNAL: "LOW",
  DMZ: "MEDIUM",
  INTERNAL: "MEDIUM",
  TRUSTED: "HIGH",
  CRITICAL: "HIGH",
};

const DIRECTION_MAP: Record<string, string> = {
  ingress: "INGRESS",
  egress: "EGRESS",
  bidirectional: "BIDIRECTIONAL",
};

const POSITION_MAP: Record<string, string> = {
  left: "LEFT",
  right: "RIGHT",
  top: "TOP",
  bottom: "BOTTOM",
};

/**
 * Safely extract a number, returning default if invalid
 */
function safeNumber(value: unknown, defaultValue: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

/** In-memory cache of last sync times to prevent redundant syncs */
const lastSyncCache = new Map<string, Date>();

/**
 * In-flight sync promises keyed by threatModelId. Concurrent callers for the
 * same model share the same promise, preventing two transactions from racing
 * to recreate connections and hitting the (threatModelId, edgeId) unique
 * constraint.
 *
 * `ensureCanvasSynced` coalesces full syncs (including the state read); the
 * write-only `syncCanvasToDatabase` serialises its work through
 * `syncWriteChain` so callers that pass an explicit canvas state (save-canvas,
 * version restore) queue rather than race.
 */
const inFlightSyncs = new Map<string, Promise<boolean>>();
const syncWriteChain = new Map<string, Promise<unknown>>();

/**
 * Check if a sync is needed by comparing timestamps.
 * Returns true if the threat model was updated since last sync.
 */
async function needsSync(threatModelId: string): Promise<boolean> {
  const prisma = await getPrisma();

  const threatModel = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    select: { updatedAt: true },
  });

  if (!threatModel) return false;

  const lastSync = lastSyncCache.get(threatModelId);
  if (!lastSync) return true;

  return threatModel.updatedAt > lastSync;
}

/**
 * Ensure canvas data is synced to normalized tables.
 * This is called on-demand when API endpoints need the data.
 * It checks if sync is needed and only performs it if the model was updated.
 *
 * @param threatModelId - The threat model to sync
 * @param force - Force sync even if cache says it's up to date
 * @returns true if sync was performed, false if skipped
 */
export async function ensureCanvasSynced(
  threatModelId: string,
  force = false,
): Promise<boolean> {
  // Coalesce concurrent callers onto a single in-flight sync.
  const pending = inFlightSyncs.get(threatModelId);
  if (pending) return pending;

  const run = (async (): Promise<boolean> => {
    // Check if sync is needed (skip if recently synced and no updates)
    if (!force && !(await needsSync(threatModelId))) {
      return false;
    }

    const prisma = await getPrisma();

    // Get the threat model with canvas state
    const threatModel = await prisma.threatModel.findUnique({
      where: { id: threatModelId },
      select: { canvasState: true, updatedAt: true },
    });

    if (!threatModel) return false;

    // Parse canvas state
    let canvasState: CanvasState;
    try {
      canvasState = JSON.parse(threatModel.canvasState);
    } catch {
      logger.error("Failed to parse canvas state for sync");
      return false;
    }

    // Perform the sync
    await syncCanvasToDatabase(threatModelId, canvasState);

    // Update cache
    lastSyncCache.set(threatModelId, threatModel.updatedAt);

    return true;
  })();

  inFlightSyncs.set(threatModelId, run);
  try {
    return await run;
  } finally {
    inFlightSyncs.delete(threatModelId);
  }
}

/**
 * Sync canvas state to normalized database tables.
 * This extracts components, interfaces, connections, and boundaries
 * from the JSON canvas state and writes them to their respective tables.
 *
 * Runs on EVERY auto-save (see the module docblock). It diffs against the
 * existing rows, so an unchanged canvas costs reads only and writes nothing.
 * (No in-process "unchanged" cache: with more than one server instance a
 * process-local cache could skip a save another instance had overwritten.)
 */
export async function syncCanvasToDatabase(
  threatModelId: string,
  canvasState: CanvasState,
): Promise<void> {
  // Chain concurrent writers so the delete-then-recreate transactions don't
  // race on the (threatModelId, edgeId) unique index.
  const prev = syncWriteChain.get(threatModelId) ?? Promise.resolve();
  const next = prev
    .catch(() => {}) // previous failure must not block later writers
    .then(() => doSyncCanvasToDatabase(threatModelId, canvasState));
  syncWriteChain.set(threatModelId, next);
  try {
    return await next;
  } finally {
    if (syncWriteChain.get(threatModelId) === next) {
      syncWriteChain.delete(threatModelId);
    }
  }
}

type SyncTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Compare as stored: undefined ≡ null, Dates by instant. */
function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v instanceof Date ? v.getTime() : (v ?? null));
  return norm(a) === norm(b);
}

/** The fields of `desired` that differ from `existing`, or null if none. */
function changedFields<T extends Record<string, unknown>>(
  existing: Record<string, unknown>,
  desired: T,
): Partial<T> | null {
  const diff: Partial<T> = {};
  let changed = false;
  for (const key of Object.keys(desired) as (keyof T & string)[]) {
    if (!sameValue(existing[key], desired[key])) {
      diff[key] = desired[key];
      changed = true;
    }
  }
  return changed ? diff : null;
}

/** First occurrence wins — the tables have unique (model, nodeId/edgeId). */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

interface ConnSummary {
  protocol: string | null;
  encrypted: boolean;
  authentication: string | null;
  peerType: string;
  peerId: string;
}

async function doSyncCanvasToDatabase(
  threatModelId: string,
  canvasState: CanvasState,
): Promise<void> {
  const prisma = await getPrisma();

  // Pure canvas-derived data, computed before touching the database.
  const boundaryNodes = dedupeById(
    canvasState.nodes.filter((n) => n.type === "boundary"),
  );
  const componentNodes = dedupeById(
    canvasState.nodes.filter((n) => n.type === "component"),
  );
  const componentNodeIds = new Set(componentNodes.map((n) => n.id));
  const nodeParentMap = new Map<string, string | undefined>(
    componentNodes.map((n) => [n.id, n.parentId]),
  );
  const nodeTypeMap = new Map<string, string>(
    componentNodes.map((n) => [
      n.id,
      COMPONENT_TYPE_MAP[(n.data as ComponentData).type] || "PROCESS",
    ]),
  );
  // Dedupe by edge.id — the canvas state can accumulate duplicate edges
  // (e.g. a reconnect that re-creates the same id), and the DB has a
  // unique index on (threatModelId, edgeId). Edges touching a non-component
  // node are not stored.
  const connectionEdges = dedupeById(canvasState.edges).filter(
    (e) => componentNodeIds.has(e.source) && componentNodeIds.has(e.target),
  );

  // Connection topology summaries for the analysis hash (over all edges, as
  // the hash has always been computed).
  const inboundConns = new Map<string, ConnSummary[]>();
  const outboundConns = new Map<string, ConnSummary[]>();
  for (const edge of canvasState.edges) {
    if (
      !componentNodeIds.has(edge.source) ||
      !componentNodeIds.has(edge.target)
    )
      continue;
    const ed = edge.data || {};
    const proto = ed.protocol ? (PROTOCOL_MAP[ed.protocol] ?? null) : null;
    const auth = ed.authentication
      ? (AUTH_MAP[ed.authentication] ?? null)
      : null;
    const enc: boolean = ed.encrypted ?? true;
    const out = outboundConns.get(edge.source) ?? [];
    out.push({
      protocol: proto,
      encrypted: enc,
      authentication: auth,
      peerType: nodeTypeMap.get(edge.target) ?? "PROCESS",
      peerId: edge.target,
    });
    outboundConns.set(edge.source, out);
    const inb = inboundConns.get(edge.target) ?? [];
    inb.push({
      protocol: proto,
      encrypted: enc,
      authentication: auth,
      peerType: nodeTypeMap.get(edge.source) ?? "PROCESS",
      peerId: edge.source,
    });
    inboundConns.set(edge.target, inb);
  }

  // Diff the canvas against the current rows and write only the difference.
  // Kept nodes keep their row ids, so rows that reference a Component by id
  // (DFD entities' linkedComponentId, onDelete: SetNull) and columns the sync
  // never writes (engineerNotes) survive a save.
  await prisma.$transaction(async (tx: SyncTx) => {
    const existingComponents = await tx.component.findMany({
      where: { threatModelId },
      select: {
        id: true,
        nodeId: true,
        type: true,
        name: true,
        description: true,
        trustLevel: true,
        positionX: true,
        positionY: true,
        boundaryId: true,
        technology: true,
        dataClassification: true,
        dataHandled: true,
        accessPattern: true,
        aiNotes: true,
        confidence: true,
        sourceText: true,
        sourceDocument: true,
        properties: true,
        analysisHash: true,
        analyzedAt: true,
      },
    });
    const existingBoundaries = await tx.boundary.findMany({
      where: { threatModelId },
      select: {
        id: true,
        nodeId: true,
        name: true,
        trustLevel: true,
        description: true,
        positionX: true,
        positionY: true,
        width: true,
        height: true,
      },
    });
    const existingInterfaces = await tx.componentInterface.findMany({
      where: { component: { threatModelId } },
      select: {
        id: true,
        interfaceId: true,
        componentId: true,
        name: true,
        direction: true,
        position: true,
        port: true,
        protocol: true,
        authentication: true,
        encrypted: true,
        dataClassifications: true,
        externallyAccessible: true,
      },
    });
    const existingConnections = await tx.connection.findMany({
      where: { threatModelId },
      select: {
        id: true,
        edgeId: true,
        sourceComponentId: true,
        targetComponentId: true,
        sourceInterfaceId: true,
        targetInterfaceId: true,
        label: true,
        protocol: true,
        authentication: true,
        encrypted: true,
        dataClassifications: true,
        description: true,
        crossesBoundary: true,
      },
    });

    const componentByNodeId = new Map(
      existingComponents.map((c) => [c.nodeId, c]),
    );
    const boundaryByNodeId = new Map(
      existingBoundaries.map((b) => [b.nodeId, b]),
    );
    const ifaceKey = (componentId: string, interfaceId: string) =>
      `${componentId}\u0000${interfaceId}`;
    const interfaceByKey = new Map(
      existingInterfaces.map((i) => [
        ifaceKey(i.componentId, i.interfaceId),
        i,
      ]),
    );
    const connectionByEdgeId = new Map(
      existingConnections.map((c) => [c.edgeId, c]),
    );

    // 1. Delete rows whose canvas element is gone. Deleting a component
    //    cascades its interfaces and connections; a DFD entity linked to it
    //    is correctly unlinked (SetNull).
    const keptInterfaceKeys = new Set<string>();
    for (const node of componentNodes) {
      const existing = componentByNodeId.get(node.id);
      if (!existing) continue;
      for (const iface of (node.data as ComponentData).interfaces || []) {
        keptInterfaceKeys.add(ifaceKey(existing.id, iface.id));
      }
    }
    const connectionEdgeIds = new Set(connectionEdges.map((e) => e.id));
    const boundaryNodeIds = new Set(boundaryNodes.map((n) => n.id));

    const staleConnectionIds = existingConnections
      .filter((c) => !connectionEdgeIds.has(c.edgeId))
      .map((c) => c.id);
    const staleInterfaceIds = existingInterfaces
      .filter(
        (i) => !keptInterfaceKeys.has(ifaceKey(i.componentId, i.interfaceId)),
      )
      .map((i) => i.id);
    const staleComponentIds = existingComponents
      .filter((c) => !componentNodeIds.has(c.nodeId))
      .map((c) => c.id);
    const staleBoundaryIds = existingBoundaries
      .filter((b) => !boundaryNodeIds.has(b.nodeId))
      .map((b) => b.id);

    if (staleConnectionIds.length > 0) {
      await tx.connection.deleteMany({
        where: { id: { in: staleConnectionIds } },
      });
    }
    if (staleInterfaceIds.length > 0) {
      await tx.componentInterface.deleteMany({
        where: { id: { in: staleInterfaceIds } },
      });
    }
    if (staleComponentIds.length > 0) {
      await tx.component.deleteMany({
        where: { id: { in: staleComponentIds } },
      });
    }
    if (staleBoundaryIds.length > 0) {
      await tx.boundary.deleteMany({ where: { id: { in: staleBoundaryIds } } });
    }

    // Sweep orphan AI threats whose componentNodeId is no longer
    // present in the incoming canvas. Keeps human-reviewed (ACCEPTED /
    // MODIFIED / REJECTED) and manually-edited rows. `componentNodeId` is
    // plain text with no FK cascade, so threats would otherwise linger
    // after a redraw and inflate counts on the next AI run.
    //
    // A compound threat (spans 2+ components) stores the
    // COMPOUND_COMPONENT_SENTINEL rather than a real node id, so it can
    // never appear in incomingNodeIds and was always swept as "orphaned"
    // on the very next auto-save. Exempt it, mirroring the topology check
    // in stages/verifier-checks.ts.
    const incomingNodeIds = new Set(
      canvasState.nodes.filter((n) => n.id).map((n) => n.id),
    );
    if (incomingNodeIds.size > 0) {
      const allModelThreats = await tx.threat.findMany({
        where: {
          threatModelId,
          source: "AI_SUGGESTED",
          reviewStatus: "PENDING",
          manuallyEdited: false,
          componentNodeId: { not: null },
        },
        select: { id: true, componentNodeId: true },
      });
      const orphanIds = allModelThreats
        .filter(
          (t) =>
            t.componentNodeId &&
            t.componentNodeId !== COMPOUND_COMPONENT_SENTINEL &&
            t.componentNodeId !== SUPPLY_CHAIN_COMPONENT_SENTINEL &&
            !incomingNodeIds.has(t.componentNodeId),
        )
        .map((t) => t.id);
      if (orphanIds.length > 0) {
        await tx.threat.deleteMany({ where: { id: { in: orphanIds } } });
      }
    }

    // 2. Boundaries first (components reference them).
    const boundaryIdMap = new Map<string, string>(); // nodeId -> DB id
    const newBoundaries = [];
    for (const node of boundaryNodes) {
      const data = node.data as BoundaryData;
      const desired = {
        name: data.label || "Boundary",
        trustLevel: (TRUST_LEVEL_MAP[data.trustLevel || "MEDIUM"] ??
          "MEDIUM") as TrustLevel,
        description: data.description ?? null,
        positionX: safeNumber(node.position?.x, 0),
        positionY: safeNumber(node.position?.y, 0),
        // Boundaries store their size in style/measured, not width/height —
        // reading only `node.width` persisted the 300×200 default for
        // every resized zone.
        width: safeNumber(nodeSize(node, "width"), 400),
        height: safeNumber(nodeSize(node, "height"), 300),
      };
      const existing = boundaryByNodeId.get(node.id);
      if (existing) {
        boundaryIdMap.set(node.id, existing.id);
        const diff = changedFields(existing, desired);
        if (diff) {
          await tx.boundary.update({ where: { id: existing.id }, data: diff });
        }
      } else {
        newBoundaries.push({ ...desired, nodeId: node.id, threatModelId });
      }
    }
    if (newBoundaries.length > 0) {
      const created = await tx.boundary.createManyAndReturn({
        data: newBoundaries,
        select: { id: true, nodeId: true },
      });
      for (const b of created) boundaryIdMap.set(b.nodeId, b.id);
    }

    // 3. Components, with their analysisHash in the same write. analyzedAt
    //    is preserved only when the hash is unchanged (still clean).
    const componentIdMap = new Map<string, string>(); // nodeId -> DB id
    const newComponents = [];
    for (const node of componentNodes) {
      const data = node.data as ComponentData;
      const type = (COMPONENT_TYPE_MAP[data.type] ||
        "PROCESS") as ComponentType;
      const trustLevel = (TRUST_LEVEL_MAP[data.trustLevel || "INTERNAL"] ||
        "MEDIUM") as TrustLevel;
      const boundaryId = node.parentId
        ? (boundaryIdMap.get(node.parentId) ?? null)
        : null;
      const dataHandled = JSON.stringify(data.securityContext?.dataTypes || []);

      const analysisHash = computeAnalysisHash({
        type,
        name: data.label || "Component",
        description: data.description,
        dataClassification: data.securityContext?.dataClassification,
        technology: data.technology,
        trustLevel,
        dataHandled,
        accessPattern: data.securityContext?.accessPattern,
        boundaryId,
        existingControls: data.securityContext?.existingControls,
        inbound: inboundConns.get(node.id) ?? [],
        outbound: outboundConns.get(node.id) ?? [],
      });
      const existing = componentByNodeId.get(node.id);

      const desired = {
        type,
        name: data.label || "Component",
        description: data.description ?? null,
        trustLevel,
        positionX: safeNumber(node.position?.x, 0),
        positionY: safeNumber(node.position?.y, 0),
        boundaryId,
        // Rich metadata from extraction / user input
        technology: data.technology || null,
        dataClassification: data.securityContext?.dataClassification || null,
        dataHandled,
        accessPattern: data.securityContext?.accessPattern || null,
        aiNotes: data._extraction?.aiNotes || null,
        confidence: data._extraction?.confidence ?? null,
        sourceText: data._extraction?.sourceText || null,
        sourceDocument: data._extraction?.sourceDocument || null,
        properties: JSON.stringify({ originalType: data.type }),
        analysisHash,
        analyzedAt:
          existing?.analysisHash === analysisHash
            ? (existing.analyzedAt ?? null)
            : null,
      };

      if (existing) {
        componentIdMap.set(node.id, existing.id);
        const diff = changedFields(existing, desired);
        if (diff) {
          await tx.component.update({
            where: { id: existing.id },
            data: diff,
          });
        }
      } else {
        newComponents.push({ ...desired, nodeId: node.id, threatModelId });
      }
    }
    if (newComponents.length > 0) {
      const created = await tx.component.createManyAndReturn({
        data: newComponents,
        select: { id: true, nodeId: true },
      });
      for (const c of created) componentIdMap.set(c.nodeId, c.id);
    }

    // 4. Interfaces. interfaceIdMap is keyed by the frontend interface id
    //    (last one wins on a cross-component collision, as before).
    const interfaceOrder: Array<{ frontendId: string; key: string }> = [];
    const interfaceIdByKey = new Map<string, string | null>();
    const newInterfaces = [];
    for (const node of componentNodes) {
      const componentId = componentIdMap.get(node.id);
      if (!componentId) continue;
      for (const iface of (node.data as ComponentData).interfaces || []) {
        const key = ifaceKey(componentId, iface.id);
        interfaceOrder.push({ frontendId: iface.id, key });
        if (interfaceIdByKey.has(key)) continue; // duplicate id on one node
        const desired = {
          name: iface.name,
          direction: (DIRECTION_MAP[iface.direction] ||
            "BIDIRECTIONAL") as InterfaceDirection,
          position: (POSITION_MAP[iface.position] ||
            "LEFT") as InterfacePosition,
          port: iface.port ?? null,
          protocol: (PROTOCOL_MAP[iface.protocol || "HTTPS"] ||
            "HTTPS") as Protocol,
          authentication: (AUTH_MAP[iface.authentication || "None"] ||
            "NONE") as AuthMethod,
          encrypted: iface.encrypted ?? true,
          dataClassifications: JSON.stringify(iface.dataClassifications || []),
          externallyAccessible: iface.externallyAccessible ?? false,
        };
        const existing = interfaceByKey.get(key);
        if (existing) {
          interfaceIdByKey.set(key, existing.id);
          const diff = changedFields(existing, desired);
          if (diff) {
            await tx.componentInterface.update({
              where: { id: existing.id },
              data: diff,
            });
          }
        } else {
          interfaceIdByKey.set(key, null); // id known once created below
          newInterfaces.push({
            ...desired,
            interfaceId: iface.id,
            componentId,
          });
        }
      }
    }
    if (newInterfaces.length > 0) {
      const created = await tx.componentInterface.createManyAndReturn({
        data: newInterfaces,
        select: { id: true, interfaceId: true, componentId: true },
      });
      for (const i of created) {
        interfaceIdByKey.set(ifaceKey(i.componentId, i.interfaceId), i.id);
      }
    }
    const interfaceIdMap = new Map<string, string>(); // frontendId -> DB id
    for (const { frontendId, key } of interfaceOrder) {
      const id = interfaceIdByKey.get(key);
      if (id) interfaceIdMap.set(frontendId, id);
    }

    // 5. Connections. No table references a Connection row, so new ones are
    //    batch-inserted without reading ids back.
    const newConnections = [];
    for (const edge of connectionEdges) {
      const data = edge.data || {};
      const desired = {
        sourceComponentId: componentIdMap.get(edge.source) as string,
        targetComponentId: componentIdMap.get(edge.target) as string,
        sourceInterfaceId: data.sourceInterfaceId
          ? (interfaceIdMap.get(data.sourceInterfaceId) ?? null)
          : null,
        targetInterfaceId: data.targetInterfaceId
          ? (interfaceIdMap.get(data.targetInterfaceId) ?? null)
          : null,
        label: data.label ?? null,
        protocol: data.protocol
          ? ((PROTOCOL_MAP[data.protocol] || "HTTPS") as Protocol)
          : null,
        authentication: data.authentication
          ? ((AUTH_MAP[data.authentication] || "NONE") as AuthMethod)
          : null,
        encrypted: data.encrypted ?? true,
        dataClassifications: JSON.stringify(data.dataClassifications || []),
        description: data.description ?? null,
        // Crosses a trust boundary when source and target have different
        // parents.
        crossesBoundary:
          nodeParentMap.get(edge.source) !== nodeParentMap.get(edge.target),
      };
      const existing = connectionByEdgeId.get(edge.id);
      if (existing) {
        const diff = changedFields(existing, desired);
        if (diff) {
          await tx.connection.update({
            where: { id: existing.id },
            data: diff,
          });
        }
      } else {
        newConnections.push({ ...desired, edgeId: edge.id, threatModelId });
      }
    }
    if (newConnections.length > 0) {
      await tx.connection.createMany({ data: newConnections });
    }
  });

  // Update caches after successful sync
  lastSyncCache.set(threatModelId, new Date());
}

/**
 * Clear all sync cache entries.
 * Useful for testing or when restarting the server.
 */
export function clearSyncCache(): void {
  lastSyncCache.clear();
}
