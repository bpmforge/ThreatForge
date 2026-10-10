/**
 * ChainValidator stage handler — attack-chain Pass 4.
 * AGENTIC_AI.md "Pass 4 — Chain Validation" + ARCHITECTURE §2.5 (canonical).
 *
 * Pass 4 validation is CODE, not LLM. For each candidate chain produced by the
 * PathGenerator, every hop after the first is valid iff
 *   1. CAPABILITY:   hop.preconditions ⊆ {entry assumptions} ∪ yields(hops 1..i)
 *   2. REACHABILITY: an edge path exists in canvasState (context.connections)
 *      between hop i's component and hop i+1's component.
 * A chain failing EITHER check on ANY hop is rejected — and rejected here in
 * code, BEFORE any LLM call. The original AGENTIC_AI design's LLM review becomes
 * a SECONDARY pass run only over the chains that survive the code check
 * (topology-impossible chains never reach the model).
 *
 * Entry assumptions: the entry point is, by Pass-1 definition, externally
 * reachable, so the attacker starts with `network:public`. The first hop's
 * preconditions are checked against exactly that set.
 *
 * Rollout: the whole attack-chain-v1 pipeline runs only when the org has the
 * `agent-chain-v2` flag (gated by the executor / ai-worker, as for the earlier passes).
 * This handler is pure orchestration and never checks the flag itself.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import type { ParseFailure } from "../micro-analysis/types.js";
import {
  VerdictArrayZ,
  safeParseArray,
} from "../schemas/llm-response-schemas.js";
import {
  CHAIN_REVIEW_SYSTEM_PROMPT,
  buildChainReviewUserPrompt,
} from "../prompts/attack-chain.js";
import type { CandidateChain } from "./path-generator.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

/** Capability the attacker holds at an entry point (Pass-1 definition). */
const ENTRY_ASSUMPTIONS = ["network:public"] as const;

/** Confidence below which a secondary-review REFUTED verdict is NOT acted on. */
const CHAIN_REFUTE_THRESHOLD = 0.7;

interface ChainValidatorInputs {
  context: ThreatModelContext;
  candidateChains: CandidateChain[];
  /** Skip the secondary LLM review (code check only). Default false. */
  skipLlmReview?: boolean;
}

/** Why a candidate chain was rejected by the code check (for observability). */
interface ChainRejection {
  chainName: string;
  reason: string;
}

/**
 * Undirected adjacency over the connection graph. Lateral movement can traverse
 * an edge in either direction, so reachability treats edges as undirected
 * (AGENTIC_AI Pass 4: "components are actually connected, directly or via a
 * multi-hop path").
 */
export function buildAdjacency(
  context: ThreatModelContext,
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    const set = adj.get(a) ?? new Set<string>();
    set.add(b);
    adj.set(a, set);
  };
  for (const conn of context.connections) {
    link(conn.source, conn.target);
    link(conn.target, conn.source);
  }
  return adj;
}

