/**
 * MitigationSynthesizer stage handler — PORT (not a rewrite) of the
 * legacy mitigation generation pass in micro-analysis/pipeline.ts: group
 * threats by component, then generateMitigationsForComponent (2–4+ per
 * threat, distinct control categories, one LLM call per MITIGATION_BATCH_SIZE threats) with the
 * user's "mitigations" writing-style wrap.
 *
 * ORDERING PORT: legacy runs mitigations BEFORE the supplemental + compound
 * sub-steps, so those threats never enter the mitigation pass. In the v2
 * pipeline they arrive merged in ThreatIdentifier's output, so this stage
 * partitions them out by sourceMethodology (supply_chain / ml_threat /
 * compound) and appends them after the mitigated set — reproducing the
 * legacy final order [mitigated loop threats, supplemental, compound] and
 * keeping the per-threat prompts byte-identical to the legacy run.
 *
 * Includes the mitigations-only PRESEED (mitigation-preseed.ts): with `options.mitigationsOnly` + `persist`,
 * existing PENDING threats are loaded from the DB and mitigated without
 * re-running identification (preseeded threats are NOT partition-filtered —
 * the legacy preseed path mitigates everything it loads).
 */
import type {
  MicroAnalysisOptions,
  MicroThreat,
  ParseFailure,
} from "../micro-analysis/types.js";
import {
  generateMitigationsForComponent,
  MITIGATION_BATCH_SIZE,
} from "../micro-analysis/mitigation-analyzer.js";
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import { wrapWithThreatStyle } from "./identifier-context.js";
import { preseedExistingThreats } from "./mitigation-preseed.js";
import type { StageContext, StageResult } from "./registry.js";

/** Sub-step outputs the legacy mitigation pass never sees (see module doc). */
export const POST_MITIGATION_SOURCES = new Set([
  "supply_chain",
  "ml_threat",
  "compound",
]);

interface MitigationSynthesizerInputs {
  /** EvidenceEnricher output (always mapped). */
  threats?: MicroThreat[];
  /** StrideClassifier output — preferred when that stage ran (seed doc). */
  classifiedThreats?: MicroThreat[];
  componentContexts?: ComponentContext[];
  requirements?: Array<{
    reqId: string;
    text: string;
    category?: string | null;
  }>;
  options?: Partial<MicroAnalysisOptions>;
  persist?: { threatModelId: string; userId: string; sessionId?: string };
}

export async function mitigationSynthesizerStage(
  ctx: StageContext,
): Promise<StageResult> {
  const inputs = ctx.inputs as unknown as MitigationSynthesizerInputs;
  const { componentContexts, requirements, options, persist } = inputs;
  const input = inputs.classifiedThreats ?? inputs.threats;
  if (!Array.isArray(input)) {
    throw new Error(
      "MitigationSynthesizer requires inputs.threats (or classifiedThreats)",
    );
  }
  const report = options?.onProgress || (() => {});
  const parseFailures: ParseFailure[] = [];
  let llmCalls = 0;

  // Partition out supplemental/compound threats (legacy ordering port).
  const mitigatable = input.filter(
    (t) => !POST_MITIGATION_SOURCES.has(t.sourceMethodology),
  );
  const passThrough = input.filter((t) =>
    POST_MITIGATION_SOURCES.has(t.sourceMethodology),
  );

  // PRESEED (mitigations-only mode) — see module doc.
  if (options?.mitigationsOnly && persist) {
    mitigatable.push(
      ...(await preseedExistingThreats(
        persist.threatModelId,
        options.componentNodeIds,
      )),
    );
    report(
      "mitigations",
      `Mitigations-only mode: loaded ${mitigatable.length} existing threats`,
    );
  }

  // Outside mitigations-only mode, identification threats are mitigated
  // once, after the discovery loop, dedup and the confidence floor, by the
  // shared pass in finalizeV2Run (mitigation-pass.ts) — the same batches the
  // legacy pipeline sends. Mitigating here would pay for threats that are then
  // merged or dropped, and would batch a different set than legacy.
  if (!options?.mitigationsOnly) {
    await ctx.progress(100, "Mitigations deferred to the final set");
    return {
      outputs: {
        threatsWithMitigations: [...mitigatable, ...passThrough],
        llmCalls,
        parseFailures,
      },
      tokensUsed: 0,
      parseFailures,
    };
  }

  // Legacy guard: nothing to mitigate → pass through unchanged.
  if (mitigatable.length === 0) {
    await ctx.progress(100, "No threats to mitigate");
    return {
      outputs: { threatsWithMitigations: passThrough, llmCalls, parseFailures },
      tokensUsed: 0,
      parseFailures,
    };
  }

  // Separate writing-style wrap for mitigation generation (matches the legacy pipeline).
  const mitigationAiCall = await wrapWithThreatStyle(
    ctx.aiCall,
    persist?.userId,
    "mitigations",
  );

  report("mitigations", "Generating mitigations per threat...");

  // Group threats by component for context — exact legacy port.
  const threatsByComponent = new Map<string, MicroThreat[]>();
  for (const t of mitigatable) {
    const existing = threatsByComponent.get(t.componentId) || [];
    existing.push(t);
    threatsByComponent.set(t.componentId, existing);
  }

  const mitigatedThreats: MicroThreat[] = [];
  let processed = 0;
  for (const [compId, compThreats] of threatsByComponent) {
    const compCtx = componentContexts?.find((c) => c.id === compId);
    if (!compCtx) {
      mitigatedThreats.push(...compThreats);
    } else {
      const withMitigations = await generateMitigationsForComponent(
        mitigationAiCall,
        compCtx,
        compThreats,
        (detail) => report("mitigations", detail),
        requirements,
        parseFailures,
      );
      mitigatedThreats.push(...withMitigations);
      llmCalls += Math.ceil(compThreats.length / MITIGATION_BATCH_SIZE); // batches
    }
    processed++;
    await ctx.progress(
      Math.round((processed / threatsByComponent.size) * 100),
      `Mitigations: ${processed}/${threatsByComponent.size} components`,
    );
  }

  report(
    "mitigations_done",
    `Mitigations generated for ${mitigatedThreats.length} threats`,
  );

  return {
    outputs: {
      // Legacy final order: mitigated loop threats, then supplemental, then
      // compound (passThrough preserves the merged-input order).
      threatsWithMitigations: [...mitigatedThreats, ...passThrough],
      llmCalls,
      parseFailures,
    },
    tokensUsed: 0,
    parseFailures,
  };
}
