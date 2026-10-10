/**
 * Attack Chain Analyzer
 *
 * Identifies multi-step attack paths through the system.
 * Unlike per-component threats, this analyzes HOW threats compound:
 * "If component A is compromised, attacker can reach B via C"
 *
 * Works with or without LLM:
 * - Rule-based: Graph traversal from external entry points
 * - LLM-enhanced: AI reasons about realistic attack scenarios
 */

export interface AttackChain {
  id: string;
  name: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  steps: AttackStep[];
  entryPoint: string;
  target: string;
  blastRadius: string[];
  mitigationGaps: string[];
}

interface AttackStep {
  order: number;
  componentId: string;
  componentName: string;
  action: string;
  technique: string;
  prerequisite?: string;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  trustLevel?: string;
  isExternal: boolean;
  hasAuth: boolean;
  isEncrypted: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  protocol?: string;
  encrypted?: boolean;
  authMethod?: string;
}

/**
 * Analyze attack chains through the model's component graph.
 * Finds paths from external entry points to high-value targets.
 */
export function analyzeAttackChains(
  components: Array<{
    id: string;
    name: string;
    type: string;
    trustLevel?: string;
  }>,
  connections: Array<{
    source: string;
    target: string;
    protocol?: string;
    encrypted?: boolean;
    authMethod?: string;
  }>,
): AttackChain[] {
  const chains: AttackChain[] = [];

  // Build adjacency graph
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const comp of components) {
    nodes.set(comp.id, {
      id: comp.id,
      name: comp.name,
      type: comp.type,
      trustLevel: comp.trustLevel,
      isExternal:
        comp.type === "EXTERNAL_USER" || comp.trustLevel === "EXTERNAL",
      hasAuth: false,
      isEncrypted: false,
    });
  }

  for (const conn of connections) {
    edges.push(conn);
    // Mark target as having auth if connection has auth
    const target = nodes.get(conn.target);
    if (target && conn.authMethod && conn.authMethod !== "NONE") {
      target.hasAuth = true;
    }
    if (target && conn.encrypted) {
      target.isEncrypted = true;
    }
  }

  // Find entry points (external-facing components)
  const entryPoints = [...nodes.values()].filter(
    (n) => n.isExternal || isExternallyAccessible(n, edges),
  );

  // Find high-value targets (databases, auth services, secret stores)
  const highValueTargets = [...nodes.values()].filter((n) =>
    HIGH_VALUE_TYPES.includes(n.type),
  );

  // For each entry point → high-value target pair, find attack paths
  for (const entry of entryPoints) {
    for (const target of highValueTargets) {
      if (entry.id === target.id) continue;

      const paths = findPaths(entry.id, target.id, edges, new Set(), 5);

      for (const path of paths) {
        const chain = buildAttackChain(path, nodes, edges);
        if (chain) chains.push(chain);
      }
    }
  }

  // Deduplicate and sort by severity
  const unique = deduplicateChains(chains);
  return unique.sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
}

// =============================================================================
// Graph Traversal
// =============================================================================

const HIGH_VALUE_TYPES = [
  "DATABASE",
  "AUTH_SERVICE",
  "SECRETS_MANAGER",
  "KEY_MANAGEMENT",
  "OBJECT_STORAGE",
  "FILE_SYSTEM",
];

function isExternallyAccessible(node: GraphNode, _edges: GraphEdge[]): boolean {
  // A node is externally accessible if it receives connections from external nodes
  // or is a web app, API gateway, or load balancer
  return ["WEB_APP", "API_GATEWAY", "LOAD_BALANCER", "CDN", "API"].includes(
    node.type,
  );
}

function findPaths(
  from: string,
  to: string,
  edges: GraphEdge[],
  visited: Set<string>,
  maxDepth: number,
): string[][] {
  if (maxDepth <= 0) return [];
  if (from === to) return [[to]];
  if (visited.has(from)) return [];

  visited.add(from);
  const paths: string[][] = [];

  const neighbors = edges.filter((e) => e.source === from).map((e) => e.target);

  for (const next of neighbors) {
    const subPaths = findPaths(next, to, edges, new Set(visited), maxDepth - 1);
    for (const subPath of subPaths) {
      paths.push([from, ...subPath]);
    }
  }

  return paths;
}

