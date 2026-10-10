/**
 * ThreatForge MCP Tool Implementations
 *
 * Each function maps to an MCP tool exposed to AI assistants.
 */
import type { ThreatForgeClient } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Threat {
  id: string;
  name: string;
  description?: string;
  severity: string;
  status: string;
  strideCategories?: string[];
  componentId?: string;
  mitigations?: Mitigation[];
}

interface Mitigation {
  id: string;
  description: string;
  status: string;
  priority?: string;
  evidenceLinks?: Array<{ url: string; title?: string }>;
}

interface ComplianceGap {
  controlId: string;
  controlName: string;
  status: "COVERED" | "PARTIAL" | "NOT_ADDRESSED";
  linkedThreats?: string[];
  linkedMitigations?: string[];
}

// ── Tool implementations ───────────────────────────────────────────────────────

/**
 * List all threat models the authenticated user has access to.
 */
export async function listModels(
  client: ThreatForgeClient,
  args: { projectId?: string; limit?: number },
): Promise<string> {
  const params = new URLSearchParams();
  if (args.projectId) params.set("projectId", args.projectId);
  if (args.limit) params.set("limit", String(args.limit ?? 20));

  const models = await client.get<ThreatModel[]>(
    `/api/threat-models?${params}`,
  );

  if (!models.length) return "No threat models found.";

  const lines = models.map(
    (m) =>
      `- **${m.name}** (id: ${m.id})` +
      (m.description ? ` — ${m.description}` : ""),
  );
  return `Found ${models.length} threat model(s):\n\n${lines.join("\n")}`;
}

/**
 * Get a summary of a specific threat model: risk score, threat count, compliance posture.
 */
export async function getModelSummary(
  client: ThreatForgeClient,
  args: { modelId: string },
): Promise<string> {
  const model = await client.get<
    ThreatModel & {
      threats?: Threat[];
      riskScore?: number;
    }
  >(`/api/threat-models/${args.modelId}`);

  const threats = model.threats ?? [];
  const open = threats.filter((t) => t.status === "OPEN").length;
  const critical = threats.filter(
    (t) => t.severity === "CRITICAL" && t.status === "OPEN",
  ).length;
  const mitigated = threats.filter((t) => t.status === "MITIGATED").length;
  const mitigationRate =
    threats.length > 0 ? Math.round((mitigated / threats.length) * 100) : 0;

  return [
    `## ${model.name}`,
    `**ID:** ${model.id}`,
    model.description ? `**Description:** ${model.description}` : "",
    "",
    `**Threats:** ${threats.length} total, ${open} open, ${critical} critical open`,
    `**Mitigation rate:** ${mitigationRate}%`,
    `**Last updated:** ${new Date(model.updatedAt).toLocaleDateString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Get threats for a model, optionally filtered by severity or status.
 */
export async function getThreats(
  client: ThreatForgeClient,
  args: {
    modelId: string;
    severity?: string;
    status?: string;
    limit?: number;
  },
): Promise<string> {
  const params = new URLSearchParams();
  if (args.severity) params.set("severity", args.severity);
  if (args.status) params.set("status", args.status);

  const threats = await client.get<Threat[]>(
    `/api/threat-models/${args.modelId}/threats?${params}`,
  );

  const limit = args.limit ?? 20;
  const filtered = threats.slice(0, limit);

  if (!filtered.length) return "No threats found matching the criteria.";

  const lines = filtered.map((t) => {
    const cats = t.strideCategories?.join(", ") ?? "—";
    const mits = t.mitigations?.length ?? 0;
    return `- **${t.name}** [${t.severity}/${t.status}] — STRIDE: ${cats} — ${mits} mitigation(s)`;
  });

  const suffix =
    threats.length > limit
      ? `\n\n_(showing ${limit} of ${threats.length} threats)_`
      : "";

  return `Threats for model ${args.modelId}:\n\n${lines.join("\n")}${suffix}`;
}

/**
 * Get mitigations for a specific threat.
 */
export async function getMitigations(
  client: ThreatForgeClient,
  args: { modelId: string; threatId: string },
): Promise<string> {
  const threat = await client.get<Threat & { mitigations: Mitigation[] }>(
    `/api/threat-models/${args.modelId}/threats/${args.threatId}`,
  );

  const mits = threat.mitigations ?? [];
  if (!mits.length) {
    return `Threat "${threat.name}" has no mitigations defined yet.`;
  }

  const lines = mits.map((m) => {
    const evidence = m.evidenceLinks?.length
      ? ` [${m.evidenceLinks.length} evidence link(s)]`
      : "";
    return `- **${m.description}** [${m.status}/${m.priority ?? "—"}]${evidence}`;
  });

  return `Mitigations for "${threat.name}":\n\n${lines.join("\n")}`;
}

/**
 * Get compliance gaps for a model and framework.
 */
export async function getComplianceGaps(
  client: ThreatForgeClient,
  args: { modelId: string; framework: string },
): Promise<string> {
  const data = await client.get<{ gaps: ComplianceGap[]; score?: number }>(
    `/api/threat-models/${args.modelId}/compliance?framework=${args.framework}`,
  );

  const gaps = data.gaps ?? [];
  const notAddressed = gaps.filter((g) => g.status === "NOT_ADDRESSED");
  const partial = gaps.filter((g) => g.status === "PARTIAL");
  const covered = gaps.filter((g) => g.status === "COVERED");

  const lines: string[] = [
    `## Compliance Gap Analysis — ${args.framework}`,
    `**Score:** ${data.score ?? "N/A"}%`,
    `**Covered:** ${covered.length} | **Partial:** ${partial.length} | **Not addressed:** ${notAddressed.length}`,
    "",
  ];

  if (notAddressed.length > 0) {
    lines.push("### Not Addressed Controls");
    notAddressed.slice(0, 10).forEach((g) => {
      lines.push(`- [${g.controlId}] ${g.controlName}`);
    });
    if (notAddressed.length > 10) {
      lines.push(`_(and ${notAddressed.length - 10} more)_`);
    }
  }

  if (partial.length > 0) {
    lines.push("\n### Partial Controls");
    partial.slice(0, 5).forEach((g) => {
      lines.push(`- [${g.controlId}] ${g.controlName}`);
    });
  }

  return lines.join("\n");
}

