/**
 * Verifier check helpers: pure functions for the challenger gate.
 * Kept out of verifier.ts so the stage handler stays within the service
 * line budget and the gate rules are unit-testable in isolation.
 *
 * Three checks per AI_SUGGESTED threat in
 * order (cheap → expensive): topology (code) → citation (code) → refutation
 * (LLM, handled in verifier.ts). This file owns the two code-only checks plus
 * the verdict→action gate.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import {
  COMPOUND_COMPONENT_SENTINEL,
  SUPPLY_CHAIN_COMPONENT_SENTINEL,
} from "../micro-analysis/compound-analyzer.js";
import { normalizeThreatName } from "../../threat-review/normalize-threat-name.js";
import type { VerdictZShape } from "../schemas/llm-response-schemas.js";

/** Stable, DB-id-free handle the refutation prompt echoes back. */
export function threatRefOf(t: MicroThreat): string {
  const target =
    t.componentId && t.componentId !== "compound"
      ? t.componentId
      : "__compound__";
  return `${normalizeThreatName(t.name)}::${target}`;
}

export interface TopologyIndex {
  componentIds: Set<string>;
  connectionIds: Set<string>;
}

export function buildTopologyIndex(context: ThreatModelContext): TopologyIndex {
  return {
    componentIds: new Set(context.components.map((c) => c.id)),
    connectionIds: new Set(context.connections.map((c) => c.id)),
  };
}

/**
 * Topology check (no LLM). A threat is topology-impossible when it names a
 * concrete target that is absent from the model. Compound threats (no single
 * component) and connection-targeted threats whose edge exists both pass.
 */
export function isTopologyImpossible(
  t: MicroThreat,
  idx: TopologyIndex,
): boolean {
  const target = t.componentId;
  if (
    !target ||
    target === COMPOUND_COMPONENT_SENTINEL ||
    target === SUPPLY_CHAIN_COMPONENT_SENTINEL
  )
    return false; // sentinel targets — nothing to check
  if (idx.componentIds.has(target)) return false; // valid component target
  if (idx.connectionIds.has(target)) return false; // valid connection target
  return true; // names a target that does not exist → impossible
}

/**
 * Citation check (code, non-fatal). Strips inline `[ref:CWE-…]` / `[ref:…]`
 * tags whose id is empty/malformed so they cannot masquerade as evidence.
 * Heavy document cross-checking stays in the existing async VERIFY_CITATIONS
 * job (§2.4: "invalid citations are stripped, not fatal"). Returns the
 * description with bad tags removed and the count stripped.
 */
const REF_TAG = /\[ref:([^\]]*)\]/gi;
export function stripInvalidCitations(description: string): {
  cleaned: string;
  stripped: number;
} {
  let stripped = 0;
  const cleaned = description.replace(REF_TAG, (full, id: string) => {
    const ok = /^[A-Za-z]+-?[\w.:/-]+$/.test(id.trim());
    if (ok) return full;
    stripped++;
    return "";
  });
  return { cleaned: cleaned.replace(/\s{2,}/g, " ").trim(), stripped };
}

export type GateAction = "DELETE" | "CONFIRM" | "UNCERTAIN";

/**
 * Verdict → action gate (§2.4):
 *  - REFUTED & confidence ≥ 0.7  → DELETE
 *  - REFUTED & confidence < 0.7  → keep, UNCERTAIN
 *  - UNCERTAIN                   → keep, UNCERTAIN
 *  - CONFIRMED                   → keep, CONFIRM
 */
const REFUTE_DELETE_THRESHOLD = 0.7;

export function gateForVerdict(v: VerdictZShape): GateAction {
  if (v.verdict === "REFUTED") {
    return v.confidence >= REFUTE_DELETE_THRESHOLD ? "DELETE" : "UNCERTAIN";
  }
  if (v.verdict === "UNCERTAIN") return "UNCERTAIN";
  return "CONFIRM";
}

/**
 * The (componentId, category) pairs whose refuted fraction exceeds
 * `fraction`. Record only: the re-queue loop itself lives in
 * verifier-loop.ts. `wasRefuted(t)` says whether threat t was removed.
 */
export function computeRequeueCandidates(
  threats: MicroThreat[],
  wasRefuted: (t: MicroThreat) => boolean,
  fraction: number,
): Array<{ componentId: string; category: string }> {
  const byPair = new Map<string, { total: number; refuted: number }>();
  for (const t of threats) {
    const key = `${t.componentId}::${t.category}`;
    const p = byPair.get(key) ?? { total: 0, refuted: 0 };
    p.total++;
    if (wasRefuted(t)) p.refuted++;
    byPair.set(key, p);
  }
  return [...byPair.entries()]
    .filter(([, p]) => p.total > 0 && p.refuted / p.total > fraction)
    .map(([key]) => {
      const [componentId, category] = key.split("::");
      return { componentId, category };
    });
}

/** One (component, category) pair to re-queue, with the refuted threats that
 *  populate its "previously refuted — do not re-propose" prompt block. */
export interface RequeuePlanEntry {
  componentId: string;
  category: string;
  refuted: Array<{ name: string; reason?: string }>;
}

/**
 * Re-queue plan: the pairs whose refuted fraction exceeds `fraction`,
 * each carrying the names + reasons of the threats that were refuted on it.
 * `wasRefuted(t)` says whether threat t was removed; `reasonFor(t)` supplies
 * the refutation reason recorded for it (verdict.refutationReason). Reuses
 * computeRequeueCandidates for the threshold so the >40% rule lives in one
 * place — this only enriches the surviving pairs with their refuted threats.
 */
export function buildRequeuePlan(
  threats: MicroThreat[],
  wasRefuted: (t: MicroThreat) => boolean,
  reasonFor: (t: MicroThreat) => string | undefined,
  fraction: number,
): RequeuePlanEntry[] {
  const candidates = computeRequeueCandidates(threats, wasRefuted, fraction);
  const wanted = new Set(
    candidates.map((c) => `${c.componentId}::${c.category}`),
  );
  const refutedByPair = new Map<
    string,
    Array<{ name: string; reason?: string }>
  >();
  for (const t of threats) {
    const key = `${t.componentId}::${t.category}`;
    if (!wanted.has(key) || !wasRefuted(t)) continue;
    const arr = refutedByPair.get(key) ?? [];
    arr.push({ name: t.name, reason: reasonFor(t) });
    refutedByPair.set(key, arr);
  }
  return candidates.map((c) => ({
    componentId: c.componentId,
    category: c.category,
    refuted: refutedByPair.get(`${c.componentId}::${c.category}`) ?? [],
  }));
}
