/**
 * ArchitectureReader stage handler — non-LLM context assembly, ported
 * from micro-analysis/pipeline.ts setup blocks (ARCHITECTURE §2.1): component
 * graph (toComponentContext), per-component sequence flows, skip-set via
 * analysisHash (buildSkipSet, persist-gated exactly like the legacy loop),
 * plus the methodology label downstream stage conditions key on.
 *
 * Context source:
 * - `inputs.context` when provided (fixture/e2e path — DB-free), else
 * - assembled from ctx.threatModelId via the same buildThreatModelContext
 *   every AI pipeline uses today (lazy import keeps api/ out of unit tests).
 *
 * Outputs are JSON-safe (skipSet as array, sequenceFlows as a plain record)
 * because pipeline-service persists stage outputs to PipelineStageExecution.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import {
  buildSkipSet,
  toComponentContext,
} from "../micro-analysis/pipeline.js";
import type { MicroAnalysisOptions } from "../micro-analysis/types.js";
import {
  buildComponentSequenceFlows,
  type SequenceFlowMessage,
} from "./identifier-context.js";
import type { StageContext, StageResult } from "./registry.js";

interface ArchitectureReaderInputs {
  /** Pre-built context (fixture/e2e path). Omit to load from the DB. */
  context?: ThreatModelContext;
  options?: Partial<MicroAnalysisOptions>;
  persist?: { threatModelId: string; userId: string; sessionId?: string };
}

export async function architectureReaderStage(
  ctx: StageContext,
): Promise<StageResult> {
  const {
    context: providedContext,
    options,
    persist,
  } = ctx.inputs as unknown as ArchitectureReaderInputs;

  let context = providedContext;
  if (!context) {
    if (!ctx.threatModelId) {
      throw new Error(
        "ArchitectureReader requires inputs.context or ctx.threatModelId",
      );
    }
    const { buildThreatModelContext } = await import(
      "../../../api/ai/helpers.js"
    );
    context = (await buildThreatModelContext(ctx.threatModelId)) ?? undefined;
    if (!context) {
      throw new Error(
        `ArchitectureReader: threat model not found: ${ctx.threatModelId}`,
      );
    }
  }

  const componentContexts = context.components.map((comp) =>
    toComponentContext(comp, context),
  );

  const sequenceFlows: Record<string, SequenceFlowMessage[]> =
    Object.fromEntries(buildComponentSequenceFlows(context));

  // Skip-set via analysisHash — DB-backed, persist-gated like the legacy loop.
  const skipSet = persist
    ? [...(await buildSkipSet(persist.threatModelId, options?.force ?? false))]
    : [];

  // Normalized label for downstream stage conditions (StrideClassifier is
  // seeded with condition `<thisStageId>.methodology === "STRIDE"`).
  const methodology = (context.methodology ?? "STRIDE")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

  await ctx.progress(
    100,
    `Architecture read: ${componentContexts.length} components, ` +
      `${Object.keys(sequenceFlows).length} with sequence flows, ` +
      `${skipSet.length} skippable`,
  );

  return {
    outputs: {
      componentContexts,
      skipSet,
      sequenceFlows,
      methodology,
      context,
      requirements: context.requirements ?? [],
      parseFailures: [],
    },
    tokensUsed: 0,
    parseFailures: [],
  };
}
