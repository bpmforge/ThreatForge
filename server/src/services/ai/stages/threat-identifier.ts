/**
 * ThreatIdentifier stage handler: a port of the legacy per-(component,
 * category) loop in micro-analysis/pipeline.ts plus its supplemental and
 * compound sub-steps. Orchestration only; business logic stays in
 * micro-analysis/*. Output is kept byte-equivalent to the legacy loop (the
 * replay-journal parity harness throws ReplayMiss on any prompt deviation).
 *
 * Inputs (see identifier-inputs.ts): ArchitectureReader-fed (pipeline path)
 * or raw-context (parity harness + unit tests). With `persist`,
 * persistence stays exactly where the legacy loop has it (streaming
 * persistAIThreats, analyzedAt mark, ADR-006 sessionId). Without it the run
 * is DB-free. NOT ported (other stages own it): mitigation pass +
 * mitigations-only preseed → MitigationSynthesizer; calibration + LLM dedup
 * → SeverityCalibrator; final persist stays on the legacy path.
 */
import { chunkCategories } from "../micro-analysis/category-chunk-analyzer.js";
import logger from "../../../utils/logger.js";
import { getCategoriesForMethodology } from "../micro-analysis/component-analyzer.js";
import {
  describeInference,
  type RoleInference,
} from "../micro-analysis/role-inference.js";
import { analyzeComponent } from "../micro-analysis/component-analyzer.js";
import type {
  MicroAnalysisOptions,
  MicroThreat,
  ParseFailure,
} from "../micro-analysis/types.js";
import {
  isAiFlowReady,
  runThreatIdentifierFanOut,
  type FanOutFailedUnit,
  methodologyForCategory,
  type FanOutUnit,
} from "../../../jobs/ai-flow.js";
import {
  createEmissionCapTracker,
  markComponentAnalyzed,
  streamPersistThreats,
  wrapWithThreatStyle,
} from "./identifier-context.js";
import {
  resolveIdentifierSetup,
  type IdentifierSetup,
  type ThreatIdentifierInputs,
} from "./identifier-inputs.js";
import {
  reportReviewedThreats,
  runSupplementalAndCompoundSubSteps,
} from "./identifier-substeps.js";
import type { StageContext, StageResult } from "./registry.js";
import {
  computeDeadlineAt,
  isPastDeadline,
  reportDeadlineStop,
} from "../job-deadline.js";