/**
 * Get organization-wide portfolio risk summary.
 */
export async function getPortfolioRisk(
  client: ThreatForgeClient,
  args: { orgId: string; period?: string },
): Promise<string> {
  const period = args.period ?? "30d";
  const data = await client.get<{
    totalModels?: number;
    totalThreats?: number;
    openCritical?: number;
    mitigationRate?: number;
    topRisks?: Array<{ name: string; severity: string; modelName: string }>;
  }>(`/api/reporting/organization/${args.orgId}?period=${period}`);

  const lines = [
    `## Portfolio Risk Summary (last ${period})`,
    `**Models:** ${data.totalModels ?? 0}`,
    `**Total threats:** ${data.totalThreats ?? 0}`,
    `**Open critical:** ${data.openCritical ?? 0}`,
    `**Mitigation rate:** ${data.mitigationRate ?? 0}%`,
  ];

  if (data.topRisks?.length) {
    lines.push("\n### Top Risks");
    data.topRisks.slice(0, 5).forEach((r) => {
      lines.push(`- **${r.name}** [${r.severity}] in *${r.modelName}*`);
    });
  }

  return lines.join("\n");
}

/**
 * Update the status of a mitigation.
 */
export async function updateMitigationStatus(
  client: ThreatForgeClient,
  args: {
    modelId: string;
    mitigationId: string;
    status: string;
  },
): Promise<string> {
  const VALID = ["NOT_IMPLEMENTED", "IMPLEMENTED"];
  if (!VALID.includes(args.status)) {
    return `Invalid status "${args.status}". Valid values: ${VALID.join(", ")}`;
  }

  await client.patch(
    `/api/threat-models/${args.modelId}/mitigations/${args.mitigationId}`,
    { status: args.status },
  );

  return `Mitigation ${args.mitigationId} status updated to ${args.status}.`;
}

/**
 * Add an evidence link to a mitigation.
 */
export async function addEvidenceLink(
  client: ThreatForgeClient,
  args: {
    modelId: string;
    mitigationId: string;
    url: string;
    title?: string;
    type?: string;
  },
): Promise<string> {
  await client.post(
    `/api/threat-models/${args.modelId}/mitigations/${args.mitigationId}/evidence`,
    {
      url: args.url,
      title: args.title ?? args.url,
      type: args.type ?? "document",
    },
  );

  return `Evidence link added to mitigation ${args.mitigationId}: ${args.title ?? args.url}`;
}