/** BFS: is `to` reachable from `from` over the (undirected) connection graph? */
export function isReachable(
  from: string,
  to: string,
  adj: Map<string, Set<string>>,
): boolean {
  if (from === to) return true;
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const node = queue.shift() as string;
    for (const next of adj.get(node) ?? []) {
      if (next === to) return true;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

export interface ChainCodeCheck {
  valid: boolean;
  reason?: string;
}

/**
 * The §2.5 code check for ONE chain. Walks hops in order, accumulating yields,
 * and verifies (1) precondition ⊆ available-capabilities and (2) edge-path
 * reachability between consecutive hop components. Returns the first failure
 * reason, or {valid:true}.
 */
export function codeValidateChain(
  chain: CandidateChain,
  adj: Map<string, Set<string>>,
): ChainCodeCheck {
  const available = new Set<string>(ENTRY_ASSUMPTIONS);
  for (let i = 0; i < chain.hops.length; i++) {
    const hop = chain.hops[i];

    // (1) Capability: every precondition must already be available.
    const missing = hop.preconditions.filter((p) => !available.has(p));
    if (missing.length > 0) {
      return {
        valid: false,
        reason:
          `hop ${i + 1} (${hop.componentId}) needs unmet precondition(s) ` +
          `[${missing.join(", ")}] — not yielded by entry assumptions or prior hops`,
      };
    }

    // (2) Reachability: this hop's component must be reachable from the prior.
    if (i > 0) {
      const prev = chain.hops[i - 1].componentId;
      if (!isReachable(prev, hop.componentId, adj)) {
        return {
          valid: false,
          reason:
            `hop ${i + 1} (${hop.componentId}) is not connected to the previous ` +
            `hop component (${prev}) by any edge path in canvasState`,
        };
      }
    }

    // Yields of this hop become available to later hops.
    for (const y of hop.yields) available.add(y);
  }
  return { valid: true };
}

export async function chainValidatorStage(
  ctx: StageContext,
): Promise<StageResult> {
  const inputs = ctx.inputs as unknown as ChainValidatorInputs;
  const { context, candidateChains, skipLlmReview } = inputs;
  if (!context)
    throw new Error("ChainValidator requires inputs.context for topology");
  if (!Array.isArray(candidateChains))
    throw new Error("ChainValidator requires inputs.candidateChains");

  const adj = buildAdjacency(context);
  const parseFailures: ParseFailure[] = [];
  const rejections: ChainRejection[] = [];

  // --- Pass 4 CODE check: drop topology/capability-impossible chains. --------
  const survivors: CandidateChain[] = [];
  for (const chain of candidateChains) {
    const check = codeValidateChain(chain, adj);
    if (check.valid) {
      survivors.push(chain);
    } else {
      rejections.push({ chainName: chain.name, reason: check.reason ?? "" });
    }
  }

  await ctx.progress(
    50,
    `Chain validation (code): ${survivors.length}/${candidateChains.length} chains survived`,
  );

  // --- SECONDARY LLM review over SURVIVORS ONLY -----------------------------
  // Topology-impossible chains never reach the model. The review can still
  // refute a survivor (REFUTED ≥ threshold) — those are dropped too.
  let validatedChains = survivors;
  if (!skipLlmReview && survivors.length > 0) {
    try {
      const raw = await ctx.aiCall(
        CHAIN_REVIEW_SYSTEM_PROMPT,
        buildChainReviewUserPrompt(context, survivors),
      );
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        json = raw;
      }
      const { valid: verdicts, failed } = safeParseArray(VerdictArrayZ, json);
      for (const f of failed)
        parseFailures.push({
          stage: "attack-chain",
          index: f.index,
          error: f.error,
        });

      const refuted = new Set(
        verdicts
          .filter(
            (v) =>
              v.verdict === "REFUTED" && v.confidence >= CHAIN_REFUTE_THRESHOLD,
          )
          .map((v) => v.threatRef),
      );
      if (refuted.size > 0) {
        validatedChains = survivors.filter((c) => {
          if (refuted.has(c.name)) {
            rejections.push({
              chainName: c.name,
              reason: "secondary LLM review refuted the chain",
            });
            return false;
          }
          return true;
        });
      }
    } catch (err) {
      // Review is a non-fatal secondary pass — keep the code survivors.
      logger.warn(
        { err, stage: "ChainValidator" },
        "Chain secondary review failed; keeping code-validated survivors",
      );
    }
  }

  if (rejections.length > 0) {
    logger.warn(
      { count: rejections.length, stage: "ChainValidator" },
      "Chain validation dropped topology/capability-impossible chains",
    );
  }

  await ctx.progress(
    100,
    `Chain validation: ${validatedChains.length} valid chains, ${rejections.length} rejected`,
  );

  return {
    outputs: { validatedChains, rejections },
    tokensUsed: 0,
    parseFailures,
  };
}