export async function threatIdentifierStage(
  ctx: StageContext,
): Promise<StageResult> {
  const inputs = ctx.inputs as unknown as ThreatIdentifierInputs;
  const { context, persist } = inputs;
  if (!context) {
    throw new Error(
      "ThreatIdentifier (wave A1) requires inputs.context — the raw ThreatModelContext",
    );
  }
  const setup = await resolveIdentifierSetup(inputs);
  const { opts, componentContexts } = setup;
  const report = opts.onProgress || (() => {});

  // Same AICallFn + style wrap as legacy (no persist.userId → unchanged).
  const styledAiCall = await wrapWithThreatStyle(ctx.aiCall, persist?.userId);

  // Load human-reviewed threats (respect prior decisions) — persist only.
  if (persist) await reportReviewedThreats(persist.threatModelId, report);

  report(
    "init",
    `Starting micro-analysis: ${componentContexts.length} components × ${opts.methodologies.join("+")}`,
  );

  // --- Fan-out path: one ai-fast child per (component, category) ---
  // Gated on `fanOut: true` (seeded pipeline default for v2) AND an
  // initialized FlowProducer (Redis). Otherwise the legacy sequential loop
  // below runs unchanged; fanOut:false keeps the sequential path byte-for-byte.
  const fanOut = (ctx.inputs as { fanOut?: unknown }).fanOut === true;
  if (fanOut && isAiFlowReady()) {
    return runFanOutPath(ctx, inputs, setup, styledAiCall, report);
  }

  let llmCalls = 0;
  const allParseFailures: ParseFailure[] = [];
  const roleInferences: RoleInference[] = [];
  const assertUnderCap = createEmissionCapTracker();
  const skipNodeIds = setup.skipNodeIds;
  const dbIdToNodeId = setup.dbIdToNodeId;
  const allThreats: MicroThreat[] = opts.resumeFrom
    ? [...opts.resumeFrom.seedThreats]
    : [];

  // --- Per-component analysis (sequential path) ---
  let processed = 0;
  // Legacy summary ride-along: counts ONLY resume + unchanged-hash
  // skips, exactly like runMicroAnalysis's skippedComponentCount (scope and
  // mitigations-only `continue`s are not counted there either).
  let skippedComponentCount = 0;
  let deadlineStopped = false;
  // See pipeline.ts: a caller that forgets the deadline must not end up
  // unbounded.
  const effectiveDeadlineAt = opts.deadlineAt ?? computeDeadlineAt(Date.now());
  for (const compCtx of componentContexts) {
    if (opts.cancelSignal?.cancelled || ctx.signal.aborted) {
      throw Object.assign(new Error("Analysis cancelled by user"), {
        code: "CANCELLED",
      });
    }
    // Stop, do NOT throw — a throw takes the FAILED path and
    // cleanupSessionThreats would delete every component already persisted.
    if (isPastDeadline(effectiveDeadlineAt, Date.now())) {
      deadlineStopped = true;
      report(
        "component",
        reportDeadlineStop(
          "ThreatIdentifier",
          processed,
          componentContexts.length - processed,
          effectiveDeadlineAt,
        ),
      );
      break;
    }
    processed++;
    try {
      if (opts.resumeFrom?.completedComponentIds.has(compCtx.id)) {
        skippedComponentCount++;
        report("component", `Skipping ${compCtx.name} (already done)`);
        continue;
      }
      const nodeId = dbIdToNodeId.get(compCtx.id);
      if (
        opts.componentNodeIds?.length &&
        nodeId &&
        !opts.componentNodeIds.includes(nodeId)
      ) {
        continue;
      }
      if (opts.mitigationsOnly) continue;
      if (nodeId && skipNodeIds.has(nodeId)) {
        skippedComponentCount++;
        report(
          "component",
          `Skipping ${compCtx.name} (unchanged since last analysis)`,
        );
        continue;
      }

      for (const methodology of opts.methodologies) {
        report("component", `Analyzing ${compCtx.name} (${methodology})...`);
        const flows = setup.componentSequenceFlows.get(compCtx.id);
        const {
          threats,
          llmCalls: calls,
          parseFailures,
          roleInference,
        } = await analyzeComponent(
          styledAiCall,
          compCtx,
          methodology,
          opts,
          flows,
        );
        allThreats.push(...threats);
        allParseFailures.push(...parseFailures);
        llmCalls += calls;

        // An inferred security role changes which weaknesses the model is
        // shown, so the guess has to be visible on EVERY path that can produce
        // it — not just the legacy one. Reported and logged here for the same
        // reason it is in micro-analysis/pipeline.ts.
        if (roleInference) {
          roleInferences.push(roleInference);
          report("role_inference", describeInference(roleInference));
          logger.info(
            {
              componentId: roleInference.componentId,
              declaredType: roleInference.declaredType,
              inferredRole: roleInference.inferredRole,
              confidence: roleInference.confidence,
              needsReview: roleInference.needsReview,
              evidence: roleInference.evidence,
            },
            "Security role inferred for a component whose canvas type had no reference data",
          );
        }
        assertUnderCap(compCtx.id, compCtx.name, threats.length);

        // STREAMING PERSIST — stays exactly where the legacy loop has it.
        if (persist && threats.length > 0) {
          await streamPersistThreats(
            persist,
            threats,
            nodeId,
            methodology,
            compCtx.name,
            report,
            opts.onComponentPersisted,
          );
        }
      }

      // Mark analyzed so the next run can skip it if unchanged.
      if (persist && nodeId)
        await markComponentAnalyzed(persist.threatModelId, nodeId);
      if (opts.onCheckpoint)
        await opts.onCheckpoint(compCtx.id, [...allThreats]);
    } finally {
      await ctx.progress(
        Math.round((processed / componentContexts.length) * 100),
        `${compCtx.name}: component analysis complete (${processed}/${componentContexts.length})`,
      );
    }
  }
  report(
    "components_done",
    `${allThreats.length} threats from ${componentContexts.length} components`,
  );

  // Supplemental + compound sub-steps — same order/gating as legacy.
  const { attackChains, compoundThreats } =
    await runSupplementalAndCompoundSubSteps(
      persist,
      styledAiCall,
      context,
      allThreats,
      allParseFailures,
      report,
    );
  llmCalls++;

  // threats/parseFailures per seeded outputFields; attackChains + llmCalls
  // (+ skippedComponentCount for the legacy result summary) ride along
  // for downstream stages and the v2 worker path.
  return {
    outputs: {
      threats: [...allThreats, ...compoundThreats],
      parseFailures: allParseFailures,
      attackChains,
      llmCalls,
      skippedComponentCount,
      // Never let a time-bounded stop look like a complete run.
      ...(deadlineStopped ? { deadlineStopped: true } : {}),
      ...(roleInferences.length ? { roleInferences } : {}),
    },
    tokensUsed: 0, // AICallFn returns text only — no token accounting yet
    parseFailures: allParseFailures,
  };
}

