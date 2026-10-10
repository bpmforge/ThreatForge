/**
 * HLA Synthesizer with Defended Cross-Doc Reconciliation
 *
 * Wraps the existing mergeMultiDocExtractions with three layers of defense:
 *
 * 1. Merge-reconciliation defense: when the same component appears under
 *    slightly different names in multiple docs, emit a ReconciliationRecord
 *    with both source quotes. A record fails if either quote can't be
 *    substring-matched in its respective doc.
 *
 * 2. Top-N component Challenge-Defend: the N highest trust-criticality
 *    components must each carry a verifiable sourceText quote. Those that
 *    can't are RETRACTED (marked INFERRED) before reaching canvas-build.
 *    "Retracted" here means verificationStatus is downgraded — components
 *    are NOT dropped, because best-effort extraction must never block import.
 *
 * 3. verificationStatus propagation: VERIFIED / INFERRED / UNVERIFIED tags
 *    from extraction are carried through the merge so the canvas can render
 *    a per-node badge.
 */

import { normalizeForQuoteCheck } from "../../utils/text-normalize.js";
import {
  mergeMultiDocExtractions,
  type ExtractionResult,
  type ExtractedComponent,
} from "./extraction-agent.js";
import logger from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SynthesisSourceDoc {
  name: string;
  content: string;
}

/** A cross-doc name reconciliation record (two docs agreed on a component). */
interface ReconciliationRecord {
  /** Merged component ID */
  componentId: string;
  /** Canonical name chosen after merge */
  mergedName: string;
  /** Evidence from each source document */
  sources: Array<{
    docName: string;
    nameInDoc: string;
    quote: string;
    /** true when quote substring-matched its doc */
    verified: boolean;
  }>;
  /** Overall reconciliation outcome */
  status: "VERIFIED" | "PARTIAL" | "UNVERIFIED";
}

export interface HLASynthesisResult {
  /** The merged extraction (same shape as runExtractionAgent output) */
  merged: ExtractionResult;
  /** Cross-doc reconciliation records — one per fuzzy-matched pair */
  reconciliations: ReconciliationRecord[];
  /** Components that passed top-N Challenge-Defend */
  defendedComponents: string[];
  /** Components that failed top-N Challenge-Defend (downgraded to INFERRED) */
  retractedComponents: string[];
  /** Summary stats */
  stats: {
    totalComponents: number;
    verified: number;
    inferred: number;
    unverified: number;
  };
}

// ---------------------------------------------------------------------------
// Top-N threshold
// ---------------------------------------------------------------------------

const TOP_N = 10;

/**
 * Compute trust-criticality score for ranking components in the defend pass.
 * High-trust + untrusted-network-facing components get priority.
 */
function trustCriticalityScore(c: ExtractedComponent): number {
  const trustScores: Record<string, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    UNTRUSTED: 1,
  };
  const typeScores: Record<string, number> = {
    DATABASE: 3,
    SERVICE: 2,
    EXTERNAL_SYSTEM: 2,
    API_GATEWAY: 2,
    MESSAGE_BROKER: 1,
    USER: 1,
    PROCESS: 1,
  };
  const trust = c.trustLevel ? (trustScores[c.trustLevel] ?? 2) : 2;
  const type = typeScores[c.type?.toUpperCase() ?? ""] ?? 1;
  return trust * 2 + type;
}

// ---------------------------------------------------------------------------
// Main synthesizer
// ---------------------------------------------------------------------------

/**
 * Merge multi-doc extractions, defend cross-doc name reconciliations, and
 * run top-N component Challenge-Defend. Returns the defended HLA result.
 */
