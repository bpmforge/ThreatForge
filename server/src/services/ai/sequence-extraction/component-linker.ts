/**
 * Auto-link sequence-diagram participants to canvas components.
 *
 * SAD §2.3.2 talks about "GreenSpot Telemetry Ingestion Services" while a
 * separately-extracted SDS may surface the same component as "Telemetry
 * Ingestion Service" (singular). Strict equality misses this; users have
 * to manually link every participant after import. The fuzzy linker fixes
 * that — when a participant's label matches an existing canvas component
 * with high confidence, we set `SequenceParticipant.componentId` (the
 * canvas-side `nodeId`) at persist time. Below the threshold we leave it
 * null and let the user link manually.
 *
 * The scorer is ported from frontend `merge-engine.ts` so server- and
 * client-side fuzzy logic stay in sync. Threshold 0.7 = exact + containment
 * matches keep, casual word-overlap matches go to manual review.
 */

import type { PrismaClient } from "@prisma/client";

export const DEFAULT_LINK_THRESHOLD = 0.7;

/**
 * Score how closely two component-name candidates match (0-1).
 * Mirrors frontend merge-engine `nameMatchScore`:
 *   - Exact normalized → 1.0
 *   - One contains the other → 0.85 (e.g., "Postgres" vs "PostgreSQL DB")
 *   - Word-overlap (Jaccard) ≥ 0.5 → 0.6-0.8 sliding
 *   - Otherwise weighted Jaccard, low score
 */
export function nameMatchScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccard = intersection.length / union.size;
  if (jaccard >= 0.5) return 0.4 + jaccard * 0.4;
  return jaccard * 0.4;
}

/**
 * Normalize a name for fuzzy matching: lowercase, strip punctuation,
 * collapse whitespace, drop short noise words.
 *
 * Drops stopword "service" / "services" / "the" so "Telemetry Ingestion
 * Service" matches "Telemetry Ingestion Services" via exact-norm.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(" ");
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "service",
  "services",
  "system",
  "module",
]);

export interface ComponentRef {
  /** Canvas-side stable id (the value persisted into SequenceParticipant.componentId). */
  nodeId: string;
  name: string;
  /** Optional secondary signal — e.g. "PostgreSQL 17". */
  technology?: string | null;
}

export interface LinkResult {
  /** Canvas nodeId, or null when no match cleared the threshold. */
  nodeId: string | null;
  score: number;
  matchedName?: string;
}

/**
 * Find the best match for a participant label among the given components.
 * Considers component name AND technology — "Postgres" can match a
 * component named "User DB" with technology "PostgreSQL 17".
 */
export function bestMatch(
  participantLabel: string,
  components: ComponentRef[],
  threshold = DEFAULT_LINK_THRESHOLD,
): LinkResult {
  let best: LinkResult = { nodeId: null, score: 0 };
  for (const c of components) {
    const nameScore = nameMatchScore(participantLabel, c.name);
    const techScore = c.technology
      ? nameMatchScore(participantLabel, c.technology)
      : 0;
    const score = Math.max(nameScore, techScore);
    if (score > best.score) {
      best = { nodeId: c.nodeId, score, matchedName: c.name };
    }
  }
  if (best.score < threshold) return { nodeId: null, score: best.score };
  return best;
}

/**
 * Load this threat model's canvas components and return a Map of
 * participantLabel → matched canvas nodeId (null when no match cleared
 * the threshold). Built so the persist layer can do one DB read per
 * import instead of one per participant.
 */
export async function buildLinkResolver(
  prisma: PrismaClient,
  threatModelId: string,
  threshold = DEFAULT_LINK_THRESHOLD,
): Promise<(participantLabel: string) => LinkResult> {
  const rows = await prisma.component.findMany({
    where: { threatModelId },
    select: { nodeId: true, name: true, technology: true },
  });
  const components: ComponentRef[] = rows.map((r) => ({
    nodeId: r.nodeId,
    name: r.name,
    technology: r.technology,
  }));
  return (label: string) => bestMatch(label, components, threshold);
}