/**
 * Derive the fan-out unit set (one per surviving (component, category)) by
 * applying EXACTLY the sequential loop's per-component skip rules, then
 * expanding each surviving component across its methodologies' categories.
 * Returns the units plus the count of resume/unchanged skips (the
 * `skippedComponentCount` ride-along, with the same accounting as the loop).
 */
function deriveFanOutUnits(setup: IdentifierSetup): {
  units: FanOutUnit[];
  skippedComponentCount: number;
} {
  const { opts, componentContexts, skipNodeIds, dbIdToNodeId } = setup;
  const units: FanOutUnit[] = [];
  let skippedComponentCount = 0;

  // Retry-failed: re-run EXACTLY the prior run's failed pairs. We bypass
  // the full grid expansion and the skip-set (a unit that errored last time
  // has no analysisHash to skip on) but still drop any pair whose component is
  // no longer in the model — the model may have changed since the first run.
  if (opts.retryUnits?.length) {
    const knownIds = new Set(componentContexts.map((c) => c.id));
    // Regroup the failed (component, category) pairs into their fixed
    // chunks, so a retry sends the same chunk prompts as the first run (a lone
    // category runs the single-category path).
    const byComponent = new Map<string, Set<string>>();
    for (const u of opts.retryUnits) {
      if (!knownIds.has(u.componentId)) continue;
      const set = byComponent.get(u.componentId) ?? new Set<string>();
      set.add(u.category);
      byComponent.set(u.componentId, set);
    }
    for (const [componentId, wanted] of byComponent) {
      const methodologies = new Set(
        [...wanted].map((c) => methodologyForCategory(c)),
      );
      for (const methodology of methodologies) {
        for (const chunk of chunkCategories(
          getCategoriesForMethodology(methodology),
        )) {
          const cats = chunk.filter((c) => wanted.has(c));
          if (cats.length > 0) {
            units.push({ componentId, category: cats[0], categories: cats });
          }
        }
      }
    }
    return { units, skippedComponentCount: 0 };
  }

  for (const compCtx of componentContexts) {
    if (opts.resumeFrom?.completedComponentIds.has(compCtx.id)) {
      skippedComponentCount++;
      continue;
    }
    const nodeId = dbIdToNodeId.get(compCtx.id);
    if (
      opts.componentNodeIds?.length &&
      nodeId &&
      !opts.componentNodeIds.includes(nodeId)
    ) {
      continue;
    }
    if (opts.mitigationsOnly) continue;
    if (nodeId && skipNodeIds.has(nodeId)) {
      skippedComponentCount++;
      continue;
    }
    const restrict = opts.categories;
    for (const methodology of opts.methodologies) {
      const allCats = getCategoriesForMethodology(methodology);
      // One unit per fixed chunk (same partition as the sequential
      // path, taken over the full list and filtered after).
      for (const chunk of chunkCategories(allCats)) {
        const cats = restrict?.length
          ? chunk.filter((c) => restrict.includes(c))
          : chunk;
        if (cats.length > 0) {
          units.push({
            componentId: compCtx.id,
            category: cats[0],
            categories: cats,
          });
        }
      }
    }
  }
  return { units, skippedComponentCount };
}

/**
 * Fan-out threats in the sequential loop's order: component (as listed), then
 * methodology (as requested), then category (methodology order). Stable, so
 * a child's own threat order is kept; unknown components/categories go last.
 */
export function sequentialThreatOrder(
  threats: readonly MicroThreat[],
  componentIds: readonly string[],
  methodologies: readonly MicroAnalysisOptions["methodologies"][number][],
): MicroThreat[] {
  const compRank = new Map(componentIds.map((id, i) => [id, i]));
  const catRank = new Map<string, number>();
  methodologies.forEach((m, mi) =>
    getCategoriesForMethodology(m).forEach((c, ci) =>
      catRank.set(c, mi * 1000 + ci),
    ),
  );
  const rank = (t: MicroThreat) => [
    compRank.get(t.componentId) ?? componentIds.length,
    catRank.get(t.category) ?? Number.MAX_SAFE_INTEGER,
  ];
  return threats
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((x) => x.t);
}

