/**
 * Architectural Mitigation AI Service
 *
 * Proposes changes to the model's ARCHITECTURE (add a WAF, add a trust
 * boundary, encrypt a connection, split a component, ...) that address a
 * cluster of existing threats / attack chains. Single LLM pass; every id the
 * model returns is validated against the real model so nothing dangling is
 * persisted. The prompt lives here, NOT in micro-analysis prompts, so the
 * replay journal for existing stages stays valid.
 *
 * Pure: no DB access. Persistence (and the never-overwrite-human-rows rule)
 * lives in the worker via `planArchitecturalMitigationWrite`.
 */
import type { AIProviderClient, ThreatModelContext } from "../../types/ai.js";
import { extractJsonArray } from "./response-parsers.js";
import logger from "../../utils/logger.js";

export const ARCHITECTURAL_KINDS = [
  "ADD_WAF",
  "ADD_TRUST_BOUNDARY",
  "ENCRYPT_CONNECTION",
  "SPLIT_COMPONENT",
  "ADD_AUTHENTICATION",
  "OTHER",
] as const;
type ArchitecturalKind = (typeof ARCHITECTURAL_KINDS)[number];

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type Priority = (typeof PRIORITIES)[number];

const MAX_PROPOSALS = 8;
const MAX_THREATS_IN_PROMPT = 60;

export interface ThreatSummary {
  id: string;
  name: string;
  severity: string;
  componentId?: string | null;
  connectionId?: string | null;
}

export interface ChainSummary {
  id: string;
  name: string;
  severity: string;
  componentIds: string[];
}

export interface GeneratedArchitecturalMitigation {
  kind: ArchitecturalKind;
  title: string;
  proposedChange: string;
  rationale: string | null;
  affectedComponentIds: string[];
  affectedConnectionIds: string[];
  threatIds: string[];
  attackChainIds: string[];
  priority: Priority;
}

export interface ArchitecturalMitigationResult {
  proposals: GeneratedArchitecturalMitigation[];
  /** True when the reply could not be parsed (vs. a genuine "no proposals"). */
  failed: boolean;
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

function architecturalMitigationPrompt(
  context: ThreatModelContext,
  threats: ThreatSummary[],
  chains: ChainSummary[],
): string {
  const topThreats = [...threats]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5),
    )
    .slice(0, MAX_THREATS_IN_PROMPT);
  return `You are a security architect. Propose ARCHITECTURAL mitigations: changes to the system's structure (not code-level fixes) that each address a cluster of the threats below.

Allowed kinds: ${ARCHITECTURAL_KINDS.join(", ")}.

Components: ${JSON.stringify(context.components.map((c) => ({ id: c.id, type: c.type, name: c.name })))}
Connections: ${JSON.stringify(context.connections.map((c) => ({ id: c.id, from: c.source, to: c.target, protocol: c.protocol, encrypted: c.encrypted })))}
Trust boundaries: ${JSON.stringify(context.boundaries)}
Threats: ${JSON.stringify(topThreats)}
Attack chains: ${JSON.stringify(chains)}

Rules:
- Each proposal must cite at least one real threat id from the Threats list.
- affectedComponentIds / affectedConnectionIds must use ids from the lists above.
- Prefer one change that covers several threats over many narrow ones. At most ${MAX_PROPOSALS} proposals.
Return ONLY a JSON array (no markdown): [{"kind":"ADD_WAF","title":"...","proposedChange":"...","rationale":"...","affectedComponentIds":["..."],"affectedConnectionIds":["..."],"threatIds":["..."],"attackChainIds":["..."],"priority":"HIGH"}]`;
}

function strArray(v: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v.filter((x): x is string => typeof x === "string" && valid.has(x)),
    ),
  ];
}

