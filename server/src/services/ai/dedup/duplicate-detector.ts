/**
 * Mechanical duplicate detector — PURE, deterministic, no LLM.
 *
 * Scores threat pairs over the WHOLE model set (not per component, which is
 * the blind spot of the LLM dedup pass in micro-analysis/llm-dedup.ts) and
 * sorts each pair into a band:
 *
 *   merge    — safe to collapse without asking anyone (same target only)
 *   review   — plausible duplicate; an LLM may propose a merge, a human may
 *              decide, but the detector alone will not merge it
 *   distinct — leave alone
 *
 * Abstraction rule: "if one mitigation closes both, it
 * is one threat". The class-grain feature encodes it: same target + a shared
 * CWE + the same control text lifts a pair to at least the review band even
 * when the names share few words.
 *
 * Calibration (duplicate-calibration.test.ts): the
 * thresholds below were picked to maximise precision of the MERGE band on the
 * seed-08 labelled pairs — a false merge hides a real finding, a missed
 * duplicate only costs a reviewer a click. The seed-08 labels carry names,
 * categories and targets only, so the description / CWE / mitigation weights
 * are NOT calibrated against labels; they can only add evidence on top of a
 * name match for a merge (the name floor gates the merge band).
 *
 * Cost: features are computed once per threat; candidate pairs come from
 * blocking (same target, or cross-target pairs sharing ≥ 2 informative name
 * tokens), so 500 threats score in well under a second.
 */
import { canonicalTokens } from "../../threat-review/normalize-threat-name.js";

/** score ≥ this (same target, name floor met) → merge band. */
export const MERGE_THRESHOLD = 0.62;
/** Merge additionally requires this much NAME similarity on its own. */
const MERGE_NAME_FLOOR = 0.5;
/** score ≥ this (same target) → review band. */
export const REVIEW_THRESHOLD = 0.32;
/**
 * Cross-target pairs are never merged. The same threat class on two different
 * assets is two threats (§5: "the class plus the affected asset or path"), so
 * a cross-target pair reaches review only when it is near-identical, or when
 * it is edge-shaped: each threat names the other's target, i.e. both describe
 * the one connection between them from opposite ends.
 */
const CROSS_TARGET_REVIEW_THRESHOLD = 0.85;
const EDGE_SHAPED_REVIEW_THRESHOLD = 0.45;
/** Two mitigation texts at or above this token similarity are "the same control". */
const SHARED_CONTROL_SIMILARITY = 0.6;

/** Feature weights on top of the name similarity (the calibrated core). */
const W_SAME_CATEGORY = 0.05;
const W_CWE_OVERLAP = 0.1;
const P_DISJOINT_CWE = 0.1;
const W_DESCRIPTION = 0.2;
const W_SHARED_CONTROL = 0.1;
const NAME_TOKEN_WEIGHT = 0.6;
const NAME_SHINGLE_WEIGHT = 0.4;
/** Tokens in more than this many threats are too common to block on. */
const MAX_BLOCK_DF = 60;
/** Cross-target candidates must share at least this many informative tokens. */
const CROSS_TARGET_MIN_SHARED = 2;
/**
 * Words that carry no contrast between two threat names. Any OTHER word that
 * only one name has is substantive; when EACH name has one ("at rest" vs
 * "in transit", "to PostgreSQL" vs "to RabbitMQ", "leakage" vs
 * "spoofing") the names point at different things, so the pair is never
 * auto-merged — it drops to review. Found by reading every seed merge.
 */
const NON_CONTRASTING_WORDS = new Set([
  "attack",
  "threat",
  "risk",
  "vulnerability",
  "issue",
  "potential",
  "possible",
  "exploit",
  "abuse",
  "weakness",
]);

export type DuplicateBand = "merge" | "review" | "distinct";

export interface DetectorThreat {
  id: string;
  name: string;
  description?: string | null;
  /** Component nodeId / connection edgeId / "__compound__" — the thing threatened. */
  targetId: string;
  /** Display name of the target, used to spot edge-shaped cross-target pairs. */
  targetName?: string;
  /** STRIDE (or other methodology) categories. */
  categories: string[];
  cweIds: string[];
  /** Mitigation / control texts attached to the threat. */
  mitigations: string[];
  source: "human" | "ai";
  manuallyEdited?: boolean;
}

