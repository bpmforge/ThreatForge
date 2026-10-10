/**
 * Verifier stage handler — the adversarial challenger gate.
 * Three checks per AI_SUGGESTED threat produced
 * this run, in order (cheap → expensive):
 *   1. Topology (code)   — target component/connection must exist.
 *   2. Citation (code)   — strip invalid inline [ref:…] tags; non-fatal.
 *   3. Refutation (LLM)  — argue the threat does NOT apply; default to refuted.
 *
 * Gate: REFUTED & confidence ≥ 0.7 → DELETE; UNCERTAIN / low-conf REFUTED →
 * keep & flag UNCERTAIN; CONFIRMED → keep & flag CONFIRMED.
 *
 * Deletion safety (asserted in code, not just tests): only AI_SUGGESTED,
 * reviewStatus=PENDING, manuallyEdited=false rows tagged with THIS sessionId
 * are ever removed — human-reviewed threats are never touched.
 *
 * Re-queue loop: when > 40% of a (component, category) pair's threats are refuted, that
 * pair is re-queued ONCE through ThreatIdentifier (verifier-loop.ts), capped at
 * loopCount 2 — even a pair still > 40% refuted after the re-run is accepted.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import {
  safeParseArray,
  VerdictArrayZ,
  type VerdictZShape,
} from "../schemas/llm-response-schemas.js";
import {
  VERIFIER_SYSTEM_PROMPT,
  buildVerifierUserPrompt,
  type VerifierThreatLine,
} from "../prompts/verifier.js";
import {
  buildRequeuePlan,
  buildTopologyIndex,
  computeRequeueCandidates,
  gateForVerdict,
  isTopologyImpossible,
  stripInvalidCitations,
  threatRefOf,
} from "./verifier-checks.js";
import {
  deleteRefuted,
  flagKept,
  type NodeIdMaps,
  type VerifierDecision,
  type VerifierPersist,
} from "./verifier-persist.js";
import { buildNodeIdMaps } from "./identifier-context.js";
import { runRefutationLoop, REQUEUE_FRACTION } from "./verifier-loop.js";
import type { ThreatIdentifierInputs } from "./identifier-inputs.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

const BATCH_SIZE = 10;

export interface VerifierInputs {
  threats: MicroThreat[];
  context: ThreatModelContext;
  /** Persist gate — deletion only runs when this is present. */
  persist?: VerifierPersist;
  /** ThreatIdentifier inputs for the re-queue loop; absent → loop is a no-op. */
  identifierInputs?: ThreatIdentifierInputs;
}

/** Result of one challenger-gate pass — no persistence (the caller applies it). */
export interface GatePass {
  verifiedThreats: MicroThreat[];
  decisions: VerifierDecision[];
  deleteKeys: Set<string>;
  verdicts: Map<string, VerdictZShape>;
  topologyRefutedCount: number;
}

export function summarize(ctx: ThreatModelContext): string {
  const nameById = new Map(ctx.components.map((c) => [c.id, c.name]));
  const zoneById = new Map(ctx.components.map((c) => [c.id, c.trustZone]));
  const comps = ctx.components
    .map(
      (c) => `- ${c.name} [${c.type}]${c.trustZone ? ` (${c.trustZone})` : ""}`,
    )
    .join("\n");
  // A refuter that cannot see authentication or trust-boundary crossings
  // cannot tell "unauthenticated hop" from "authenticated hop" and refutes on
  // guesswork. Render endpoints by NAME (no ids), auth, and boundary crossings.
  const conns = ctx.connections
    .map((c) => {
      const from = nameById.get(c.source) ?? "?";
      const to = nameById.get(c.target) ?? "?";
      const zFrom = zoneById.get(c.source);
      const zTo = zoneById.get(c.target);
      const crosses = zFrom && zTo && zFrom !== zTo;
      return `- ${c.label ?? "link"} (${from} -> ${to}): ${c.protocol ?? "?"}, ${c.encrypted ? "encrypted" : "cleartext"}, auth=${c.authentication || "none"}${crosses ? ", CROSSES TRUST BOUNDARY" : ""}`;
    })
    .join("\n");
  const bounds = (ctx.boundaries ?? [])
    .map((b) => `- ${b.name}${b.trustLevel ? ` (${b.trustLevel})` : ""}`)
    .join("\n");
  return `Components:\n${comps || "(none)"}\n\nConnections:\n${conns || "(none)"}${bounds ? `\n\nTrust boundaries:\n${bounds}` : ""}`;
}

