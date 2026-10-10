/**
 * Persistence-time confidence floor.
 *
 * Previously `aiConfidence` was written to every threat but never read as
 * a filter: `minCategoryConfidence` (component-analyzer.ts) only gates a
 * same-category retry loop, so a low-confidence threat that survived every
 * retry still got persisted. This module runs once, right before the final
 * persist, on the deduped set the pipeline is about to write.
 *
 * Template threats (rule-based, no LLM — supply-chain / ML) are exempt:
 * their `confidence` is a fixed editorial constant, not a per-call LLM
 * signal, so a floor tuned for LLM output should not apply to them. A
 * threat carried through from a prior human-reviewed run (`manuallyEdited`)
 * would be exempt too, but `MicroThreat` in this in-memory pipeline never
 * carries human-edited rows — those are persisted separately by
 * review-service.ts and never re-enter this array — so no such check
 * exists here to be checked.
 */
import type { MicroThreat } from "./types.js";
import logger from "../../../utils/logger.js";

/** Rule-based, non-LLM sourceMethodology values — never subject to the floor. */
const TEMPLATE_METHODOLOGIES = new Set(["ml_threat", "supply_chain"]);

/** Default floor when no option/org setting overrides it. */
export const DEFAULT_MIN_PERSIST_CONFIDENCE = 0.4;

/**
 * Split threats into those that clear the floor (kept) and those that
 * don't (dropped). Template threats always pass.
 */
export function applyConfidenceFloor(
  threats: MicroThreat[],
  minConfidence: number = DEFAULT_MIN_PERSIST_CONFIDENCE,
): { kept: MicroThreat[]; droppedCount: number } {
  const kept: MicroThreat[] = [];
  let droppedCount = 0;

  for (const threat of threats) {
    const isTemplate = TEMPLATE_METHODOLOGIES.has(threat.sourceMethodology);
    if (isTemplate || threat.confidence >= minConfidence) {
      kept.push(threat);
    } else {
      droppedCount++;
    }
  }

  if (droppedCount > 0) {
    logger.info(
      { droppedCount, minConfidence, kept: kept.length },
      "Confidence floor dropped low-confidence threats before persist",
    );
  }

  return { kept, droppedCount };
}
