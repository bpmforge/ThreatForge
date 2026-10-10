/**
 * LLM-based semantic threat dedup pass.
 *
 * Runs after normalizeThreatName has already folded exact paraphrase
 * variants. This pass catches the harder case: threats that describe the
 * same underlying vulnerability with almost-no shared lexicon.
 *
 *   "SQL injection via unsanitized user input"
 *   "Improper parameter binding allowing database command execution"
 *
 * These share no key terms after normalization, but a human (or LLM) can
 * tell they're the same threat. We ask a local LLM to cluster paraphrases
 * and keep the highest-confidence representative per cluster.
 *
 * NON-LOAD-BEARING: if the LLM call fails, times out, or returns malformed
 * JSON, we return the input unchanged. Name-normalized threats are always
 * safe to persist. This pass only prunes; it never wipes.
 */
import type { AICallFn, MicroThreat } from "./types.js";
import { extractJsonArray } from "../response-parsers.js";
import logger from "../../../utils/logger.js";

/** Groups smaller than this are skipped — can't have duplicates. */
const MIN_GROUP_SIZE = 2;

/**
 * Upper bound on group size. Very long prompts are more likely to confuse
 * small local models and produce malformed clusters. If a component somehow
 * has >25 threats after name normalization, that's an anomaly — log and skip the group
 * rather than send a giant prompt.
 */
const MAX_GROUP_SIZE = 25;

/**
 * Collapse bound: the class-grain rule asks the model to merge variants a
 * single mitigation closes, which invites over-collapse. No cluster may absorb
 * more than this many threats; the lowest-confidence overflow members stay as
 * their own singletons rather than being silently deleted.
 */
const MAX_CLUSTER_SIZE = 5;

interface Cluster {
  /** Indices into the input threat list that belong to this cluster */
  indices: number[];
}

/**
 * Reduce an array of threats by clustering paraphrases via LLM and keeping
 * the highest-confidence representative of each cluster.
 *
 * Groups threats by component first (same-component threats are much more
 * likely to overlap than cross-component ones), runs one LLM call per
 * group, and merges results. Per-group failures fall back to the original
 * group — never lose threats to a bad LLM response.
 */
export async function dedupThreatsViaLLM(
  aiCall: AICallFn,
  threats: MicroThreat[],
  options: { onProgress?: (phase: string, detail: string) => void } = {},
): Promise<MicroThreat[]> {
  if (threats.length < MIN_GROUP_SIZE) return threats;
  const report = options.onProgress || (() => {});

  // Group by component — compound threats cluster together under the
  // '__compound__' sentinel.
  const byComponent = new Map<string, MicroThreat[]>();
  for (const t of threats) {
    const key = t.componentId || "__compound__";
    if (!byComponent.has(key)) byComponent.set(key, []);
    byComponent.get(key)!.push(t);
  }

  const output: MicroThreat[] = [];
  let totalCollapsed = 0;

  for (const [componentId, group] of byComponent) {
    if (group.length < MIN_GROUP_SIZE) {
      output.push(...group);
      continue;
    }
    if (group.length > MAX_GROUP_SIZE) {
      logger.warn(
        { componentId, size: group.length, cap: MAX_GROUP_SIZE },
        "group exceeds cap; skipping LLM dedup for this component",
      );
      output.push(...group);
      continue;
    }

    try {
      const deduped = await dedupGroup(aiCall, group);
      totalCollapsed += group.length - deduped.length;
      output.push(...deduped);
    } catch (err) {
      // Non-load-bearing: keep the original group on any failure.
      logger.warn(
        { err, componentId, size: group.length },
        "LLM dedup failed for component; keeping original set",
      );
      output.push(...group);
    }
  }

  report(
    "dedup_done",
    `Collapsed ${totalCollapsed} paraphrase-duplicate threats via LLM`,
  );
  return output;
}

/**
 * Ask the LLM to cluster a list of threats into paraphrase groups. Returns
 * the raw clusters as 0-based index lists (out-of-range / non-numeric entries
 * dropped). Throws on a reply with no usable cluster — callers fall back.
 *
 * Exported for the mechanical duplicate guard (services/ai/dedup), which asks
 * the SAME prompt about review-band pairs only and then verifies every
 * proposed merge with the detector score — the LLM proposes, the detector
 * decides.
 */