export interface DuplicatePair {
  /** Id of the earlier threat in input order. */
  a: string;
  b: string;
  score: number;
  band: DuplicateBand;
  reasons: string[];
}

interface Features {
  t: DetectorThreat;
  index: number;
  nameTokens: Set<string>;
  subject: Set<string>;
  actor: Set<string> | null;
  shingles: Set<string>;
  descTokens: Set<string> | null;
  cwes: Set<string>;
  categories: Set<string>;
  mitigationTokens: Array<Set<string>>;
  /** Lowercased name + description, for target-name mentions. */
  text: string;
  /** Phrases that identify this threat's target when another threat mentions it. */
  targetMarkers: string[];
}

/** Target-name words too common to identify a component on their own. */
const GENERIC_TARGET_WORDS = new Set([
  "service",
  "services",
  "gateway",
  "primary",
  "cache",
  "broker",
  "portal",
  "customer",
  "email",
  "payment",
  "order",
  "billing",
  "user",
  "server",
  "client",
  "database",
  "queue",
  "external",
  "internal",
]);

function targetMarkersOf(targetName: string | undefined): string[] {
  if (!targetName?.trim()) return [];
  const phrase = targetName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const words = phrase
    .split(" ")
    .filter((w) => w.length >= 5 && !GENERIC_TARGET_WORDS.has(w));
  return [phrase, ...words];
}

function mentions(f: Features, markers: string[]): boolean {
  return markers.some((m) => f.text.includes(m));
}

