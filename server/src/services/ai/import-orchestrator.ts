/**
 * Import-Flow Orchestrator
 *
 * Ties the diagram planner, prose extractor and HLA synthesizer
 * together under one call:
 *
 *   Plan → Defend → Extract (per retained plan) → Synthesize HLA → Manifest check
 *
 * Returns a structured result with each stage's output so callers can
 * show per-step progress or surface partial results on partial failure.
 *
 * Best-effort throughout: stage failures degrade gracefully (fewer
 * diagrams / lower confidence) rather than aborting the run.
 */

import logger from "../../utils/logger.js";
import type { AIProviderClient } from "../../types/ai.js";
import {
  planDiagrams,
  type SourceDoc,
  type PlanDiagramsResult,
} from "./sequence-extraction/diagram-planner.js";
import { detectProseSequences } from "./sequence-extraction/prose-detector.js";
import { extractProseSequence } from "./sequence-extraction/prose-extractor.js";
import type { ExtractedSequenceDiagram } from "./sequence-extraction/types.js";
import {
  runExtractionAgent,
  type ExtractionResult,
} from "./extraction-agent.js";
import {
  synthesizeHLA,
  type HLASynthesisResult,
  type SynthesisSourceDoc,
} from "./hla-synthesizer.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OrchestratorDoc {
  id: string;
  name: string;
  content: string;
  type?: string;
}

export interface OrchestrateResult {
  /** Diagram planner output */
  plan: PlanDiagramsResult;
  /** Sequence diagrams extracted from retained plans */
  extractedDiagrams: ExtractedSequenceDiagram[];
  /** HLA synthesis result */
  synthesized: HLASynthesisResult;
  /** Manifest honesty check */
  manifest: {
    plannedNames: string[];
    extractedNames: string[];
    missing: string[];
    extra: string[];
    honest: boolean;
  };
  /** Documents that were used */
  documentsUsed: Array<{ id: string; name: string }>;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full Plan → Defend → Extract → Synthesize pipeline.
 */
export async function orchestrateImport(
  client: AIProviderClient,
  docs: OrchestratorDoc[],
  onProgress?: (stage: string, detail: string) => void,
): Promise<OrchestrateResult> {
  const emit = (stage: string, detail: string) => {
    logger.info({ stage, detail }, "orchestrate-import progress");
    onProgress?.(stage, detail);
  };

  const sourceDocs: SourceDoc[] = docs.map((d) => ({
    name: d.name,
    content: d.content,
  }));

  // ── Stage 1: Plan ─────────────────────────────────────────────────────────
  emit("plan", `Planning diagrams across ${docs.length} document(s)`);
  let plan: PlanDiagramsResult;
  try {
    plan = await planDiagrams(client, sourceDocs);
  } catch (err) {
    logger.warn({ err }, "orchestrate-import: plan stage failed");
    plan = { planned: [], retained: [], retracted: [] };
  }

  emit(
    "plan-complete",
    `${plan.retained.length} retained, ${plan.retracted.length} retracted`,
  );

  // ── Stage 2: Extract sequence diagrams from retained plans ────────────────
  emit("extract", "Extracting sequence diagrams from retained plans");
  const extractedDiagrams: ExtractedSequenceDiagram[] = [];

  for (const planned of plan.retained) {
    // Find prose sections whose heading matches the planned diagram name
    for (const doc of docs) {
      const sections = detectProseSequences(doc.content);
      const matching = sections.filter(
        (s) =>
          similarHeading(s.heading, planned.name) ||
          planned.citations.some(
            (c) => c.docName.toLowerCase() === doc.name.toLowerCase(),
          ),
      );
      for (const section of matching) {
        try {
          const diagram = await extractProseSequence(client, section);
          if (diagram) {
            extractedDiagrams.push(diagram);
          }
        } catch (err) {
          logger.warn(
            { err, heading: section.heading },
            "orchestrate-import: section extraction failed, skipping",
          );
        }
      }
    }
  }

  emit("extract-complete", `${extractedDiagrams.length} diagram(s) extracted`);

  // ── Stage 3: Per-doc HLA extraction ──────────────────────────────────────
  emit("hla-extract", "Running per-doc HLA extraction");
  const perDocExtractions: Array<{
    extraction: ExtractionResult;
    documentName: string;
  }> = [];

  for (const doc of docs) {
    try {
      const extraction = await runExtractionAgent(client, doc.content, {
        documentType: doc.type ?? "auto",
      });
      perDocExtractions.push({ extraction, documentName: doc.name });
    } catch (err) {
      logger.warn(
        { err, docName: doc.name },
        "orchestrate-import: HLA extraction failed for doc, skipping",
      );
    }
  }

  // ── Stage 4: HLA synthesis with defense ───────────────────────────────────
  emit("synthesize", "Synthesizing HLA with cross-doc defense");
  const synthesized = synthesizeHLA(
    perDocExtractions,
    sourceDocs as SynthesisSourceDoc[],
  );

  emit(
    "synthesize-complete",
    `${synthesized.stats.totalComponents} components (${synthesized.stats.verified} verified, ${synthesized.stats.inferred} inferred)`,
  );

  // ── Stage 5: Manifest honesty check ───────────────────────────────────────
  const plannedNames = plan.retained.map((p) => p.name);
  const extractedNames = extractedDiagrams.map((d) => d.name);
  const missing = plannedNames.filter(
    (n) => !extractedNames.some((e) => similarHeading(e, n)),
  );
  const extra = extractedNames.filter(
    (e) => !plannedNames.some((n) => similarHeading(e, n)),
  );

  if (missing.length > 0) {
    logger.warn(
      { missing },
      "orchestrate-import manifest: planned diagrams not found in extracted output",
    );
  }

  emit("manifest", `${missing.length} missing, ${extra.length} extra vs plan`);

  return {
    plan,
    extractedDiagrams,
    synthesized,
    manifest: {
      plannedNames,
      extractedNames,
      missing,
      extra,
      honest: missing.length === 0,
    },
    documentsUsed: docs.map((d) => ({ id: d.id, name: d.name })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Loose heading similarity: share ≥50% words or one contains the other.
 */
function similarHeading(a: string, b: string): boolean {
  const na = a
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
  const nb = b
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  const overlap = [...wordsA].filter((w) => wordsB.has(w)).length;
  const jaccard = overlap / (wordsA.size + wordsB.size - overlap);
  return jaccard >= 0.5;
}