export function toLine(t: MicroThreat): VerifierThreatLine {
  return {
    threatRef: threatRefOf(t),
    name: t.name,
    category: t.category,
    targetName: t.componentName || "(model-wide)",
    description: stripInvalidCitations(t.description).cleaned,
    cweIds: t.cweIds,
  };
}

async function refute(
  aiCall: StageContext["aiCall"],
  context: ThreatModelContext,
  survivors: MicroThreat[],
): Promise<Map<string, VerdictZShape>> {
  const verdicts = new Map<string, VerdictZShape>();
  const summary = summarize(context);
  for (let i = 0; i < survivors.length; i += BATCH_SIZE) {
    const batch = survivors.slice(i, i + BATCH_SIZE);
    const raw = await aiCall(
      VERIFIER_SYSTEM_PROMPT,
      buildVerifierUserPrompt(summary, batch.map(toLine)),
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw; // safeParseArray reports a structured failure
    }
    const { valid } = safeParseArray(VerdictArrayZ, parsed);
    for (const v of valid) verdicts.set(v.threatRef, v);
  }
  return verdicts;
}

/**
 * Run the full gate (topology → refutation → verdict) over `threats` with one
 * adversarial LLM pass. No persistence — the caller decides what to delete and
 * flag. Reused by the initial pass AND each re-run, so the gate logic is
 * identical every loop.
 */
async function gatePass(
  aiCall: StageContext["aiCall"],
  context: ThreatModelContext,
  threats: MicroThreat[],
): Promise<GatePass> {
  const idx = buildTopologyIndex(context);
  const topoRefuted: MicroThreat[] = [];
  const survivors: MicroThreat[] = [];
  for (const t of threats) {
    if (isTopologyImpossible(t, idx)) topoRefuted.push(t);
    else survivors.push(t);
  }

  const verdicts =
    survivors.length > 0
      ? await refute(aiCall, context, survivors)
      : new Map<string, VerdictZShape>();

  const deleteKeys = new Set<string>(topoRefuted.map(threatRefOf));
  const decisions: VerifierDecision[] = [];
  const verifiedThreats: MicroThreat[] = [];
  for (const t of survivors) {
    const ref = threatRefOf(t);
    const v = verdicts.get(ref);
    const action = v ? gateForVerdict(v) : "UNCERTAIN"; // parse miss → keep, flag
    if (action === "DELETE") {
      deleteKeys.add(ref);
      continue;
    }
    decisions.push({
      threatRef: ref,
      challengeStatus: action === "CONFIRM" ? "CONFIRMED" : "UNCERTAIN",
      verificationNote: v?.refutationReason,
    });
    verifiedThreats.push(t);
  }

  return {
    verifiedThreats,
    decisions,
    deleteKeys,
    verdicts,
    topologyRefutedCount: topoRefuted.length,
  };
}

/** Apply a gate pass to the DB — deletions strictly session-scoped. */
async function applyPass(
  persist: VerifierPersist,
  pass: GatePass,
  maps: NodeIdMaps,
): Promise<number> {
  const deleted = await deleteRefuted(
    persist,
    pass.deleteKeys,
    undefined,
    maps,
  );
  await flagKept(persist, pass.decisions, undefined, maps);
  return deleted;
}

