/**
 * Model Diff Service
 *
 * Compares two versions of a threat model and generates a structured diff.
 * Used for version comparison, change tracking, and review workflows.
 */

export interface ModelSnapshot {
  components: Array<{ id: string; name: string; type: string }>;
  connections: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
  threats: Array<{
    id: string;
    name: string;
    severity: string;
    status: string;
    componentId?: string;
  }>;
  mitigations: Array<{
    id: string;
    description: string;
    status: string;
    threatId: string;
  }>;
}

export interface ModelDiff {
  components: {
    added: Array<{ id: string; name: string; type: string }>;
    removed: Array<{ id: string; name: string; type: string }>;
    modified: Array<{ id: string; name: string; changes: string[] }>;
  };
  connections: {
    added: Array<{ id: string; source: string; target: string }>;
    removed: Array<{ id: string; source: string; target: string }>;
  };
  threats: {
    added: Array<{ id: string; name: string; severity: string }>;
    removed: Array<{ id: string; name: string; severity: string }>;
    severityChanged: Array<{
      id: string;
      name: string;
      from: string;
      to: string;
    }>;
    statusChanged: Array<{
      id: string;
      name: string;
      from: string;
      to: string;
    }>;
  };
  mitigations: {
    added: Array<{ id: string; description: string }>;
    removed: Array<{ id: string; description: string }>;
    statusChanged: Array<{
      id: string;
      description: string;
      from: string;
      to: string;
    }>;
  };
  summary: {
    totalChanges: number;
    componentsChanged: number;
    threatsChanged: number;
    mitigationsChanged: number;
    riskImpact: "increased" | "decreased" | "neutral";
  };
}

/**
 * Compare two model snapshots and generate a structured diff.
 */
export function diffModels(
  before: ModelSnapshot,
  after: ModelSnapshot,
): ModelDiff {
  const diff: ModelDiff = {
    components: diffComponents(before.components, after.components),
    connections: diffConnections(before.connections, after.connections),
    threats: diffThreats(before.threats, after.threats),
    mitigations: diffMitigations(before.mitigations, after.mitigations),
    summary: {
      totalChanges: 0,
      componentsChanged: 0,
      threatsChanged: 0,
      mitigationsChanged: 0,
      riskImpact: "neutral",
    },
  };

  // Calculate summary
  diff.summary.componentsChanged =
    diff.components.added.length +
    diff.components.removed.length +
    diff.components.modified.length;
  diff.summary.threatsChanged =
    diff.threats.added.length +
    diff.threats.removed.length +
    diff.threats.severityChanged.length +
    diff.threats.statusChanged.length;
  diff.summary.mitigationsChanged =
    diff.mitigations.added.length +
    diff.mitigations.removed.length +
    diff.mitigations.statusChanged.length;
  diff.summary.totalChanges =
    diff.summary.componentsChanged +
    diff.connections.added.length +
    diff.connections.removed.length +
    diff.summary.threatsChanged +
    diff.summary.mitigationsChanged;

  // Risk impact
  const threatsDelta = diff.threats.added.length - diff.threats.removed.length;
  const mitigationsDelta =
    diff.mitigations.added.length - diff.mitigations.removed.length;
  const sevUpgrades = diff.threats.severityChanged.filter(
    (c) => severityRank(c.to) > severityRank(c.from),
  ).length;
  const sevDowngrades = diff.threats.severityChanged.filter(
    (c) => severityRank(c.to) < severityRank(c.from),
  ).length;

  if (threatsDelta > 0 || sevUpgrades > sevDowngrades) {
    diff.summary.riskImpact = "increased";
  } else if (mitigationsDelta > 0 || sevDowngrades > sevUpgrades) {
    diff.summary.riskImpact = "decreased";
  }

  return diff;
}

function severityRank(s: string): number {
  const ranks: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    INFO: 0,
  };
  return ranks[s] ?? 0;
}

function diffComponents(
  before: ModelSnapshot["components"],
  after: ModelSnapshot["components"],
) {
  const beforeMap = new Map(before.map((c) => [c.id, c]));
  const afterMap = new Map(after.map((c) => [c.id, c]));

  const added = after.filter((c) => !beforeMap.has(c.id));
  const removed = before.filter((c) => !afterMap.has(c.id));
  const modified: Array<{ id: string; name: string; changes: string[] }> = [];

  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) continue;
    const changes: string[] = [];
    if (b.name !== a.name) changes.push(`name: "${b.name}" → "${a.name}"`);
    if (b.type !== a.type) changes.push(`type: ${b.type} → ${a.type}`);
    if (changes.length > 0) modified.push({ id, name: a.name, changes });
  }

  return { added, removed, modified };
}

function diffConnections(
  before: ModelSnapshot["connections"],
  after: ModelSnapshot["connections"],
) {
  const beforeIds = new Set(before.map((c) => c.id));
  const afterIds = new Set(after.map((c) => c.id));

  return {
    added: after.filter((c) => !beforeIds.has(c.id)),
    removed: before.filter((c) => !afterIds.has(c.id)),
  };
}

function diffThreats(
  before: ModelSnapshot["threats"],
  after: ModelSnapshot["threats"],
) {
  const beforeMap = new Map(before.map((t) => [t.id, t]));
  const afterMap = new Map(after.map((t) => [t.id, t]));

  const added = after.filter((t) => !beforeMap.has(t.id));
  const removed = before.filter((t) => !afterMap.has(t.id));
  const severityChanged: Array<{
    id: string;
    name: string;
    from: string;
    to: string;
  }> = [];
  const statusChanged: Array<{
    id: string;
    name: string;
    from: string;
    to: string;
  }> = [];

  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) continue;
    if (b.severity !== a.severity) {
      severityChanged.push({
        id,
        name: a.name,
        from: b.severity,
        to: a.severity,
      });
    }
    if (b.status !== a.status) {
      statusChanged.push({ id, name: a.name, from: b.status, to: a.status });
    }
  }

  return { added, removed, severityChanged, statusChanged };
}

function diffMitigations(
  before: ModelSnapshot["mitigations"],
  after: ModelSnapshot["mitigations"],
) {
  const beforeMap = new Map(before.map((m) => [m.id, m]));
  const afterMap = new Map(after.map((m) => [m.id, m]));

  const added = after.filter((m) => !beforeMap.has(m.id));
  const removed = before.filter((m) => !afterMap.has(m.id));
  const statusChanged: Array<{
    id: string;
    description: string;
    from: string;
    to: string;
  }> = [];

  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) continue;
    if (b.status !== a.status) {
      statusChanged.push({
        id,
        description: a.description,
        from: b.status,
        to: a.status,
      });
    }
  }

  return { added, removed, statusChanged };
}
