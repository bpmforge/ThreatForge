/**
 * Duplicate-detector calibration against labelled fixtures.
 *
 * Label files (go-forward/threat-labels.json, labels/*.labels.json) mark a
 * threat DUPLICATE with `duplicateOf` pointing at the entry it repeats. Those
 * pointers define positive pairs (closed transitively: two threats that are
 * both duplicates of the same original are duplicates of each other). Every
 * other pair of labelled threats on the same component is a negative.
 *
 * The label files carry name / category / componentId only — no
 * descriptions, CWEs or mitigations — so this measures the NAME + TARGET +
 * CATEGORY part of the detector and nothing else.
 */
import { readFileSync } from "node:fs";
import { LLM_ACCEPT_FLOOR } from "../../services/ai/dedup/duplicate-guard.js";
import {
  detectDuplicates,
  findMergeMatch,
  type DetectorThreat,
  type DuplicateBand,
} from "../../services/ai/dedup/duplicate-detector.js";

interface LabelEntry {
  key: string;
  name: string;
  category: string;
  componentId?: string;
  verdict: "TRUE_POSITIVE" | "FALSE_POSITIVE" | "DUPLICATE" | null;
  duplicateOf?: string | null;
}

interface BandStats {
  /** pairs the detector put in the band(s) */
  predicted: number;
  truePositive: number;
  precision: number;
  recall: number;
}

export interface CalibrationReport {
  file: string;
  threats: number;
  positivePairs: number;
  negativePairs: number;
  merge: BandStats;
  mergeOrReview: BandStats;
  /** Labelled-distinct pairs the detector would auto-merge (false merges). */
  falseMerges: Array<{ a: string; b: string; score: number }>;
  /** Labelled duplicates the detector missed entirely (distinct band). */
  missed: Array<{ a: string; b: string; score: number }>;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\n${b}` : `${b}\n${a}`);

function loadLabels(path: string): LabelEntry[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    threats: LabelEntry[];
  };
  return raw.threats;
}

/**
 * @param targetNames componentId → display name (from the fixture model), so
 *   the edge-shaped cross-target feature sees the same names it sees in prod.
 */
export function calibrate(
  path: string,
  targetNames: Map<string, string> = new Map(),
): CalibrationReport {
  const labels = loadLabels(path).filter((l) => l.verdict !== null);
  const byKey = new Map(labels.map((l) => [l.key, l]));

  // Transitive closure via union-find over duplicateOf pointers.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    for (
      let next = parent.get(x);
      next !== undefined && next !== x;
      next = parent.get(x)
    )
      x = next;
    return x;
  };
  for (const l of labels) parent.set(l.key, l.key);
  for (const l of labels) {
    if (
      l.verdict === "DUPLICATE" &&
      l.duplicateOf &&
      byKey.has(l.duplicateOf)
    ) {
      parent.set(find(l.key), find(l.duplicateOf));
    }
  }

  const threats: DetectorThreat[] = labels.map((l) => ({
    id: l.key,
    name: l.name,
    targetId: l.componentId ?? "__compound__",
    targetName: l.componentId ? targetNames.get(l.componentId) : undefined,
    categories: [l.category],
    cweIds: [],
    mitigations: [],
    source: "ai",
  }));
  const scored = detectDuplicates(threats, { includeDistinct: true });
  const bandOf = new Map<string, { band: DuplicateBand; score: number }>();
  for (const p of scored) bandOf.set(pairKey(p.a, p.b), p);

  let positivePairs = 0;
  let negativePairs = 0;
  const missed: CalibrationReport["missed"] = [];
  const falseMerges: CalibrationReport["falseMerges"] = [];
  const merge = { predicted: 0, truePositive: 0 };
  const mor = { predicted: 0, truePositive: 0 };

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i];
      const b = labels[j];
      const sameTarget = (a.componentId ?? "") === (b.componentId ?? "");
      const isDup = find(a.key) === find(b.key);
      const scoredPair = bandOf.get(pairKey(a.key, b.key));
      const band = scoredPair?.band ?? "distinct";
      const score = scoredPair?.score ?? 0;
      if (!sameTarget && !isDup && band === "distinct") continue;
      if (isDup) positivePairs++;
      else if (sameTarget) negativePairs++;
      if (band === "merge") {
        merge.predicted++;
        if (isDup) merge.truePositive++;
        else falseMerges.push({ a: a.name, b: b.name, score });
      }
      if (band !== "distinct") {
        mor.predicted++;
        if (isDup) mor.truePositive++;
      } else if (isDup) {
        missed.push({ a: a.name, b: b.name, score });
      }
    }
  }

  const stats = (s: {
    predicted: number;
    truePositive: number;
  }): BandStats => ({
    ...s,
    precision: s.predicted === 0 ? 1 : s.truePositive / s.predicted,
    recall: positivePairs === 0 ? 0 : s.truePositive / positivePairs,
  });

  return {
    file: path.split("/").pop() ?? path,
    threats: labels.length,
    positivePairs,
    negativePairs,
    merge: stats(merge),
    mergeOrReview: stats(mor),
    falseMerges,
    missed,
  };
}

/**
 * Score each labelled threat the way the PERSIST step does: one threat against
 * only the other rows on its component (so IDF comes from that small set).
 * - link: findMergeMatch (persistAIThreats re-analysis linking)
 * - loser: best pair at/above LLM_ACCEPT_FLOOR (markDedupLosers confirmation)
 * Returns the matches that contradict the labels.
 */
export function calibratePersistContext(path: string): {
  falseLinks: string[];
  falseLoserConfirmations: string[];
} {
  const labels = loadLabels(path).filter((l) => l.verdict !== null);
  const byKey = new Map(labels.map((l) => [l.key, l]));
  const parent = new Map<string, string>(labels.map((l) => [l.key, l.key]));
  const find = (x: string): string => {
    for (
      let next = parent.get(x);
      next !== undefined && next !== x;
      next = parent.get(x)
    )
      x = next;
    return x;
  };
  for (const l of labels) {
    if (l.verdict === "DUPLICATE" && l.duplicateOf && byKey.has(l.duplicateOf))
      parent.set(find(l.key), find(l.duplicateOf));
  }
  const toDetector = (l: LabelEntry): DetectorThreat => ({
    id: l.key,
    name: l.name,
    targetId: l.componentId ?? "__compound__",
    categories: [l.category],
    cweIds: [],
    mitigations: [],
    source: "ai",
  });
  const falseLinks: string[] = [];
  const falseLoserConfirmations: string[] = [];
  for (const l of labels) {
    const others = labels
      .filter((o) => o !== l && o.componentId === l.componentId)
      .map(toDetector);
    const other = (p: { a: string; b: string }) => (p.a === l.key ? p.b : p.a);
    const link = findMergeMatch(toDetector(l), others);
    if (link && find(other(link)) !== find(l.key))
      falseLinks.push(`${l.name} <> ${byKey.get(other(link))?.name}`);
    const best = detectDuplicates([toDetector(l), ...others], {
      includeDistinct: true,
    }).find(
      (p) =>
        (p.a === l.key || p.b === l.key) &&
        !p.reasons.includes("actor-direction-differs"),
    );
    if (
      best &&
      best.score >= LLM_ACCEPT_FLOOR &&
      find(other(best)) !== find(l.key)
    )
      falseLoserConfirmations.push(
        `${l.name} <> ${byKey.get(other(best))?.name}`,
      );
  }
  return { falseLinks, falseLoserConfirmations };
}
