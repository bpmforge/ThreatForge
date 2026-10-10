/**
 * Duplicate guard — the detect → merge → verify loop run on a finished threat
 * set, right before it is persisted. Both SUGGEST_THREATS tails call it at the
 * same position (after the mitigation pass, before persistAIThreats): the
 * unified v2 path through floorAndMitigateV2Final, the legacy micro path in
 * runMicroAnalysis. Running it after the mitigation pass is deliberate — any
 * change to the set before that pass changes the mitigation prompts, and the
 * replay journal (and the LLM's cache) keys on those prompts.
 *
 * Per round:
 *   1. detect over the whole set (duplicate-detector.ts)
 *   2. merge-band pairs merge deterministically: the more specific, better
 *      evidenced threat survives and absorbs the other's CWEs, OWASP ids,
 *      CVEs and mitigations; a template never survives over a real finding
 *   3. same-target review-band pairs above LLM_ACCEPT_FLOOR go to the
 *      existing LLM dedup prompt (clusterViaLLM). A merge the LLM proposes is
 *      applied only when the detector score clears the floor — the LLM
 *      proposes, the detector verifies. Any LLM failure just ends asking.
 * until a round merges nothing or MAX_ROUNDS. Pairs still in the review band
 * are recorded on the threats (evidence.possibleDuplicates) and in the job
 * result; nothing is ever deleted here — a merged loser is dropped from the
 * set to persist, and the persist step links its already-streamed row to the
 * survivor (markDedupLosers).
 */
import type { AICallFn, MicroThreat } from "../micro-analysis/types.js";
import { clusterViaLLM } from "../micro-analysis/llm-dedup.js";
import {
  detectDuplicates,
  duplicateRate,
  type DetectorThreat,
  type DuplicatePair,
} from "./duplicate-detector.js";
import {
  dedupeMitigationTexts,
  groupSharedControls,
  type SharedControlGroup,
} from "./mitigation-detector.js";
import logger from "../../../utils/logger.js";

const MAX_ROUNDS = 3;
/**
 * An LLM-proposed merge is accepted only at/above this detector score. On the
 * seed-08 labels no labelled-distinct pair scores ≥ 0.40 on names, while two
 * labelled duplicates do (duplicate-calibration.test.ts).
 */
export const LLM_ACCEPT_FLOOR = 0.4;
/** Largest group sent to the LLM in one call (matches llm-dedup's cap). */
const MAX_LLM_GROUP = 25;
/** Cap on review pairs written into one threat's evidence. */
const MAX_POSSIBLE_DUPLICATES_PER_THREAT = 5;
/** Cap on review pairs listed in the job result. */
const MAX_REPORTED_PAIRS = 100;

/** Template sources: fixed-confidence boilerplate, never a merge survivor over a real finding. */
const TEMPLATE_SOURCES = new Set(["ml_threat", "supply_chain"]);

const SEVERITY_RANK: Record<MicroThreat["severity"], number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

interface ThreatRef {
  componentId: string;
  name: string;
}

export interface GuardMerge {
  survivor: ThreatRef;
  loser: ThreatRef;
  score: number;
  via: "detector" | "llm";
  reasons: string[];
}

interface GuardReviewPair {
  a: ThreatRef;
  b: ThreatRef;
  score: number;
  reasons: string[];
}

export interface DuplicateGuardMetrics {
  threatsIn: number;
  merged: number;
  reviewPairs: number;
  /** Detector duplicate rate (merge + review bands) before / after the guard. */
  duplicateRateBefore: number;
  duplicateRateAfter: number;
  mitigationGroups: number;
  droppedDuplicateMitigations: number;
  rounds: number;
  llmCalls: number;
  /** Filled by the persist step (0 when nothing was persisted). */
  linkedToExisting?: number;
  unconfirmedDedupLosers?: number;
}

export interface DuplicateGuardReport {
  merges: GuardMerge[];
  reviewPairs: GuardReviewPair[];
  mitigationGroups: Array<{ control: string; threats: ThreatRef[] }>;
  linkedToExisting?: Array<{ threat: ThreatRef; existingThreatId: string }>;
  unconfirmedDedupLosers?: Array<{ threatId: string; name: string }>;
}