function safeParse(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Stable identity of a proposal, used to dedupe against human-reviewed rows. */
function proposalKey(p: {
  kind: string;
  affectedComponentIds: string[];
  affectedConnectionIds: string[];
}): string {
  return [
    p.kind,
    [...p.affectedComponentIds].sort().join(","),
    [...p.affectedConnectionIds].sort().join(","),
  ].join("|");
}

export async function generateArchitecturalMitigations(
  client: AIProviderClient,
  context: ThreatModelContext,
  threats: ThreatSummary[],
  chains: ChainSummary[],
): Promise<ArchitecturalMitigationResult> {
  if (threats.length === 0) return { proposals: [], failed: false };

  let raw: string;
  try {
    const resp = await client.complete({
      messages: [
        {
          role: "user",
          content: architecturalMitigationPrompt(context, threats, chains),
        },
      ],
      temperature: 0.2,
      maxTokens: 8000,
    });
    raw = resp.content;
  } catch (err) {
    logger.warn({ err }, "architectural-mitigations: LLM call failed");
    return { proposals: [], failed: true };
  }

  const items = extractJsonArray(raw);
  if (items === null) return { proposals: [], failed: true };

  const componentIds = new Set(context.components.map((c) => c.id));
  const connectionIds = new Set(context.connections.map((c) => c.id));
  const threatIds = new Set(threats.map((t) => t.id));
  const chainIds = new Set(chains.map((c) => c.id));
  const seen = new Set<string>();
  const proposals: GeneratedArchitecturalMitigation[] = [];

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const kind = String(r.kind ?? "").toUpperCase() as ArchitecturalKind;
    if (!ARCHITECTURAL_KINDS.includes(kind)) continue;
    if (typeof r.title !== "string" || typeof r.proposedChange !== "string")
      continue;
    const addressed = strArray(r.threatIds, threatIds);
    if (addressed.length === 0) continue; // must address real threats
    const priority = String(r.priority).toUpperCase() as Priority;
    const p: GeneratedArchitecturalMitigation = {
      kind,
      title: r.title.trim().slice(0, 200),
      proposedChange: r.proposedChange.trim(),
      rationale: typeof r.rationale === "string" ? r.rationale.trim() : null,
      affectedComponentIds: strArray(r.affectedComponentIds, componentIds),
      affectedConnectionIds: strArray(r.affectedConnectionIds, connectionIds),
      threatIds: addressed,
      attackChainIds: strArray(r.attackChainIds, chainIds),
      priority: PRIORITIES.includes(priority) ? priority : "MEDIUM",
    };
    if (!p.title || !p.proposedChange) continue;
    const key = proposalKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    proposals.push(p);
    if (proposals.length >= MAX_PROPOSALS) break;
  }

  // Items came back but none survived validation: treat as malformed so the
  // caller fails the job instead of reporting a silent "0 proposals".
  return { proposals, failed: proposals.length === 0 && items.length > 0 };
}

/**
 * Prisma `create` data for one AI proposal (status AI_SUGGESTED, source AI).
 * Shared by the ARCHITECTURAL_MITIGATIONS job and the duplicate guard's
 * shared-control grouping so both write rows the same way.
 */
export function architecturalMitigationRowData(
  threatModelId: string,
  sessionId: string,
  p: GeneratedArchitecturalMitigation,
) {
  return {
    threatModelId,
    kind: p.kind,
    title: p.title,
    proposedChange: p.proposedChange,
    rationale: p.rationale,
    affectedComponentIds: JSON.stringify(p.affectedComponentIds),
    affectedConnectionIds: JSON.stringify(p.affectedConnectionIds),
    threatIds: JSON.stringify(p.threatIds),
    attackChainIds: JSON.stringify(p.attackChainIds),
    priority: p.priority,
    status: "AI_SUGGESTED" as const,
    source: "AI",
    sessionId,
  };
}

/**
 * Rationale prefix on rows written by the duplicate guard's shared-control
 * grouping (services/ai/dedup/shared-controls.ts). Those rows belong to the
 * threat run that produced them; this job never deletes them.
 */
export const SHARED_CONTROL_MARKER = "[duplicate-guard shared control]";

export function isSharedControlRow(e: { rationale?: string | null }): boolean {
  return !!e.rationale?.startsWith(SHARED_CONTROL_MARKER);
}

/**
 * Decide what a regeneration run may write, given the rows already stored.
 * Only source=AI + status=AI_SUGGESTED rows are replaceable; anything a human
 * has touched (ACCEPTED/REJECTED/MODIFIED or source HUMAN) is preserved, and a
 * new proposal that duplicates a preserved row is dropped (so a REJECTED idea
 * is not re-suggested).
 */
export function planArchitecturalMitigationWrite(
  existing: Array<{
    id: string;
    kind: string;
    status: string;
    source: string;
    affectedComponentIds: string;
    affectedConnectionIds: string;
    rationale?: string | null;
  }>,
  proposals: GeneratedArchitecturalMitigation[],
): { deleteIds: string[]; create: GeneratedArchitecturalMitigation[] } {
  const isReplaceable = (e: {
    status: string;
    source: string;
    rationale?: string | null;
  }) =>
    e.source === "AI" && e.status === "AI_SUGGESTED" && !isSharedControlRow(e);
  const protectedKeys = new Set(
    existing
      .filter((e) => !isReplaceable(e))
      .map((e) =>
        proposalKey({
          kind: e.kind,
          affectedComponentIds: safeParse(e.affectedComponentIds),
          affectedConnectionIds: safeParse(e.affectedConnectionIds),
        }),
      ),
  );
  return {
    deleteIds: existing.filter(isReplaceable).map((e) => e.id),
    create: proposals.filter((p) => !protectedKeys.has(proposalKey(p))),
  };
}