/** Light suffix stemmer so "tampering"/"tamper", "tokens"/"token" meet. */
function stem(token: string): string {
  let t = token;
  if (t.length > 4 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  if (t.length > 6 && (t.endsWith("ing") || t.endsWith("ion")))
    return t.slice(0, -3);
  if (t.length > 5 && t.endsWith("ed")) return t.slice(0, -2);
  return t;
}

/**
 * Similarity tokens: the dedup key's canonical tokens (synonyms folded,
 * stopwords dropped) plus a light stemmer. Shared with mitigation-detector.
 */
export function similarityTokens(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(canonicalTokens(text).map(stem));
}

const tokenSet = similarityTokens;

function shingleSet(text: string, n = 3): Set<string> {
  const s = ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  const out = new Set<string>();
  for (let i = 0; i + n <= s.length; i++) out.add(s.slice(i, i + n));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function weightedJaccard(
  a: Set<string>,
  b: Set<string>,
  idf: Map<string, number>,
): number {
  let inter = 0;
  let union = 0;
  for (const x of a) {
    const w = idf.get(x) ?? 1;
    union += w;
    if (b.has(x)) inter += w;
  }
  for (const x of b) if (!a.has(x)) union += idf.get(x) ?? 1;
  return union === 0 ? 0 : inter / union;
}

function normalizeCwe(id: string): string {
  const m = /(\d+)/.exec(id);
  return m ? `CWE-${Number(m[1])}` : id.toUpperCase();
}

function featuresOf(t: DetectorThreat, index: number): Features {
  // Keep "A by B" directional — split exactly as normalizeThreatName does.
  const [subjectText, ...actorParts] = t.name.split(/\bby\b/i);
  const actorText = actorParts.join(" ");
  const hasActor =
    actorParts.length > 0 && subjectText.trim() && actorText.trim();
  return {
    t,
    index,
    nameTokens: tokenSet(t.name),
    subject: tokenSet(hasActor ? subjectText : t.name),
    actor: hasActor ? tokenSet(actorText) : null,
    shingles: shingleSet(t.name),
    descTokens: t.description?.trim() ? tokenSet(t.description) : null,
    cwes: new Set(t.cweIds.map(normalizeCwe)),
    categories: new Set(t.categories.map((c) => c.toUpperCase())),
    mitigationTokens: t.mitigations
      .filter((m) => m && m.trim())
      .map((m) => tokenSet(m)),
    text: ` ${`${t.name} ${t.description ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `,
    targetMarkers: targetMarkersOf(t.targetName),
  };
}

/** True when both names are "X by Y" and the roles are swapped. */
function actorDirectionSwapped(x: Features, y: Features): boolean {
  if (!x.actor || !y.actor) return false;
  const straight = jaccard(x.subject, y.subject) + jaccard(x.actor, y.actor);
  const crossed = jaccard(x.subject, y.actor) + jaccard(x.actor, y.subject);
  return crossed > straight;
}

/** True when each name has a substantive word the other lacks. */
function contrastingNames(x: Features, y: Features): boolean {
  const only = (a: Set<string>, b: Set<string>) =>
    [...a].some((t) => !b.has(t) && !NON_CONTRASTING_WORDS.has(t));
  return only(x.nameTokens, y.nameTokens) && only(y.nameTokens, x.nameTokens);
}

function maxMitigationSimilarity(x: Features, y: Features): number {
  let best = 0;
  for (const a of x.mitigationTokens) {
    for (const b of y.mitigationTokens) {
      const s = jaccard(a, b);
      if (s > best) best = s;
    }
  }
  return best;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function scorePair(
  x: Features,
  y: Features,
  idf: Map<string, number>,
): DuplicatePair {
  const reasons: string[] = [];
  const sameTarget = x.t.targetId === y.t.targetId;
  if (!sameTarget) reasons.push("different-target");

  const nameSim =
    NAME_TOKEN_WEIGHT * weightedJaccard(x.nameTokens, y.nameTokens, idf) +
    NAME_SHINGLE_WEIGHT * jaccard(x.shingles, y.shingles);
  reasons.push(`name:${round3(nameSim)}`);
  let score = nameSim;

  let sameCategory = false;
  for (const c of x.categories) if (y.categories.has(c)) sameCategory = true;
  if (sameCategory) {
    score += W_SAME_CATEGORY;
    reasons.push("same-category");
  }

  let cweShared = false;
  if (x.cwes.size > 0 && y.cwes.size > 0) {
    let inter = 0;
    for (const c of x.cwes) if (y.cwes.has(c)) inter++;
    if (inter > 0) {
      cweShared = true;
      score += W_CWE_OVERLAP * (inter / Math.min(x.cwes.size, y.cwes.size));
      reasons.push("cwe-overlap");
    } else {
      score -= P_DISJOINT_CWE;
      reasons.push("disjoint-cwe");
    }
  }

  if (x.descTokens && y.descTokens) {
    const d = jaccard(x.descTokens, y.descTokens);
    score += W_DESCRIPTION * d;
    reasons.push(`description:${round3(d)}`);
  }

  const mitSim = maxMitigationSimilarity(x, y);
  const sharedControl = mitSim >= SHARED_CONTROL_SIMILARITY;
  if (sharedControl) {
    score += W_SHARED_CONTROL;
    reasons.push("shared-control");
  }

  score = Math.max(0, Math.min(1, score));

  // §5 class-grain rule: one control closes both → at least a review pair.
  if (sameTarget && cweShared && sharedControl) {
    reasons.push("class-grain:same-cwe+same-control");
    score = Math.max(score, REVIEW_THRESHOLD);
  }

  const contrast = contrastingNames(x, y);
  if (contrast) reasons.push("contrasting-terms");

  let band: DuplicateBand;
  if (actorDirectionSwapped(x, y)) {
    reasons.push("actor-direction-differs");
    band = "distinct";
  } else if (!sameTarget) {
    const edgeShaped =
      mentions(x, y.targetMarkers) && mentions(y, x.targetMarkers);
    if (edgeShaped) reasons.push("edge-shaped");
    band =
      score >= CROSS_TARGET_REVIEW_THRESHOLD ||
      (edgeShaped && score >= EDGE_SHAPED_REVIEW_THRESHOLD)
        ? "review"
        : "distinct";
  } else if (
    score >= MERGE_THRESHOLD &&
    nameSim >= MERGE_NAME_FLOOR &&
    !contrast
  ) {
    band = "merge";
  } else if (score >= REVIEW_THRESHOLD) {
    band = "review";
  } else {
    band = "distinct";
  }

  return { a: x.t.id, b: y.t.id, score: round3(score), band, reasons };
}

/**
 * Score candidate pairs across the whole set. Returns non-distinct pairs by
 * default, sorted by score (desc) then input order; `includeDistinct` returns
 * every scored candidate (calibration).
 */
export function detectDuplicates(
  threats: DetectorThreat[],
  options: { includeDistinct?: boolean } = {},
): DuplicatePair[] {
  const feats = threats.map(featuresOf);

  // IDF over name tokens: rare words ("jwt", "webhook") carry the match,
  // common ones ("missing", "data") barely count.
  const df = new Map<string, number>();
  for (const f of feats)
    for (const tok of f.nameTokens) df.set(tok, (df.get(tok) ?? 0) + 1);
  const n = Math.max(feats.length, 1);
  const idf = new Map<string, number>();
  for (const [tok, d] of df) idf.set(tok, Math.log(1 + n / d));

  // --- Blocking ---
  const candidates = new Set<number>(); // encoded i * N + j, i < j
  const N = feats.length;
  const encode = (i: number, j: number) => (i < j ? i * N + j : j * N + i);

  const byTarget = new Map<string, number[]>();
  for (const f of feats) {
    const list = byTarget.get(f.t.targetId);
    if (list) list.push(f.index);
    else byTarget.set(f.t.targetId, [f.index]);
  }
  for (const members of byTarget.values()) {
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++)
        candidates.add(encode(members[i], members[j]));
  }

  const postings = new Map<string, number[]>();
  for (const f of feats) {
    for (const tok of f.nameTokens) {
      if ((df.get(tok) ?? 0) > MAX_BLOCK_DF) continue;
      const list = postings.get(tok);
      if (list) list.push(f.index);
      else postings.set(tok, [f.index]);
    }
  }
  const shared = new Map<number, number>();
  for (const list of postings.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = feats[list[i]];
        const b = feats[list[j]];
        if (a.t.targetId === b.t.targetId) continue;
        const key = encode(a.index, b.index);
        shared.set(key, (shared.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, count] of shared) {
    if (count >= CROSS_TARGET_MIN_SHARED) candidates.add(key);
  }

  // --- Scoring ---
  const pairs: Array<DuplicatePair & { ia: number; ib: number }> = [];
  for (const key of candidates) {
    const i = Math.floor(key / N);
    const j = key % N;
    const p = scorePair(feats[i], feats[j], idf);
    if (p.band === "distinct" && !options.includeDistinct) continue;
    pairs.push({ ...p, ia: i, ib: j });
  }
  pairs.sort((p, q) => q.score - p.score || p.ia - q.ia || p.ib - q.ib);
  return pairs.map(({ ia: _ia, ib: _ib, ...p }) => p);
}

/**
 * Best merge-band match for `threat` among `candidates`, scored exactly as
 * detectDuplicates scores the combined set, or null when none reaches the
 * merge band. Used to stop a re-analysis re-creating an existing threat.
 */
export function findMergeMatch(
  threat: DetectorThreat,
  candidates: DetectorThreat[],
): DuplicatePair | null {
  if (candidates.length === 0) return null;
  return (
    detectDuplicates([threat, ...candidates]).find(
      (p) => p.band === "merge" && (p.a === threat.id || p.b === threat.id),
    ) ?? null
  );
}

/**
 * Share of the set that is surplus duplicates: within each connected cluster
 * of pairs in `bands`, every member beyond the first counts once. 0 for an
 * empty set.
 */
export function duplicateRate(
  total: number,
  pairs: DuplicatePair[],
  bands: DuplicateBand[],
): number {
  if (total === 0) return 0;
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    for (
      let next = parent.get(r);
      next !== undefined && next !== r;
      next = parent.get(r)
    )
      r = next;
    parent.set(x, r);
    return r;
  };
  let surplus = 0;
  for (const p of pairs) {
    if (!bands.includes(p.band)) continue;
    if (!parent.has(p.a)) parent.set(p.a, p.a);
    if (!parent.has(p.b)) parent.set(p.b, p.b);
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) {
      parent.set(rb, ra);
      surplus++;
    }
  }
  return surplus / total;
}