export interface DuplicateGuardResult {
  threats: MicroThreat[];
  merges: GuardMerge[];
  reviewPairs: GuardReviewPair[];
  /** Shared controls, threat keys resolved to the surviving threats. */
  controlGroups: Array<SharedControlGroup & { threats: MicroThreat[] }>;
  metrics: DuplicateGuardMetrics;
}

const refOf = (t: MicroThreat): ThreatRef => ({
  componentId: t.componentId,
  name: t.name,
});

function toDetectorThreat(t: MicroThreat, id: string): DetectorThreat {
  return {
    id,
    name: t.name,
    description: t.description,
    targetId: t.componentId || "__compound__",
    targetName: t.componentName,
    categories: [t.category],
    cweIds: [...t.cweIds, ...(t.evidence.cwe ? [t.evidence.cwe] : [])],
    mitigations: (t.mitigations ?? []).map((m) => m.description),
    source: "ai",
  };
}

/**
 * Higher = more specific / better evidenced. A template always loses to a
 * real finding; after that CWEs, an attack path, description detail,
 * mitigations, then confidence decide.
 */
function specificity(t: MicroThreat): number[] {
  return [
    TEMPLATE_SOURCES.has(t.sourceMethodology) ? 0 : 1,
    new Set(t.cweIds).size,
    t.evidence.attackPath ? 1 : 0,
    Math.min(t.description?.length ?? 0, 2000),
    t.mitigations?.length ?? 0,
    t.confidence ?? 0,
  ];
}

function moreSpecific(a: MicroThreat, b: MicroThreat): boolean {
  const sa = specificity(a);
  const sb = specificity(b);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return sa[i] > sb[i];
  }
  return true; // tie → keep the earlier one (caller passes it as `a`)
}

const union = (a: string[] = [], b: string[] = []) => [
  ...new Set([...a, ...b]),
];

/** Fold `loser` into `survivor` (returns a new survivor object). */
function absorb(
  survivor: MicroThreat,
  loser: MicroThreat,
  score: number,
): MicroThreat {
  const mitigations = [
    ...(survivor.mitigations ?? []),
    ...(loser.mitigations ?? []),
  ];
  const { keptIndices } = dedupeMitigationTexts(
    mitigations.map((m) => m.description),
  );
  return {
    ...survivor,
    severity:
      SEVERITY_RANK[loser.severity] > SEVERITY_RANK[survivor.severity]
        ? loser.severity
        : survivor.severity,
    confidence: Math.max(survivor.confidence ?? 0, loser.confidence ?? 0),
    cweIds: union(survivor.cweIds, loser.cweIds),
    owaspIds: union(survivor.owaspIds, loser.owaspIds),
    ...(survivor.cveIds || loser.cveIds
      ? { cveIds: union(survivor.cveIds, loser.cveIds) }
      : {}),
    mitigations: keptIndices.map((i) => mitigations[i]),
    evidence: {
      ...survivor.evidence,
      attackPath: survivor.evidence.attackPath ?? loser.evidence.attackPath,
      mergedDuplicates: [
        ...(survivor.evidence.mergedDuplicates ?? []),
        { name: loser.name, category: loser.category, score },
        ...(loser.evidence.mergedDuplicates ?? []),
      ],
    },
  };
}