export function synthesizeHLA(
  extractions: Array<{ extraction: ExtractionResult; documentName: string }>,
  sourceDocs: SynthesisSourceDoc[],
): HLASynthesisResult {
  const docIndex = buildDocIndex(sourceDocs);

  // Pre-merge: collect per-doc name inventories for reconciliation detection
  const premergeNames = buildPremergeNameIndex(extractions);

  // Run existing merge engine
  const merged = mergeMultiDocExtractions(extractions);

  // Reconciliation defense
  const reconciliations = buildReconciliations(
    merged.components,
    premergeNames,
    docIndex,
    extractions,
  );

  // Top-N Challenge-Defend
  const { defended, retracted } = challengeDefendTopN(
    merged.components,
    docIndex,
  );

  // Apply retraction: downgrade verificationStatus to INFERRED for failed components
  for (const comp of merged.components) {
    if (retracted.includes(comp.id)) {
      comp.verificationStatus = "INFERRED";
    } else if (
      defended.includes(comp.id) &&
      comp.verificationStatus !== "VERIFIED"
    ) {
      // Passed defend but status wasn't already VERIFIED — keep existing status
    }
  }

  // Stats
  const stats = {
    totalComponents: merged.components.length,
    verified: merged.components.filter(
      (c) => c.verificationStatus === "VERIFIED",
    ).length,
    inferred: merged.components.filter(
      (c) => c.verificationStatus === "INFERRED",
    ).length,
    unverified: merged.components.filter(
      (c) => !c.verificationStatus || c.verificationStatus === "UNVERIFIED",
    ).length,
  };

  logger.info(
    {
      total: stats.totalComponents,
      verified: stats.verified,
      inferred: stats.inferred,
      retractedByDefend: retracted.length,
    },
    "hla-synthesizer complete",
  );

  return {
    merged,
    reconciliations,
    defendedComponents: defended,
    retractedComponents: retracted,
    stats,
  };
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

interface DocNameEntry {
  docName: string;
  componentId: string;
  nameInDoc: string;
  sourceText?: string;
}

function buildPremergeNameIndex(
  extractions: Array<{ extraction: ExtractionResult; documentName: string }>,
): Map<string, DocNameEntry[]> {
  // key = normalized component name, value = list of appearances across docs
  const index = new Map<string, DocNameEntry[]>();
  for (const { extraction, documentName } of extractions) {
    for (const comp of extraction.components) {
      const key = normalizeForQuoteCheck(comp.name);
      if (!index.has(key)) index.set(key, []);
      index.get(key)!.push({
        docName: documentName,
        componentId: comp.id,
        nameInDoc: comp.name,
        sourceText: comp.sourceText,
      });
    }
  }
  return index;
}

function buildReconciliations(
  mergedComponents: ExtractedComponent[],
  premergeNames: Map<string, DocNameEntry[]>,
  docIndex: Map<string, string>,
  extractions: Array<{ extraction: ExtractionResult; documentName: string }>,
): ReconciliationRecord[] {
  const records: ReconciliationRecord[] = [];
  const handled = new Set<string>();

  for (const comp of mergedComponents) {
    const _normName = normalizeForQuoteCheck(comp.name);
    // Find all doc appearances for this component (exact + fuzzy)
    const appearances = findAppearances(comp, premergeNames, extractions);
    if (appearances.length < 2) continue; // only cross-doc merges are interesting

    const key = comp.id;
    if (handled.has(key)) continue;
    handled.add(key);

    const sources = appearances.map((a) => {
      const docNorm = docIndex.get(a.docName.toLowerCase());
      const quoteNorm = a.sourceText
        ? normalizeForQuoteCheck(a.sourceText)
        : "";
      const verified =
        !!docNorm && quoteNorm.length >= 8 && docNorm.includes(quoteNorm);
      return {
        docName: a.docName,
        nameInDoc: a.nameInDoc,
        quote: a.sourceText ?? "",
        verified,
      };
    });

    const verifiedCount = sources.filter((s) => s.verified).length;
    const status: ReconciliationRecord["status"] =
      verifiedCount === sources.length
        ? "VERIFIED"
        : verifiedCount > 0
          ? "PARTIAL"
          : "UNVERIFIED";

    records.push({
      componentId: comp.id,
      mergedName: comp.name,
      sources,
      status,
    });
  }

  return records;
}

function findAppearances(
  comp: ExtractedComponent,
  premergeNames: Map<string, DocNameEntry[]>,
  _extractions: Array<{ extraction: ExtractionResult; documentName: string }>,
): DocNameEntry[] {
  const normName = normalizeForQuoteCheck(comp.name);
  const exact = premergeNames.get(normName) ?? [];
  if (exact.length >= 2) return exact;

  // Fuzzy: look for containment matches across all names
  const fuzzy: DocNameEntry[] = [];
  for (const [key, entries] of premergeNames) {
    if (key === normName) continue;
    if (key.includes(normName) || normName.includes(key)) {
      fuzzy.push(...entries);
    }
  }
  return [...exact, ...fuzzy];
}

// ---------------------------------------------------------------------------
// Top-N Challenge-Defend
// ---------------------------------------------------------------------------

function challengeDefendTopN(
  components: ExtractedComponent[],
  docIndex: Map<string, string>,
): { defended: string[]; retracted: string[] } {
  const ranked = [...components].sort(
    (a, b) => trustCriticalityScore(b) - trustCriticalityScore(a),
  );
  const topN = ranked.slice(0, TOP_N);

  const defended: string[] = [];
  const retracted: string[] = [];

  for (const comp of topN) {
    const docNorm = comp.sourceDocument
      ? docIndex.get(comp.sourceDocument.toLowerCase())
      : undefined;
    const quoteNorm = comp.sourceText
      ? normalizeForQuoteCheck(comp.sourceText)
      : "";

    const passes =
      !!docNorm && quoteNorm.length >= 8 && docNorm.includes(quoteNorm);

    if (passes) {
      defended.push(comp.id);
    } else {
      logger.debug(
        { componentId: comp.id, name: comp.name },
        "hla-synthesizer top-N component failed defend — downgraded to INFERRED",
      );
      retracted.push(comp.id);
    }
  }

  return { defended, retracted };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDocIndex(docs: SynthesisSourceDoc[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const doc of docs) {
    index.set(doc.name.toLowerCase(), normalizeForQuoteCheck(doc.content));
  }
  return index;
}