/**
 * Fan-out execution path. Enqueues one ai-fast child per surviving
 * (component, category), aggregates child results, streaming-persists per
 * component, then runs the SAME supplemental/compound sub-steps and returns
 * the SAME output shape as the sequential path. Children never persist (the
 * single persist is here — job contract); aggregation is order-
 * independent so child completion order never affects the result (§2.7).
 */
async function runFanOutPath(
  ctx: StageContext,
  inputs: ThreatIdentifierInputs,
  setup: IdentifierSetup,
  styledAiCall: import("../micro-analysis/types.js").AICallFn,
  report: (phase: string, detail: string) => void,
): Promise<StageResult> {
  const { context, persist } = inputs;
  const { opts, componentContexts, dbIdToNodeId } = setup;
  const { units, skippedComponentCount } = deriveFanOutUnits(setup);

  const fan = await runThreatIdentifierFanOut({
    executionId: ctx.executionId,
    threatModelId: ctx.threatModelId,
    organizationId: ctx.organizationId,
    sessionId: ctx.sessionId,
    units,
    signal: ctx.signal,
    onUnitDone: async (done, total) => {
      // Component/category progress → 5 + (done/total)×70.
      const pct = total > 0 ? 5 + Math.round((done / total) * 70) : 75;
      await ctx.progress(pct, `Fan-out: ${done}/${total} units complete`);
    },
  });

  // Children finish in any order; put their threats back in the sequential
  // loop's order so the compound prompt (which lists the first 20 findings)
  // is the same, deterministic prompt on both paths.
  const fanThreats = sequentialThreatOrder(
    fan.threats,
    componentContexts.map((c) => c.id),
    opts.methodologies,
  );
  const allThreats: MicroThreat[] = opts.resumeFrom
    ? [...opts.resumeFrom.seedThreats, ...fanThreats]
    : fanThreats;
  const allParseFailures: ParseFailure[] = [...fan.parseFailures];

  // Single persist (parent-side). Group child threats by component and write
  // each group exactly as the sequential streaming persist does, then mark the
  // component analyzed. Methodology label is recovered per-threat's category.
  if (persist) {
    const byComponent = new Map<string, MicroThreat[]>();
    for (const t of fan.threats) {
      const cid = (t as { componentId?: string }).componentId;
      if (!cid) continue;
      const arr = byComponent.get(cid) ?? [];
      arr.push(t);
      byComponent.set(cid, arr);
    }
    const assertUnderCap = createEmissionCapTracker();
    for (const compCtx of componentContexts) {
      const threats = byComponent.get(compCtx.id);
      if (!threats?.length) continue;
      const nodeId = dbIdToNodeId.get(compCtx.id);
      assertUnderCap(compCtx.id, compCtx.name, threats.length);
      await streamPersistThreats(
        persist,
        threats,
        nodeId,
        (threats[0] as { sourceMethodology?: string }).sourceMethodology ??
          opts.methodologies[0],
        compCtx.name,
        report,
        opts.onComponentPersisted,
      );
      if (nodeId) await markComponentAnalyzed(persist.threatModelId, nodeId);
    }
  }
  if (opts.onCheckpoint) await opts.onCheckpoint("fan-out", [...allThreats]);

  report(
    "components_done",
    `${allThreats.length} threats from ${units.length} fan-out units`,
  );

  // Supplemental + compound sub-steps — SAME order/gating as the loop.
  const { attackChains, compoundThreats } =
    await runSupplementalAndCompoundSubSteps(
      persist,
      styledAiCall,
      context,
      allThreats,
      allParseFailures,
      report,
    );

  const failedUnits: FanOutFailedUnit[] = fan.failedUnits;
  return {
    outputs: {
      threats: [...allThreats, ...compoundThreats],
      parseFailures: allParseFailures,
      attackChains,
      llmCalls: fan.llmCalls + 1, // +1 for the compound sub-step call
      skippedComponentCount,
      failedUnits,
      fanOutUnitCount: units.length,
    },
    tokensUsed: 0,
    parseFailures: allParseFailures,
  };
}