/** Connected components of a pair graph, as sorted index lists. */
function components(pairs: Array<[number, number]>): number[][] {
  const adj = new Map<number, number[]>();
  for (const [a, b] of pairs) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const start of [...adj.keys()].sort((x, y) => x - y)) {
    if (seen.has(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const n = stack.pop() as number;
      comp.push(n);
      for (const m of adj.get(n) ?? []) {
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    out.push(comp.sort((x, y) => x - y));
  }
  return out;
}

export async function runDuplicateGuard(
  input: MicroThreat[],
  options: {
    /** Existing LLM dedup caller; omit to run detector-only. */
    aiCall?: AICallFn;
    report?: (phase: string, detail: string) => void;
  } = {},
): Promise<DuplicateGuardResult> {
  const report = options.report ?? (() => {});
  // Index-keyed working set; null = merged away.
  const slots: Array<MicroThreat | null> = input.map((t) => ({ ...t }));
  const detect = () =>
    detectDuplicates(
      slots.flatMap((t, i) => (t ? [toDetectorThreat(t, String(i))] : [])),
    );

  const initialPairs = detect();
  const duplicateRateBefore = duplicateRate(input.length, initialPairs, [
    "merge",
    "review",
  ]);

  const merges: GuardMerge[] = [];
  const asked = new Set<string>();
  let llmCalls = 0;
  let llmAvailable = !!options.aiCall;
  let rounds = 0;
  let pairs = initialPairs;

  const merge = (p: DuplicatePair, via: GuardMerge["via"]): boolean => {
    const ia = Number(p.a);
    const ib = Number(p.b);
    const a = slots[ia];
    const b = slots[ib];
    if (!a || !b) return false;
    const [si, li] = moreSpecific(a, b) ? [ia, ib] : [ib, ia];
    const survivor = slots[si] as MicroThreat;
    const loser = slots[li] as MicroThreat;
    merges.push({
      survivor: refOf(survivor),
      loser: refOf(loser),
      score: p.score,
      via,
      reasons: p.reasons,
    });
    slots[si] = absorb(survivor, loser, p.score);
    slots[li] = null;
    return true;
  };

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    rounds = round;
    let mergedThisRound = 0;

    for (const p of pairs) {
      if (p.band === "merge" && merge(p, "detector")) mergedThisRound++;
    }

    // Review pairs the LLM may adjudicate: same target, above the floor,
    // both members still present, never asked before.
    const candidates = pairs.filter(
      (p) =>
        p.band === "review" &&
        p.score >= LLM_ACCEPT_FLOOR &&
        !p.reasons.includes("different-target") &&
        slots[Number(p.a)] &&
        slots[Number(p.b)] &&
        !asked.has(`${p.a}|${p.b}`),
    );
    if (options.aiCall && llmAvailable && candidates.length > 0) {
      const byKey = new Map(candidates.map((p) => [`${p.a}|${p.b}`, p]));
      for (const p of candidates) asked.add(`${p.a}|${p.b}`);
      const groups = components(
        candidates.map((p) => [Number(p.a), Number(p.b)] as [number, number]),
      );
      for (const group of groups) {
        if (!llmAvailable) break;
        const members = group.slice(0, MAX_LLM_GROUP);
        let clusters: number[][];
        // One LLM call per group; the first failure stops the loop (break
        // below), so this is not a retry-in-loop.
        // nosemgrep: bpm-slop-try-catch-in-loop
        try {
          llmCalls++;
          clusters = await clusterViaLLM(
            options.aiCall,
            members.map((i) => slots[i] as MicroThreat),
          );
        } catch (err) {
          // Non-load-bearing, like llm-dedup: stop asking, keep the pairs
          // as review pairs.
          logger.warn(
            { err },
            "Duplicate guard — LLM adjudication failed; review pairs kept",
          );
          llmAvailable = false;
          break;
        }
        for (const cluster of clusters) {
          const ids = cluster.map((k) => members[k]).sort((x, y) => x - y);
          for (let x = 0; x < ids.length; x++) {
            for (let y = x + 1; y < ids.length; y++) {
              const p =
                byKey.get(`${ids[x]}|${ids[y]}`) ??
                byKey.get(`${ids[y]}|${ids[x]}`);
              // Detector verifies: only a scored review pair above the floor.
              if (p && p.score >= LLM_ACCEPT_FLOOR && merge(p, "llm"))
                mergedThisRound++;
            }
          }
        }
      }
    }

    pairs = detect();
    if (mergedThisRound === 0) break;
  }

  // --- Record what is left in the review band ---
  const out = slots.filter((t): t is MicroThreat => t !== null);
  const reviewPairs: GuardReviewPair[] = [];
  const possible = new Map<
    number,
    NonNullable<MicroThreat["evidence"]["possibleDuplicates"]>
  >();
  for (const p of pairs) {
    if (p.band === "distinct") continue;
    const ia = Number(p.a);
    const ib = Number(p.b);
    const a = slots[ia] as MicroThreat;
    const b = slots[ib] as MicroThreat;
    reviewPairs.push({
      a: refOf(a),
      b: refOf(b),
      score: p.score,
      reasons: p.reasons,
    });
    for (const [self, other] of [
      [ia, b],
      [ib, a],
    ] as Array<[number, MicroThreat]>) {
      const list = possible.get(self) ?? [];
      if (list.length < MAX_POSSIBLE_DUPLICATES_PER_THREAT) {
        list.push({
          name: other.name,
          componentId: other.componentId,
          score: p.score,
        });
        possible.set(self, list);
      }
    }
  }
  for (const [i, list] of possible) {
    const t = slots[i] as MicroThreat;
    slots[i] = { ...t, evidence: { ...t.evidence, possibleDuplicates: list } };
  }

  // --- Mitigations: drop restatements within a threat, group shared controls ---
  let droppedDuplicateMitigations = 0;
  for (let i = 0; i < slots.length; i++) {
    const t = slots[i];
    if (!t?.mitigations?.length) continue;
    const { keptIndices, dropped } = dedupeMitigationTexts(
      t.mitigations.map((m) => m.description),
    );
    if (dropped > 0) {
      droppedDuplicateMitigations += dropped;
      slots[i] = {
        ...t,
        mitigations: keptIndices.map((k) => t.mitigations[k]),
      };
    }
  }
  const finalThreats = slots.filter((t): t is MicroThreat => t !== null);
  const groups = groupSharedControls(
    slots.flatMap((t, i) =>
      t
        ? [
            {
              key: String(i),
              targetId: t.componentId || "__compound__",
              mitigations: (t.mitigations ?? []).map((m) => m.description),
            },
          ]
        : [],
    ),
  );
  const controlGroups = groups.map((g) => ({
    ...g,
    threats: g.threatKeys.map((k) => slots[Number(k)] as MicroThreat),
  }));

  const metrics: DuplicateGuardMetrics = {
    threatsIn: input.length,
    merged: merges.length,
    reviewPairs: reviewPairs.length,
    duplicateRateBefore: round4(duplicateRateBefore),
    duplicateRateAfter: round4(
      duplicateRate(out.length, pairs, ["merge", "review"]),
    ),
    mitigationGroups: controlGroups.length,
    droppedDuplicateMitigations,
    rounds,
    llmCalls,
  };
  report(
    "dedup",
    `Duplicate guard: merged ${merges.length}, ${reviewPairs.length} pairs left for review, ${controlGroups.length} shared controls`,
  );
  return {
    threats: finalThreats,
    merges,
    reviewPairs,
    controlGroups,
    metrics,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Job-result shape (capped lists) for AiJob.result. */
function toGuardReport(r: DuplicateGuardResult): DuplicateGuardReport {
  return {
    merges: r.merges,
    reviewPairs: r.reviewPairs.slice(0, MAX_REPORTED_PAIRS),
    mitigationGroups: r.controlGroups.map((g) => ({
      control: g.control,
      threats: g.threats.map(refOf),
    })),
  };
}

/**
 * Summary counters + job-result detail for one run, folding in what the
 * persist step learned (threats linked to existing rows, LLM-dedup losers
 * the detector would not confirm). Both SUGGEST_THREATS tails call this.
 */
export function guardOutcome(
  guard: DuplicateGuardResult,
  persisted: {
    linked?: Array<{
      name: string;
      componentNodeId: string | null;
      existingThreatId: string;
    }>;
    unconfirmed?: Array<{ threatId: string; name: string }>;
  } = {},
): { metrics: DuplicateGuardMetrics; report?: DuplicateGuardReport } {
  const linked = persisted.linked ?? [];
  const unconfirmed = persisted.unconfirmed ?? [];
  const empty =
    guard.merges.length === 0 &&
    guard.reviewPairs.length === 0 &&
    guard.controlGroups.length === 0 &&
    linked.length === 0 &&
    unconfirmed.length === 0;
  return {
    metrics: {
      ...guard.metrics,
      linkedToExisting: linked.length,
      unconfirmedDedupLosers: unconfirmed.length,
    },
    report: empty
      ? undefined
      : {
          ...toGuardReport(guard),
          ...(linked.length
            ? {
                linkedToExisting: linked.map((l) => ({
                  threat: {
                    componentId: l.componentNodeId ?? "",
                    name: l.name,
                  },
                  existingThreatId: l.existingThreatId,
                })),
              }
            : {}),
          ...(unconfirmed.length
            ? { unconfirmedDedupLosers: unconfirmed }
            : {}),
        },
  };
}
