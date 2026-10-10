/**
 * Loop-until-dry discovery — ARCHITECTURE §2.6.
 *
 * After the Verifier, when discovery mode is "until-dry" AND the run produced
 * >= 1 net-new CONFIRMED threat, re-run the identifier pipeline for the affected
 * components with an "already found (do not re-propose)" block built from the
 * normalized names of ALL confirmed threats so far. Keep looping until a round
 * adds 0 net-new threats (post-dedup, post-verifier) or after `maxRounds`
 * (default 3). Mode "single" (the seeded default) runs exactly one round and is
 * equivalent to a plain single pass — no extra rounds, no behavior change.
 *
 * "Net-new" is measured by the ADR-006 key (threatRefOf:
 * `normalizedName::targetKey`): a round's contribution is the set of survivor
 * keys not already accumulated from prior rounds. The "already found" block is
 * the `refutedThreats` mechanism reused without a refutation reason —
 * keyed `${componentId}::${category}`, rendered into each category prompt as a
 * "DO NOT re-propose" section (micro-prompt-builder.buildRefutedBlock).
 *
 * This module is pure orchestration over an injected `runRound` callback so the
 * loop (round counting + cap + already-found accumulation) is unit-testable
 * without a pipeline. The runner (suggest-threats-v2.ts) supplies a `runRound`
 * that executes the seeded pipeline once and returns the Verifier final set.
 */
import type { MicroThreat } from "../services/ai/micro-analysis/types.js";
import { threatRefOf } from "../services/ai/stages/verifier-checks.js";

/** Discovery config — lives on the pipeline definition; opt-in via job options. */
export interface DiscoveryConfig {
  mode: "single" | "until-dry";
  maxRounds: number;
}

/** Pipeline-definition default: single round (loop-until-dry is OFF by default). */
export const DISCOVERY_DEFAULT: DiscoveryConfig = {
  mode: "single",
  maxRounds: 3,
};

/** One ThreatIdentifier re-run's already-found block, keyed `componentId::category`. */
export type AlreadyFoundBlock = Record<
  string,
  Array<{ name: string; reason?: string }>
>;

/** The result of one discovery round (what the runner's pipeline produces). */
export interface RoundOutcome {
  /** The Verifier final set persisted this round (CONFIRMED + UNCERTAIN). */
  verifiedThreats: MicroThreat[];
  /** Of those, the threats the Verifier labelled CONFIRMED (drives the trigger). */
  confirmedThreats: MicroThreat[];
  /**
   * Threats the Verifier refuted this round. Carried across rounds into
   * the "do not re-propose" block, so a later round does not re-spend LLM
   * calls re-proposing what an earlier round already had refuted.
   */
  refutedThreats?: Array<{ threat: MicroThreat; reason?: string }>;
}

/** Inputs to one round — the accumulated already-found block + affected scope. */
export interface RoundRequest {
  round: number;
  /** Already-found block (omit on round 1 — first pass prompt is unchanged). */
  alreadyFound?: AlreadyFoundBlock;
  /** DB component ids to restrict the re-run to (omit on round 1 = all). */
  affectedComponentIds?: string[];
}

export interface DiscoveryLoopArgs {
  config: DiscoveryConfig;
  /** Execute one pipeline round; round 1 is the normal full run. */
  runRound: (req: RoundRequest) => Promise<RoundOutcome>;
  /** Job-progress reporter — emits "round N — X new threats". */
  report?: (phase: string, detail: string) => void;
}

export interface DiscoveryLoopResult {
  /** The accumulated final set across all rounds (deduped by ADR-006 key). */
  finalSet: MicroThreat[];
  /** How many rounds actually ran (single mode => 1). */
  roundsRun: number;
  /** Net-new survivor count per round, in order (round 1 = its full set). */
  newPerRound: number[];
}

/**
 * Build the "already found — do not re-propose" block from a set of threats,
 * keyed `${componentId}::${category}`. Reuses the refutedThreats shape so
 * the existing micro-prompt-builder renders it; no `reason` is attached (these
 * were CONFIRMED, not refuted — the instruction is simply "already found").
 * Model-wide threats (no componentId) are skipped: they have no per-category
 * prompt to attach to.
 */