export async function clusterViaLLM(
  aiCall: AICallFn,
  group: Array<Pick<MicroThreat, "name" | "description">>,
): Promise<number[][]> {
  const numbered = group
    .map((t, i) => `${i}. ${t.name} — ${truncate(t.description, 120)}`)
    .join("\n");

  const system =
    "You are reviewing AI-generated threats for paraphrase duplicates. Your " +
    "only job is to cluster threats that describe THE SAME underlying " +
    "vulnerability, regardless of wording. Also cluster variants of one " +
    "control gap — threats that a single mitigation would close together " +
    "(e.g. the same missing control repeated per endpoint or parameter). " +
    "Do NOT cluster threats that target different assets, different attack " +
    "paths, or different impact classes, or that need different mitigations " +
    "— those stay separate. Output MUST be a JSON array of clusters.";

  const user =
    `Threats (${group.length} for one component):\n${numbered}\n\n` +
    `Return a JSON array where each element is {"indices":[...]} listing ` +
    `the 0-based indices of threats that are paraphrases of each other. ` +
    `Every index 0..${group.length - 1} must appear in exactly one cluster. ` +
    `Singletons (a threat with no duplicates) must be their own cluster.\n\n` +
    `Example: [{"indices":[0,3]},{"indices":[1]},{"indices":[2,4]}]`;

  const raw = await aiCall(system, user, "dedup");
  const parsed = extractJsonArray(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("LLM dedup: response did not parse as JSON array");
  }

  const clusters: number[][] = [];
  for (const entry of parsed) {
    if (
      entry &&
      typeof entry === "object" &&
      "indices" in entry &&
      Array.isArray((entry as { indices: unknown }).indices)
    ) {
      const indices = (entry as { indices: unknown[] }).indices
        .filter((n): n is number => typeof n === "number")
        .filter((n) => n >= 0 && n < group.length);
      if (indices.length > 0) clusters.push(indices);
    }
  }

  if (clusters.length === 0) {
    throw new Error("LLM dedup: no valid clusters parsed");
  }
  return clusters;
}

/**
 * Cluster one component's threats via a single LLM call.
 * Throws on parse failure — caller is expected to catch and fall back.
 */
async function dedupGroup(
  aiCall: AICallFn,
  group: MicroThreat[],
): Promise<MicroThreat[]> {
  const clusters: Cluster[] = (await clusterViaLLM(aiCall, group)).map(
    (indices) => ({ indices }),
  );

  // Validate coverage — every input index must appear in exactly one cluster.
  // Missing indices are re-added as singletons (don't lose threats); duplicate
  // indices take the first cluster (deterministic).
  const seen = new Set<number>();
  const canonical: MicroThreat[] = [];
  for (const cluster of clusters) {
    const members: MicroThreat[] = [];
    for (const idx of cluster.indices) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      members.push(group[idx]);
    }
    if (members.length === 0) continue;
    // Highest confidence wins. Ties broken by longest description
    // (typically the more detailed / better-cited variant).
    members.sort((a, b) => {
      const cDiff = (b.confidence ?? 0.5) - (a.confidence ?? 0.5);
      if (cDiff !== 0) return cDiff;
      return (b.description?.length ?? 0) - (a.description?.length ?? 0);
    });

    // Collapse bound: keep at most MAX_CLUSTER_SIZE per cluster; overflow
    // members survive as singletons instead of being merged away.
    if (members.length > MAX_CLUSTER_SIZE) {
      canonical.push(...members.splice(MAX_CLUSTER_SIZE));
    }

    // Default: an ML-template threat (sourceMethodology "ml_threat")
    // carries a fixed confidence (0.8, see supplemental-threats.ts) that
    // out-ranks a genuine LLM finding purely because it's a template, not
    // because it's more likely correct. Confidence-ordering alone would let
    // the template win and silently discard the real threat. Rather than
    // build a full similarity floor (the LLM's cluster response carries no
    // "reason"/score field to floor against yet), we take the minimal safe
    // default: when the top-ranked member is an ml_threat template AND the
    // cluster also contains a non-template member, skip merging this
    // cluster entirely (keep every member as its own singleton) and log it.
    const winner = members[0];
    const hasNonTemplateMember = members.some(
      (m) => m.sourceMethodology !== "ml_threat",
    );
    if (winner.sourceMethodology === "ml_threat" && hasNonTemplateMember) {
      logger.warn(
        {
          members: members.map((m) => ({
            name: m.name,
            confidence: m.confidence,
            sourceMethodology: m.sourceMethodology,
          })),
        },
        "ML-template threat would outrank a non-template finding by confidence; skipping merge for this cluster",
      );
      canonical.push(...members);
      continue;
    }

    canonical.push(winner);
  }
  // Coverage safety: any threat the LLM forgot becomes its own singleton.
  for (let i = 0; i < group.length; i++) {
    if (!seen.has(i)) canonical.push(group[i]);
  }
  return canonical;
}

function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
