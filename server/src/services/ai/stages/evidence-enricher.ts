/**
 * EvidenceEnricher stage handler: a verified pass-through.
 *
 * Reference enrichment (CWE/OWASP/compliance via micro-analysis/reference-lookup.ts)
 * happens inside the per-(component, category) analysis that ThreatIdentifier
 * runs: component-analyzer calls lookupCategoryReferences before every LLM
 * call and the looked-up reference data shapes the prompt (and rotates
 * through the confidence loop). Extracting it into this stage would change
 * those prompts and the legacy pipeline's output. This stage therefore
 * verifies and surfaces the already-injected reference data on the merged
 * threat list instead of re-running enrichment: threats pass through
 * unchanged and the stage emits a referenceCoverage summary.
 */
import type { MicroThreat } from "../micro-analysis/types.js";
import type { StageContext, StageResult } from "./registry.js";

interface EvidenceEnricherInputs {
  /** Merged ThreatIdentifier output (loop + supplemental + compound). */
  threats: MicroThreat[];
}

interface ReferenceCoverage {
  total: number;
  withCweIds: number;
  withOwaspIds: number;
  withEvidence: number;
}

export async function evidenceEnricherStage(
  ctx: StageContext,
): Promise<StageResult> {
  const { threats } = ctx.inputs as unknown as EvidenceEnricherInputs;
  if (!Array.isArray(threats)) {
    throw new Error(
      "EvidenceEnricher requires inputs.threats — the merged ThreatIdentifier output",
    );
  }

  const referenceCoverage: ReferenceCoverage = {
    total: threats.length,
    withCweIds: threats.filter((t) => (t.cweIds?.length ?? 0) > 0).length,
    withOwaspIds: threats.filter((t) => (t.owaspIds?.length ?? 0) > 0).length,
    withEvidence: threats.filter(
      (t) =>
        t.evidence &&
        Boolean(
          t.evidence.cwe ||
            t.evidence.owasp ||
            t.evidence.compliance ||
            t.evidence.attackPath,
        ),
    ).length,
  };

  await ctx.progress(
    100,
    `Evidence verified: ${referenceCoverage.withCweIds}/${referenceCoverage.total} ` +
      `threats carry CWE references (enrichment injected during identification)`,
  );

  return {
    // Pass-through by design — same object references, zero mutation.
    outputs: { enrichedThreats: threats, referenceCoverage, parseFailures: [] },
    tokensUsed: 0,
    parseFailures: [],
  };
}