export function buildAlreadyFoundBlock(
  threats: MicroThreat[],
  refuted: Array<{ threat: MicroThreat; reason?: string }> = [],
): AlreadyFoundBlock {
  const block: AlreadyFoundBlock = {};
  const add = (t: MicroThreat, reason?: string) => {
    if (!t.componentId || t.componentId === "compound") return;
    const key = `${t.componentId}::${t.category}`;
    const list = (block[key] ??= []);
    if (list.some((e) => e.name === t.name)) return;
    list.push(reason ? { name: t.name, reason } : { name: t.name });
  };
  for (const t of threats) add(t);
  // Refuted threats ride along with their reason (the refutedThreats shape).
  for (const r of refuted) add(r.threat, r.reason);
  return block;
}

/**
 * Run the loop-until-dry discovery loop. Round 1 always runs (the normal pass).
 * For mode "until-dry", keep re-running affected components with the cumulative
 * already-found block until a round adds 0 net-new survivors or `maxRounds` is
 * reached. Net-new is measured against the accumulated ADR-006 key set so a
 * round that only re-proposes prior threats counts as 0 and stops the loop.
 */
export async function runDiscoveryLoop(
  args: DiscoveryLoopArgs,
): Promise<DiscoveryLoopResult> {
  const { config, runRound, report } = args;
  const maxRounds = Math.max(1, config.maxRounds);

  const seenKeys = new Set<string>();
  const accumulated: MicroThreat[] = [];
  const newPerRound: number[] = [];
  const refutedAcc: Array<{ threat: MicroThreat; reason?: string }> = [];

  // --- Round 1: the normal pass (no already-found block, full scope). ---
  let outcome = await runRound({ round: 1 });
  refutedAcc.push(...(outcome.refutedThreats ?? []));
  let newThisRound = absorb(outcome.verifiedThreats, seenKeys, accumulated);
  newPerRound.push(newThisRound);
  report?.("discovery", `round 1 — ${newThisRound} new threats`);

  // Single mode (default) stops here — one plain pass.
  if (config.mode !== "until-dry") {
    return { finalSet: accumulated, roundsRun: 1, newPerRound };
  }

  let round = 1;
  // Trigger gate (§2.6): only loop while the LAST round produced >= 1 net-new
  // CONFIRMED threat. A round of only UNCERTAIN keeps (or only re-proposals)
  // does not justify another expensive pass. Round 1's "before" set is empty,
  // so every CONFIRMED threat it produced is net-new.
  let confirmedNewLast = outcome.confirmedThreats.length;

  while (round < maxRounds && confirmedNewLast > 0) {
    round += 1;
    const alreadyFound = buildAlreadyFoundBlock(accumulated, refutedAcc);
    const affectedComponentIds = affectedComponents(accumulated);

    const before = new Set(seenKeys);
    outcome = await runRound({ round, alreadyFound, affectedComponentIds });
    refutedAcc.push(...(outcome.refutedThreats ?? []));
    newThisRound = absorb(outcome.verifiedThreats, seenKeys, accumulated);
    newPerRound.push(newThisRound);
    report?.("discovery", `round ${round} — ${newThisRound} new threats`);

    // Stop when a round adds 0 net-new (post-dedup, post-verifier) survivors.
    if (newThisRound === 0) break;
    // Re-evaluate the CONFIRMED trigger for the NEXT iteration using only the
    // threats that were net-new this round (keys absent from `before`).
    confirmedNewLast = outcome.confirmedThreats.filter(
      (t) => !before.has(threatRefOf(t)),
    ).length;
  }

  return { finalSet: accumulated, roundsRun: round, newPerRound };
}

/** Add `threats` to the accumulator under their ADR-006 key; return net-new count. */
function absorb(
  threats: MicroThreat[],
  seenKeys: Set<string>,
  accumulated: MicroThreat[],
): number {
  let added = 0;
  for (const t of threats) {
    const key = threatRefOf(t);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    accumulated.push(t);
    added += 1;
  }
  return added;
}

/** DB component ids that have >= 1 threat in the accumulated set (re-run scope). */
function affectedComponents(threats: MicroThreat[]): string[] {
  const ids = new Set<string>();
  for (const t of threats) {
    if (t.componentId && t.componentId !== "compound") ids.add(t.componentId);
  }
  return [...ids];
}
