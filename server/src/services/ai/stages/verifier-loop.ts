/**
 * Verifier refutation feedback loop.
 *
 * When the challenger gate refutes > 40% of a (component, category) pair's
 * threats, that pair is re-queued ONCE through ThreatIdentifier with a
 * "previously refuted — do not re-propose" prompt block built from the refuted
 * threat names + reasons. The re-run threats go back through the SAME gate
 * (verifier.ts `gatePass`) and the SAME ADR-006 persist path — survivors are
 * persisted/flagged, fresh refutals deleted. This is the SECOND and FINAL pass:
 * the caller caps loopCount at 2 and never re-enters, so even a pair still
 * > 40% refuted after the re-run is accepted (no infinite loop).
 *
 * Scoping: the re-run analyzes EXACTLY the candidate components (the context is
 * filtered to them) and EXACTLY the candidate categories (options.categories),
 * with the per-pair refuted block keyed `${componentId}::${category}`. Re-run
 * threats are deduplicated against the surviving first-pass set by ADR-006 key
 * (threatRefOf) before gating, so a pair that re-proposes a survivor is a no-op.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import type { StageContext, StageResult } from "./registry.js";
import type { ThreatIdentifierInputs } from "./identifier-inputs.js";
import type { VerifierDecision, VerifierPersist } from "./verifier-persist.js";
import type { GatePass } from "./verifier.js";
import type { RequeuePlanEntry } from "./verifier-checks.js";
import { threatRefOf } from "./verifier-checks.js";
import { threatIdentifierStage } from "./threat-identifier.js";
import type { VerdictZShape } from "../schemas/llm-response-schemas.js";

/** §2.4: > 40% of a (component, category) pair refuted → re-queue once. */
export const REQUEUE_FRACTION = 0.4;

export interface RefutationLoopArgs {
  ctx: StageContext;
  context: ThreatModelContext;
  /** ThreatIdentifier inputs to re-run (context/options/persist live here). */
  identifierInputs: ThreatIdentifierInputs;
  persist?: VerifierPersist;
  plan: RequeuePlanEntry[];
  /** ADR-006 keys of the first-pass survivors — re-proposals are dropped. */
  survivorRefs: Set<string>;
  /** Gate a fresh threat list (verifier.ts `gatePass` — no DB). */
  gate: (threats: MicroThreat[]) => Promise<GatePass>;
  /** Persist a gate pass (delete refuted + flag kept). Returns deleted count. */
  applyPass: (pass: GatePass) => Promise<number>;
}

export interface RefutationLoopResult {
  verifiedThreats: MicroThreat[];
  decisions: VerifierDecision[];
  deleted: number;
  topologyRefutedCount: number;
  verdicts: Map<string, VerdictZShape>;
}

/**
 * Re-run the refuted pairs once and gate the results. The ThreatIdentifier
 * stage handles its own dedup/persist for the new threats; we gate the new set
 * here and return the survivors so the caller folds them into the final set.
 */
export async function runRefutationLoop(
  args: RefutationLoopArgs,
): Promise<RefutationLoopResult> {
  const {
    ctx,
    context,
    identifierInputs,
    plan,
    survivorRefs,
    gate,
    applyPass,
  } = args;

  // Restrict the re-run to exactly the candidate components + categories, and
  // attach the per-pair refuted block. The base options are preserved so the
  // re-run uses the same methodology / confidence / persist as the first pass.
  const candidateComponentIds = new Set(plan.map((p) => p.componentId));
  const candidateCategories = [...new Set(plan.map((p) => p.category))];
  const refutedThreats: Record<
    string,
    Array<{ name: string; reason?: string }>
  > = {};
  for (const p of plan) {
    refutedThreats[`${p.componentId}::${p.category}`] = p.refuted;
  }

  const rerunContext: ThreatModelContext = {
    ...context,
    components: context.components.filter((c) =>
      candidateComponentIds.has(c.id),
    ),
  };

  const rerunInputs: ThreatIdentifierInputs = {
    ...identifierInputs,
    context: rerunContext,
    // ArchitectureReader-derived inputs are dropped so the handler recomputes
    // setup from the FILTERED context (otherwise it would re-run every cached
    // component). The raw-context path is byte-equivalent (identifier-inputs).
    componentContexts: undefined,
    options: {
      ...identifierInputs.options,
      categories: candidateCategories,
      // A re-run must analyze the pairs even though they were just analyzed —
      // bypass the unchanged-hash skip-set for this scoped pass.
      force: true,
      refutedThreats,
      // Fan-out (Redis) is irrelevant for a tiny scoped re-run; keep it inline.
      onProgress: undefined,
      onCheckpoint: undefined,
      onComponentPersisted: undefined,
    },
  };

  await ctx.progress(
    80,
    `Re-queue: ${plan.length} pair(s) through ThreatIdentifier`,
  );

  const reResult: StageResult = await threatIdentifierStage({
    ...ctx,
    inputs: { ...rerunInputs, fanOut: false } as unknown as Record<
      string,
      unknown
    >,
  });

  // Drop re-proposals of threats that already survived the first pass
  // (ADR-006 dedup at the in-memory boundary — the DB persist dedups too).
  const reThreats = ((reResult.outputs.threats as MicroThreat[]) ?? []).filter(
    (t) => !survivorRefs.has(threatRefOf(t)),
  );
  if (reThreats.length === 0) {
    return {
      verifiedThreats: [],
      decisions: [],
      deleted: 0,
      topologyRefutedCount: 0,
      verdicts: new Map(),
    };
  }

  // Gate the re-run threats through the SAME challenger gate, then persist.
  const pass = await gate(reThreats);
  const deleted = await applyPass(pass);

  return {
    verifiedThreats: pass.verifiedThreats,
    decisions: pass.decisions,
    deleted,
    topologyRefutedCount: pass.topologyRefutedCount,
    verdicts: pass.verdicts,
  };
}