export async function verifierStage(ctx: StageContext): Promise<StageResult> {
  const { threats, context, persist, identifierInputs } =
    ctx.inputs as unknown as VerifierInputs;
  if (!Array.isArray(threats))
    throw new Error("Verifier requires inputs.threats");
  if (!context)
    throw new Error("Verifier requires inputs.context for the topology check");

  await ctx.progress(10, `Verifier: gating ${threats.length} threats`);

  // Ref keys are in DB-component-id space, persisted rows carry canvas node
  // ids. Resolve both directions once per stage and hand them to the persist
  // layer; without this the gate matched no rows on any model where the two ids
  // differ, so nothing was ever deleted or flagged.
  const maps: NodeIdMaps = persist
    ? await buildNodeIdMaps(persist.threatModelId)
    : { dbIdToNodeId: new Map(), nodeIdToDbId: new Map() };

  // --- Pass 1 (loopCount = 1): the initial challenger gate. ---
  const pass = await gatePass(ctx.aiCall, context, threats);
  let loopCount = 1;
  let deleted = persist ? await applyPass(persist, pass, maps) : 0;

  const verifiedThreats = [...pass.verifiedThreats];
  const decisions = [...pass.decisions];
  const allVerdicts = new Map(pass.verdicts);
  let topologyRefutedCount = pass.topologyRefutedCount;

  // Which (component,category) pairs exceeded 40% refuted, with the
  // refuted threats that seed the "previously refuted" block for each.
  const reasonFor = (t: MicroThreat) =>
    allVerdicts.get(threatRefOf(t))?.refutationReason;
  const plan = buildRequeuePlan(
    threats,
    (t) => pass.deleteKeys.has(threatRefOf(t)),
    reasonFor,
    REQUEUE_FRACTION,
  );
  await ctx.progress(
    70,
    `Refutation: ${deleted} removed, ${plan.length} pairs to re-queue`,
  );

  // --- Pass 2 (loopCount → 2, HARD CAP): re-run refuted pairs ONCE. ---
  if (plan.length > 0 && identifierInputs) {
    const survivorRefs = new Set(pass.verifiedThreats.map(threatRefOf));
    const loop = await runRefutationLoop({
      ctx,
      context,
      identifierInputs,
      persist,
      plan,
      survivorRefs,
      gate: (newThreats) => gatePass(ctx.aiCall, context, newThreats),
      applyPass: persist ? (p) => applyPass(persist, p, maps) : async () => 0,
    });
    loopCount = 2; // a re-run happened — count it; capped here, never loops again
    verifiedThreats.push(...loop.verifiedThreats);
    decisions.push(...loop.decisions);
    deleted += loop.deleted;
    topologyRefutedCount += loop.topologyRefutedCount;
    for (const [k, v] of loop.verdicts) allVerdicts.set(k, v);
  }

  // Final record of the >40% pairs (observability — unchanged by the re-run).
  const requeueCandidates = computeRequeueCandidates(
    threats,
    (t) => pass.deleteKeys.has(threatRefOf(t)),
    REQUEUE_FRACTION,
  );

  logger.info(
    {
      deleted,
      topologyRefuted: topologyRefutedCount,
      kept: verifiedThreats.length,
      requeueCandidates: requeueCandidates.length,
      loopCount,
    },
    "Verifier challenger gate complete",
  );
  await ctx.progress(
    100,
    `Verifier: ${deleted} removed, ${verifiedThreats.length} kept (loop ${loopCount})`,
  );

  return {
    outputs: {
      verdicts: [...allVerdicts.values()],
      verifiedThreats,
      // The refuted threats (with reasons) so discovery rounds can carry
      // them into the "do not re-propose" block.
      refutedThreats: threats
        .filter((t) => pass.deleteKeys.has(threatRefOf(t)))
        .map((t) => ({ threat: t, reason: reasonFor(t) })),
      decisions,
      deletedCount: deleted,
      topologyRefutedCount,
      requeueCandidates,
      loopCount,
      parseFailures: [],
    },
    tokensUsed: 0,
    parseFailures: [],
  };
}