function buildAttackChain(
  path: string[],
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
): AttackChain | null {
  if (path.length < 2) return null;

  const steps: AttackStep[] = [];
  const mitigationGaps: string[] = [];

  for (let i = 0; i < path.length; i++) {
    const node = nodes.get(path[i]!);
    if (!node) continue;

    const edge =
      i > 0
        ? edges.find((e) => e.source === path[i - 1] && e.target === path[i])
        : null;

    const action = getAttackAction(node, edge ?? null, i === 0);
    const technique = getAttackTechnique(node, edge ?? null);

    steps.push({
      order: i + 1,
      componentId: node.id,
      componentName: node.name,
      action,
      technique,
      prerequisite:
        i > 0 ? `Compromise of ${nodes.get(path[i - 1]!)?.name}` : undefined,
    });

    // Check for mitigation gaps
    if (edge && !edge.encrypted) {
      mitigationGaps.push(
        `${nodes.get(path[i - 1]!)?.name} → ${node.name}: unencrypted`,
      );
    }
    if (edge && (!edge.authMethod || edge.authMethod === "NONE")) {
      mitigationGaps.push(
        `${nodes.get(path[i - 1]!)?.name} → ${node.name}: no authentication`,
      );
    }
  }

  const entryNode = nodes.get(path[0]!)!;
  const targetNode = nodes.get(path[path.length - 1]!)!;

  // Calculate severity based on target value + path weaknesses
  const severity = calculateChainSeverity(
    targetNode,
    mitigationGaps.length,
    path.length,
  );

  // Blast radius: what else can the attacker reach from the target?
  const blastRadius = edges
    .filter((e) => e.source === targetNode.id)
    .map((e) => nodes.get(e.target)?.name || e.target);

  return {
    id: `chain-${path.join("-")}`,
    name: `${entryNode.name} → ${targetNode.name} (${path.length} steps)`,
    description: `Attack path from ${entryNode.name} through ${path.length - 2} intermediate components to ${targetNode.name}`,
    severity,
    steps,
    entryPoint: entryNode.id,
    target: targetNode.id,
    blastRadius,
    mitigationGaps,
  };
}

function getAttackAction(
  node: GraphNode,
  edge: GraphEdge | null,
  isEntry: boolean,
): string {
  if (isEntry) return `Initiate attack from ${node.name}`;
  if (!edge?.authMethod || edge.authMethod === "NONE")
    return `Access ${node.name} without authentication`;
  if (!edge?.encrypted) return `Intercept traffic to ${node.name}`;
  return `Exploit ${node.name} via ${node.type.toLowerCase()} vulnerability`;
}

function getAttackTechnique(node: GraphNode, _edge: GraphEdge | null): string {
  const techniques: Record<string, string> = {
    WEB_APP: "XSS / CSRF / session hijacking",
    API: "API abuse / injection / IDOR",
    API_GATEWAY: "Gateway bypass / token manipulation",
    DATABASE: "SQL injection / credential theft",
    AUTH_SERVICE: "Credential stuffing / session fixation",
    OBJECT_STORAGE: "Bucket enumeration / misconfiguration",
    SERVERLESS: "Event injection / privilege escalation",
    CACHE: "Cache poisoning / session theft",
    QUEUE: "Message injection / replay attack",
    CONTAINER: "Container escape / image exploitation",
    KUBERNETES: "RBAC abuse / pod-to-pod lateral movement",
  };
  return techniques[node.type] || "Exploitation of component vulnerability";
}

function calculateChainSeverity(
  target: GraphNode,
  gapCount: number,
  pathLength: number,
): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const isHighValue = HIGH_VALUE_TYPES.includes(target.type);
  const hasGaps = gapCount > 0;
  const isShortPath = pathLength <= 3;

  if (isHighValue && hasGaps && isShortPath) return "CRITICAL";
  if (isHighValue && (hasGaps || isShortPath)) return "HIGH";
  if (hasGaps) return "MEDIUM";
  return "LOW";
}

function severityRank(s: string): number {
  const ranks: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  return ranks[s] ?? 0;
}

function deduplicateChains(chains: AttackChain[]): AttackChain[] {
  const seen = new Set<string>();
  return chains.filter((c) => {
    const key = `${c.entryPoint}-${c.target}-${c.steps.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
