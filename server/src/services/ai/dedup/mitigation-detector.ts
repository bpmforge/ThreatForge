/**
 * Mechanical mitigation duplicate detector — PURE, deterministic, no LLM.
 *
 * Two jobs:
 * 1. Within one threat: drop a mitigation that restates one already listed
 *    (the mitigation pass sometimes returns the same control twice).
 * 2. Across threats: find one control that several threats share and
 *    propose a single grouping. The persist step turns each group into an
 *    ArchitecturalMitigation row whose `threatIds` lists every threat it
 *    closes — the per-threat Mitigation rows stay as they are (the schema
 *    has one threatId per Mitigation, and human edits live on those rows).
 */
import { similarityTokens } from "./duplicate-detector.js";

/** Two mitigations of ONE threat at/above this similarity are the same control. */
const WITHIN_THREAT_DUPLICATE_SIMILARITY = 0.75;
/** Two mitigations of DIFFERENT threats at/above this are one shared control. */
const SHARED_CONTROL_GROUP_SIMILARITY = 0.7;
/** At most this many shared-control groups are proposed per run. */
export const MAX_CONTROL_GROUPS = 10;
/** Tokens in more than this many mitigations are too common to block on. */
const MAX_BLOCK_DF = 80;
/** Candidate pairs must share at least this many informative tokens. */
const MIN_SHARED_TOKENS = 3;

const tokens = similarityTokens;

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Indices of the mitigations to keep for one threat (first occurrence of each
 * control wins) and how many restatements were dropped.
 */
export function dedupeMitigationTexts(texts: string[]): {
  keptIndices: number[];
  dropped: number;
} {
  const kept: Array<{ index: number; toks: Set<string> }> = [];
  for (let i = 0; i < texts.length; i++) {
    const toks = tokens(texts[i] ?? "");
    const repeat = kept.some(
      (k) =>
        (toks.size === 0 && k.toks.size === 0) ||
        jaccard(k.toks, toks) >= WITHIN_THREAT_DUPLICATE_SIMILARITY,
    );
    if (!repeat) kept.push({ index: i, toks });
  }
  return {
    keptIndices: kept.map((k) => k.index),
    dropped: texts.length - kept.length,
  };
}

export interface ControlThreat {
  /** Caller-chosen stable key for the threat (resolved to a DB id at persist). */
  key: string;
  targetId: string;
  mitigations: string[];
}

export interface SharedControlGroup {
  /** Representative control text (shortest member — usually the cleanest). */
  control: string;
  threatKeys: string[];
  targetIds: string[];
  /** Lowest pairwise similarity that joined this group (evidence strength). */
  minSimilarity: number;
}

/** Group threats that share one control. Largest groups first, capped. */
export function groupSharedControls(
  threats: ControlThreat[],
): SharedControlGroup[] {
  interface Item {
    threat: number;
    text: string;
    toks: Set<string>;
  }
  const items: Item[] = [];
  threats.forEach((t, threat) => {
    for (const text of t.mitigations) {
      if (text?.trim()) items.push({ threat, text, toks: tokens(text) });
    }
  });

  const df = new Map<string, number>();
  for (const it of items)
    for (const tok of it.toks) df.set(tok, (df.get(tok) ?? 0) + 1);
  const postings = new Map<string, number[]>();
  items.forEach((it, i) => {
    for (const tok of it.toks) {
      if ((df.get(tok) ?? 0) > MAX_BLOCK_DF) continue;
      const list = postings.get(tok);
      if (list) list.push(i);
      else postings.set(tok, [i]);
    }
  });
  const shared = new Map<number, number>();
  const N = items.length;
  for (const list of postings.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        if (items[list[x]].threat === items[list[y]].threat) continue;
        const key = list[x] * N + list[y];
        shared.set(key, (shared.get(key) ?? 0) + 1);
      }
    }
  }

  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const minSim = new Map<number, number>();
  const keys = [...shared.entries()]
    .filter(([, count]) => count >= MIN_SHARED_TOKENS)
    .map(([key]) => key)
    .sort((p, q) => p - q);
  for (const key of keys) {
    const i = Math.floor(key / N);
    const j = key % N;
    const sim = jaccard(items[i].toks, items[j].toks);
    if (sim < SHARED_CONTROL_GROUP_SIMILARITY) continue;
    const ri = find(i);
    const rj = find(j);
    const m = Math.min(sim, minSim.get(ri) ?? 1, minSim.get(rj) ?? 1);
    if (ri !== rj) parent[rj] = ri;
    minSim.set(find(i), m);
  }

  const clusters = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    const list = clusters.get(r);
    if (list) list.push(i);
    else clusters.set(r, [i]);
  });

  const groups: SharedControlGroup[] = [];
  for (const [root, members] of clusters) {
    const threatIdx = [...new Set(members.map((i) => items[i].threat))].sort(
      (a, b) => a - b,
    );
    if (threatIdx.length < 2) continue;
    const control = members
      .map((i) => items[i].text.trim())
      .sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
    groups.push({
      control,
      threatKeys: threatIdx.map((i) => threats[i].key),
      targetIds: [...new Set(threatIdx.map((i) => threats[i].targetId))].sort(),
      minSimilarity: Math.round((minSim.get(root) ?? 1) * 1000) / 1000,
    });
  }
  groups.sort(
    (a, b) =>
      b.threatKeys.length - a.threatKeys.length ||
      a.control.localeCompare(b.control),
  );
  return groups.slice(0, MAX_CONTROL_GROUPS);
}
