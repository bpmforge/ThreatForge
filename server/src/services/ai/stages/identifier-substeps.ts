/**
 * ThreatIdentifier stage — non-LLM/aggregation sub-steps.
 *
 * Byte-equivalent ports of the supplemental + compound blocks of
 * micro-analysis/pipeline.ts `runMicroAnalysis` (they run inside
 * ThreatIdentifier aggregation, as they always have),
 * plus the reviewed-threats context load. Logic is copied, not
 * reinterpreted — if pipeline.ts changes, change this the same way.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import { analyzeCompoundThreats } from "../micro-analysis/compound-analyzer.js";
import {
  generateMLThreats,
  generateSupplyChainThreats,
} from "../micro-analysis/supplemental-threats.js";
import type {
  AICallFn,
  MicroThreat,
  ParseFailure,
} from "../micro-analysis/types.js";
import { getReviewedThreats } from "../../threat-review/review-service.js";
import logger from "../../../utils/logger.js";

export type ProgressReport = (phase: string, detail: string) => void;

/** Port of the pipeline's "Load human-reviewed threats" block (persist only). */
export async function reportReviewedThreats(
  threatModelId: string,
  report: ProgressReport,
): Promise<void> {
  const reviewed = await getReviewedThreats(threatModelId);
  if (reviewed.length > 0) {
    report(
      "context",
      `Loaded ${reviewed.length} human-reviewed threats as context`,
    );
    logger.info(
      { reviewed: reviewed.length },
      "Loaded reviewed threats for AI context",
    );
  }
}

/**
 * Port of the pipeline's "Supply chain + ML threats" block (rule-based, no
 * LLM; persist-gated by the caller). Appends results to `allThreats` in
 * place, exactly like the legacy code.
 */
async function runSupplementalSubStep(
  threatModelId: string,
  context: ThreatModelContext,
  allThreats: MicroThreat[],
  report: ProgressReport,
): Promise<void> {
  report("supplemental", "Checking supply chain + ML threats...");
  const supplyChainThreats = await generateSupplyChainThreats(threatModelId);
  const mlThreats = await generateMLThreats(threatModelId, context);
  if (supplyChainThreats.length > 0 || mlThreats.length > 0) {
    allThreats.push(...supplyChainThreats, ...mlThreats);
    report(
      "supplemental",
      `Added ${supplyChainThreats.length} supply chain + ${mlThreats.length} ML threats`,
    );
  }
}

/**
 * Port of the pipeline's "Cross-component compound analysis" block — same
 * component/connection projections (names not CUIDs reach the prompt via
 * compound-analyzer itself).
 */
export async function runCompoundSubStep(
  aiCall: AICallFn,
  context: ThreatModelContext,
  allThreats: MicroThreat[],
  report: ProgressReport,
): Promise<{
  attackChains: Awaited<
    ReturnType<typeof analyzeCompoundThreats>
  >["attackChains"];
  compoundThreats: MicroThreat[];
  parseFailures: ParseFailure[];
}> {
  report("compound", "Analyzing cross-component attack chains...");
  const { attackChains, compoundThreats, parseFailures } =
    await analyzeCompoundThreats(
      aiCall,
      context.components.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        trustLevel: c.trustZone,
      })),
      context.connections.map((c) => ({
        source: c.source,
        target: c.target,
        protocol: c.protocol,
        encrypted: c.encrypted,
      })),
      allThreats,
    );
  return { attackChains, compoundThreats, parseFailures: parseFailures ?? [] };
}

/**
 * Supplemental (persist-only) then compound sub-steps, in the legacy order.
 * Compound parse failures are appended to `allParseFailures` in place.
 */
export async function runSupplementalAndCompoundSubSteps(
  persist: { threatModelId: string } | undefined,
  aiCall: AICallFn,
  context: ThreatModelContext,
  allThreats: MicroThreat[],
  allParseFailures: ParseFailure[],
  report: ProgressReport,
): Promise<{
  attackChains: Awaited<ReturnType<typeof runCompoundSubStep>>["attackChains"];
  compoundThreats: MicroThreat[];
}> {
  if (persist) {
    await runSupplementalSubStep(
      persist.threatModelId,
      context,
      allThreats,
      report,
    );
  }
  const { attackChains, compoundThreats, parseFailures } =
    await runCompoundSubStep(aiCall, context, allThreats, report);
  allParseFailures.push(...parseFailures);
  return { attackChains, compoundThreats };
}
