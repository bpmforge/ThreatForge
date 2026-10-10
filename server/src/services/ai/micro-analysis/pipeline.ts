/**
 * Micro-Analysis Pipeline
 *
 * Top-level orchestrator that ties everything together:
 * 1. Convert ThreatModelContext → ComponentContext for each component
 * 2. Run per-component, per-category analysis (sequential)
 * 3. Run cross-component compound analysis
 * 4. Calibrate severities with full context
 * 5. Return consolidated results
 */
import { parseStringArray } from "../../../utils/safe-json.js";
import type { PrismaClient } from "@prisma/client";
import type {
  ThreatModelContext,
  AIProviderClient,
} from "../../../types/ai.js";
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import { getPrisma } from "../../../db.js";
import { analyzeComponent } from "./component-analyzer.js";
import type { GenerationStage } from "../generation-settings.js";
import { mitigationKey, runMitigationPass } from "./mitigation-pass.js";
import {
  generateSupplyChainThreats,
  generateMLThreats,
} from "./supplemental-threats.js";
import { analyzeCompoundThreats } from "./compound-analyzer.js";
import { describeInference, type RoleInference } from "./role-inference.js";
import { calibrateSeverities } from "./severity-calibrator.js";
import { isExternalEnrichmentAllowed } from "../../vuln-intel/enrichment-gate.js";
import {
  persistAIThreats,
  getReviewedThreats,
} from "../../threat-review/review-service.js";
import { normalizeThreatName } from "../../threat-review/normalize-threat-name.js";
import {
  detectDuplicates,
  type DetectorThreat,
} from "../dedup/duplicate-detector.js";
import {
  guardOutcome,
  LLM_ACCEPT_FLOOR,
  runDuplicateGuard,
  type GuardMerge,
} from "../dedup/duplicate-guard.js";
import { persistSharedControls } from "../dedup/shared-controls.js";
import { applyConfidenceFloor } from "./confidence-floor.js";
import type {
  AICallFn,
  MicroAnalysisOptions,
  MicroAnalysisResult,
  MicroThreat,
} from "./types.js";
import { DEFAULT_OPTIONS } from "./types.js";
import {
  getUserWritingStyle,
  type UserWritingStyle,
} from "../universal-system-prompt.js";
import logger from "../../../utils/logger.js";
import {
  computeDeadlineAt,
  isPastDeadline,
  reportDeadlineStop,
} from "../job-deadline.js";

/**
 * Pipeline-level anomaly cap (max threats one component may emit in a
 * single run). Exported so the ThreatIdentifier stage handler (stages/) uses
 * the SAME cap as this legacy loop.
 */
export const PIPELINE_COMPONENT_CAP = 40;

/**
 * Final-persist bookkeeping shared with jobs/suggest-threats-v2-finalize.ts.
 * review-service.ts's MAX_THREATS_PER_COMPONENT_PER_RUN returns a
 * success-shaped { created: 0, updated: 0, skipped: n, capped: true } when it
 * refuses the whole batch; record that as a "component-cap" parse failure
 * (otherwise the run silently completes having written none of its deduped
 * output) and report the persist outcome.
 */
export function reportFinalPersist(
  persistResult: {
    capped?: boolean;
    created: number;
    updated: number;
    skipped: number;
  },
  dedupedCount: number,
  parseFailures: import("./types.js").ParseFailure[],
  report: (phase: string, detail: string) => void,
): void {
  if (persistResult.capped) {
    parseFailures.push({
      stage: "component-cap",
      index: 0,
      error: `Final persist refused for the whole run: ${dedupedCount} threats generated but 0 persisted (review-service.ts MAX_THREATS_PER_COMPONENT_PER_RUN).`,
    });
  }
  report(
    "persist",
    persistResult.capped
      ? `Threat cap hit — 0 of ${dedupedCount} persisted at final write, recorded as a failure`
      : `Created ${persistResult.created}, updated ${persistResult.updated}, skipped ${persistResult.skipped} (human-reviewed or linked to an existing duplicate)`,
  );
}

/**
 * Dedup loser marking.
 *
 * Streaming persist writes every threat as it's generated so the UI can
 * show progress. The LLM dedup pass (llm-dedup.ts) then picks canonical
 * representatives from each paraphrase cluster; the losers remain in the DB
 * from the streaming write but never get updated with mitigations (since
 * final persist only loops over the deduped set). This used to `deleteMany`
 * those rows — destructive: a wrong LLM dedup decision permanently lost a
 * finding with no recovery path. Marking them instead means a human
 * reviewer can still see and recover a row the dedup pass collapsed, and
 * nothing is destroyed if the dedup call was wrong.
 *
 * Safety filters (same scope the deletion this replaces used):
 *   - Scope to this session only (don't touch prior runs' data)
 *   - Only PENDING AI_SUGGESTED rows (human decisions are sacred)
 *   - manuallyEdited=false (edits are sacred)
 *
 * Duplicate guard: a loser is marked ONLY when the detector confirms it.
 *   - A loser the guard merged (`guardMerges`) is pointed at its exact
 *     survivor, following merge chains (A → B → C marks A and B with C).
 *   - Any other loser was dropped by the LLM dedup pass, which has no
 *     similarity floor. It is marked only when the detector scores it at or
 *     above LLM_ACCEPT_FLOOR against a survivor on the same target, and is
 *     then pointed at the best-scoring survivor (not "the first one found").
 *     Below the floor the row is left unmarked — it stays an ordinary
 *     PENDING threat — and is returned in `unconfirmed` for the job result.
 * We never fabricate a winner id and never delete.
 *
 * `nodeIdScope`, when supplied, restricts the session-rows lookup to those
 * componentNodeIds — mirrors suggest-threats-v2-finalize.ts's retry-scope
 * guard: on a retry-failed run `deduped` only covers the retried
 * units, so sweeping the whole session would misclassify prior survivors on
 * OTHER components as losers.
 *
 * Exported for unit testing in isolation from the rest of the pipeline, and
 * so suggest-threats-v2-finalize.ts (the v2/unified-worker port of this
 * same block) can call the identical implementation instead of maintaining
 * a second copy of this logic.
 */
export async function markDedupLosers(params: {
  threatModelId: string;
  sessionId: string;
  deduped: MicroThreat[];
  dbIdToNodeId: Map<string, string>;
  /** Optional Prisma client override — callers with one already in scope
   *  (e.g. finalize.ts) should pass it instead of a second getPrisma(). */
  prisma?: PrismaClient;
  /** Restrict the session-rows lookup to these componentNodeIds. */
  nodeIdScope?: Set<string> | null;
  /** Merges the duplicate guard made in memory (exact attribution). */
  guardMerges?: GuardMerge[];
  report?: (phase: string, detail: string) => void;
}): Promise<{
  marked: number;
  unconfirmed: Array<{ threatId: string; name: string }>;
}> {
  const { threatModelId, sessionId, deduped, dbIdToNodeId, nodeIdScope } =
    params;
  const report = params.report || (() => {});
  const prisma = params.prisma ?? (await getPrisma());

  // Keys use the same composite shape as the DB unique index:
  // (componentNodeId | connectionEdgeId | '__compound__', normalizedName).
  const keyOf = (componentId: string, name: string) => {
    const nodeId = componentId
      ? dbIdToNodeId.get(componentId) || componentId
      : "";
    return `${nodeId || "__compound__"}::${normalizeThreatName(name)}`;
  };
  const survivorKeys = new Set(
    deduped.map((t) => keyOf(t.componentId, t.name)),
  );

  // Guard merges: loser key → survivor key, resolved through chains.
  const mergedInto = new Map<string, string>();
  for (const m of params.guardMerges ?? []) {
    mergedInto.set(
      keyOf(m.loser.componentId, m.loser.name),
      keyOf(m.survivor.componentId, m.survivor.name),
    );
  }
  const finalSurvivorKey = (key: string): string | undefined => {
    const seen = new Set<string>();
    let k: string | undefined = key;
    while (k && mergedInto.has(k) && !seen.has(k)) {
      seen.add(k);
      k = mergedInto.get(k);
    }
    return k && survivorKeys.has(k) ? k : undefined;
  };

  const sessionRows = await prisma.threat.findMany({
    where: {
      threatModelId,
      analysisSessionId: sessionId,
      source: "AI_SUGGESTED",
      reviewStatus: "PENDING",
      manuallyEdited: false,
      ...(nodeIdScope ? { componentNodeId: { in: [...nodeIdScope] } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      strideCategories: true,
      cweIds: true,
      componentNodeId: true,
      connectionEdgeId: true,
      normalizedName: true,
    },
  });

  type Row = (typeof sessionRows)[number];
  const rowKey = (r: Row) => {
    const target = r.componentNodeId || r.connectionEdgeId || "__compound__";
    return { target, key: `${target}::${r.normalizedName ?? ""}` };
  };
  const toDetector = (r: Row): DetectorThreat => ({
    id: r.id,
    name: r.name ?? r.normalizedName ?? "",
    description: r.description,
    targetId: rowKey(r).target,
    categories: parseStringArray(r.strideCategories),
    cweIds: parseStringArray(r.cweIds),
    mitigations: [],
    source: "ai",
  });

  const survivorRowByKey = new Map<string, Row>();
  const survivorsByTarget = new Map<string, Row[]>();
  for (const r of sessionRows) {
    const { target, key } = rowKey(r);
    if (!survivorKeys.has(key)) continue;
    if (!survivorRowByKey.has(key)) survivorRowByKey.set(key, r);
    survivorsByTarget.set(target, [
      ...(survivorsByTarget.get(target) ?? []),
      r,
    ]);
  }

  const losers = sessionRows.filter((r) => !survivorKeys.has(rowKey(r).key));
  if (losers.length === 0) return { marked: 0, unconfirmed: [] };

  const losersByWinner = new Map<string, string[]>();
  const unattributed: string[] = [];
  const unconfirmed: Array<{ threatId: string; name: string }> = [];
  for (const r of losers) {
    const { target, key } = rowKey(r);
    let winnerId: string | undefined;
    const guardKey = finalSurvivorKey(key);
    if (guardKey) {
      winnerId = survivorRowByKey.get(guardKey)?.id;
    } else {
      const candidates = survivorsByTarget.get(target) ?? [];
      if (candidates.length === 0) {
        unattributed.push(r.id);
        continue;
      }
      const best = detectDuplicates(
        [toDetector(r), ...candidates.map(toDetector)],
        { includeDistinct: true },
      ).find(
        (p) =>
          (p.a === r.id || p.b === r.id) &&
          !p.reasons.includes("actor-direction-differs"),
      );
      if (best && best.score >= LLM_ACCEPT_FLOOR) {
        winnerId = best.a === r.id ? best.b : best.a;
      } else {
        unconfirmed.push({ threatId: r.id, name: r.name ?? "" });
        continue;
      }
    }
    if (!winnerId) {
      unattributed.push(r.id);
      continue;
    }
    losersByWinner.set(winnerId, [
      ...(losersByWinner.get(winnerId) ?? []),
      r.id,
    ]);
  }

  if (unattributed.length > 0) {
    logger.warn(
      { threatModelId, sessionId, unattributedIds: unattributed },
      "loser marking — no surviving row found for this target; leaving these rows unmarked (not deleted)",
    );
  }
  if (unconfirmed.length > 0) {
    logger.info(
      { threatModelId, sessionId, unconfirmed: unconfirmed.length },
      "loser marking — LLM dedup merges the detector could not confirm; rows left as independent threats",
    );
  }

  let marked = 0;
  for (const [winnerId, ids] of losersByWinner) {
    const result = await prisma.threat.updateMany({
      where: { id: { in: ids } },
      data: { dedupSupersededById: winnerId },
    });
    marked += result.count;
  }

  report(
    "persist",
    `Marked ${marked} duplicate rows (kept, not deleted); ${unconfirmed.length} LLM merges not confirmed`,
  );
  logger.info(
    { threatModelId, sessionId, marked, survivors: deduped.length },
    "loser marking",
  );
  return { marked, unconfirmed };
}

/**
 * Thrown when every unit attempted in this run failed (provider down
 * for the whole run), so the run produced zero new threats. Carries a
 * `.code` so callers (ai-worker.ts) can recognise it without an import
 * cycle and skip cleanupSessionThreats: since nothing was persisted under
 * this run's session, there is nothing of THIS run to clean up.
 */
class AllUnitsFailedError extends Error {
  readonly code = "ALL_UNITS_FAILED" as const;
  constructor(message: string) {
    super(message);
    this.name = "AllUnitsFailedError";
  }
}

/**
 * Thrown by assertUnderCap when a single component's emissions for
 * this run cross PIPELINE_COMPONENT_CAP. Earlier components in this same
 * run (and any prior run) were already stream-persisted before this throw
 * fires, so — like AllUnitsFailedError — ai-worker.ts recognises this
 * error's `.code` and skips cleanupSessionThreats: the cap exists to stop
 * ONE runaway component from ballooning, not to justify deleting every
 * component this run (or a prior one) already wrote successfully.
 */
class ComponentCapExceededError extends Error {
  readonly code = "COMPONENT_CAP_EXCEEDED" as const;
  constructor(message: string) {
    super(message);
    this.name = "ComponentCapExceededError";
  }
}

interface ComponentAnalysisState {
  nodeId: string;
  analysisHash: string | null;
  analyzedAt: Date | null;
}

/**
 * Returns nodeIds of components that can be skipped because their hash
 * matches the last successful analysis. Always returns empty when `force` is true.
 */
export async function buildSkipSet(
  threatModelId: string,
  force: boolean,
): Promise<Set<string>> {
  if (force) return new Set();
  const prisma = await getPrisma();
  const components = (await prisma.component.findMany({
    where: { threatModelId },
    select: { nodeId: true, analysisHash: true, analyzedAt: true },
  })) as ComponentAnalysisState[];
  const skip = new Set<string>();
  for (const c of components) {
    // Skip iff hash is set AND analyzedAt is set (canvas-sync clears analyzedAt
    // whenever the hash changes, so analyzedAt being non-null is the
    // authoritative "this exact hash was already analyzed" signal).
    if (c.analysisHash && c.analyzedAt) skip.add(c.nodeId);
  }
  return skip;
}

/**
 * Run the full micro-analysis pipeline.
 *
 * @param context — Threat model context from the database
 * @param aiCall — LLM call function (optional — falls back to rule-based)
 * @param options — Methodology, confidence thresholds, progress callback
 * @param persist — If provided, persist threats to DB with human-in-the-loop support.
 *                  Optional `verifyClient` enables citation verification on persist.
 */
export async function runMicroAnalysis(
  context: ThreatModelContext,
  aiCall?: AICallFn,
  options?: Partial<MicroAnalysisOptions>,
  persist?: {
    threatModelId: string;
    userId: string;
    verifyClient?: AIProviderClient;
    /**
     * Analysis session id — typically aiJob.id. Every persisted Threat row
     * gets this in `analysisSessionId` so failure/startup cleanup can
     * atomically remove partial writes without affecting human-reviewed rows.
     */
    sessionId?: string;
  },
): Promise<MicroAnalysisResult> {
  const startTime = Date.now();
  const opts: MicroAnalysisOptions = { ...DEFAULT_OPTIONS, ...options };
  const report = opts.onProgress || (() => {});
  let totalLlmCalls = 0;

  // --- Load user writing style preferences (separate for threats vs mitigations) ---
  let threatStyle: UserWritingStyle | undefined;
  let mitigationStyle: UserWritingStyle | undefined;
  if (persist?.userId) {
    [threatStyle, mitigationStyle] = await Promise.all([
      getUserWritingStyle(persist.userId, "threats"),
      getUserWritingStyle(persist.userId, "mitigations"),
    ]);
  }

  // Wrap aiCall to inject writing style into system prompt
  const styledAiCall: AICallFn | undefined = aiCall
    ? threatStyle?.enabled
      ? async (system: string, user: string, stage?: GenerationStage) => {
          const styleSuffix = buildStyleSuffix(threatStyle!);
          return aiCall(system + styleSuffix, user, stage);
        }
      : aiCall
    : undefined;

  // Separate wrapper for mitigation generation
  const mitigationAiCall: AICallFn | undefined = aiCall
    ? mitigationStyle?.enabled
      ? async (system: string, user: string, stage?: GenerationStage) => {
          const styleSuffix = buildStyleSuffix(mitigationStyle!);
          return aiCall(system + styleSuffix, user, stage);
        }
      : aiCall
    : undefined;

  // --- Build ComponentContext for each component ---
  const componentContexts = context.components.map((comp) =>
    toComponentContext(comp, context),
  );

  report(
    "init",
    `Starting micro-analysis: ${componentContexts.length} components × ${opts.methodologies.join("+")}`,
  );

  // --- Extract sequence flows per component (no LLM) ---
  const componentSequenceFlows = new Map<
    string,
    Array<{
      from: string;
      to: string;
      label: string;
      protocol?: string;
      authentication?: string;
    }>
  >();
  if (context.sequenceFlows) {
    for (const flow of context.sequenceFlows) {
      for (const msg of flow.messages) {
        // Map messages to components by name match
        for (const comp of context.components) {
          if (msg.from === comp.name || msg.to === comp.name) {
            const existing = componentSequenceFlows.get(comp.id) || [];
            existing.push(msg);
            componentSequenceFlows.set(comp.id, existing);
          }
        }
      }
    }
  }

  // --- Build set of unchanged components to skip ---
  const skipNodeIds = persist
    ? await buildSkipSet(persist.threatModelId, opts.force ?? false)
    : new Set<string>();

  // Map: DB componentId → nodeId (for matching against skipNodeIds)
  const dbIdToNodeId = new Map<string, string>();
  const nodeIdToDbId = new Map<string, string>();
  if (persist) {
    const prisma = await getPrisma();
    const comps = await prisma.component.findMany({
      where: { threatModelId: persist.threatModelId },
      select: { id: true, nodeId: true },
    });
    for (const c of comps) {
      dbIdToNodeId.set(c.id, c.nodeId);
      nodeIdToDbId.set(c.nodeId, c.id);
    }
  }

  // --- Load human-reviewed threats (respect prior decisions) ---
  //
  // Threats a human explicitly REJECTED must not be regenerated on later
  // runs. The prompt has a "previously refuted — do not re-propose" block
  // (buildRefutedBlock) fed by opts.refutedThreats; this feeds it from the
  // human decisions.
  //
  // ID-space hazard: getReviewedThreats returns componentNodeId (canvas id)
  // while refutedThreats is keyed by ComponentContext.id (DB cuid). The
  // translation through nodeIdToDbId is required — keying on the raw nodeId
  // would silently match nothing.
  const humanRefuted: Record<
    string,
    Array<{ name: string; reason?: string }>
  > = {};
  if (persist) {
    const reviewed = await getReviewedThreats(persist.threatModelId);
    const rejected = reviewed.filter((r) => r.reviewStatus === "REJECTED");
    let keyed = 0;
    let unmatched = 0;
    for (const r of rejected) {
      const dbId = r.componentNodeId
        ? nodeIdToDbId.get(r.componentNodeId)
        : undefined;
      if (!dbId) {
        unmatched++;
        continue;
      }
      const key = `${dbId}::${r.category}`;
      (humanRefuted[key] ??= []).push({
        name: r.name,
        // reviewNotes is the reviewer explaining WHY. It is the most useful
        // sentence available and was previously never read.
        ...(r.reviewNotes ? { reason: r.reviewNotes } : {}),
      });
      keyed++;
    }
    if (reviewed.length > 0) {
      report(
        "context",
        `Loaded ${reviewed.length} human-reviewed threats; ${keyed} rejections fed back to the model`,
      );
      logger.info(
        {
          reviewed: reviewed.length,
          rejected: rejected.length,
          keyed,
          unmatched,
        },
        "Loaded reviewed threats for AI context",
      );
      // A rejection that cannot be keyed is a rejection silently ignored, which
      // is the bug this fixes wearing a different hat. Say so.
      if (unmatched > 0) {
        logger.warn(
          { unmatched },
          "Rejected threats could not be mapped to a component and will not suppress regeneration",
        );
      }
    }
  }

  let skippedComponentCount = 0;

  // --- Per-component analysis (sequential) ---
  const allParseFailures: import("./types.js").ParseFailure[] = [];
  const roleInferences: RoleInference[] = [];

  // Pipeline-level anomaly cap. Per-batch cap in persistAIThreats
  // catches single-call LLM hallucinations; this tracker catches the
  // *other* direction — many small batches compounding within one run.
  // Throws on exceed → fail handler → cleanupSessionThreats wipes the
  // partial writes tagged with this run's sessionId.
  const emissionsByComponent = new Map<string, number>();
  const assertUnderCap = (compKey: string, compName: string) => {
    const total = emissionsByComponent.get(compKey) ?? 0;
    if (total > PIPELINE_COMPONENT_CAP) {
      throw new ComponentCapExceededError(
        `Anomaly cap exceeded: component "${compName}" emitted ${total} ` +
          `threats in this run (cap: ${PIPELINE_COMPONENT_CAP}). Aborting ` +
          `to prevent runaway accumulation — check micro-analysis loop settings. ` +
          `Threats already persisted for other components this run are unaffected.`,
      );
    }
  };

  // Seed threats from checkpoint if resuming
  const allThreats: MicroThreat[] = opts.resumeFrom
    ? [...opts.resumeFrom.seedThreats]
    : [];

  // MITIGATIONS-ONLY: pre-seed allThreats from existing DB threats so the
  // mitigation pass below runs against them without re-running threat analysis.
  if (opts.mitigationsOnly && persist) {
    const prisma = await getPrisma();
    const existing = await prisma.threat.findMany({
      where: {
        threatModelId: persist.threatModelId,
        reviewStatus: "PENDING",
        manuallyEdited: false,
        ...(opts.componentNodeIds?.length
          ? { componentNodeId: { in: opts.componentNodeIds } }
          : {}),
      },
    });
    for (const t of existing) {
      const componentId =
        (t.componentNodeId ? nodeIdToDbId.get(t.componentNodeId) : undefined) ??
        t.componentNodeId ??
        "";
      allThreats.push({
        name: t.name,
        description: t.description ?? "",
        category: (() => {
          try {
            return JSON.parse(t.strideCategories as string)[0] ?? "TAMPERING";
          } catch {
            return "TAMPERING";
          }
        })(),
        severity: t.severity as MicroThreat["severity"],
        componentId,
        componentName: "",
        cweIds: (() => {
          try {
            return JSON.parse(t.cweIds as string);
          } catch {
            return [];
          }
        })(),
        owaspIds: (() => {
          try {
            return JSON.parse(t.owaspIds as string);
          } catch {
            return [];
          }
        })(),
        evidence: (() => {
          try {
            return t.evidence ? JSON.parse(t.evidence as string) : {};
          } catch {
            return {};
          }
        })(),
        mitigations: [],
        mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
        confidence: (t.aiConfidence as number | null) ?? 0.7,
        sourceMethodology: (t.aiMethodology as string | null) ?? "stride",
      });
    }
    report(
      "mitigations",
      `Mitigations-only mode: loaded ${allThreats.length} existing threats`,
    );
  }

  let deadlineStopped = false;
  let componentsAnalyzed = 0;
  // Threats actually produced by THIS run's generation loop (excludes
  // resumeFrom seeds and the mitigationsOnly pre-seed, which aren't new
  // work). Zero of these plus at least one parse failure means every
  // attempted unit failed — see the AllUnitsFailedError throw below.
  let newThreatsGenerated = 0;
  // Fall back to a locally-computed budget when the caller supplies none, so a
  // future caller cannot silently disable the time bound by omitting it.
  const effectiveDeadlineAt = opts.deadlineAt ?? computeDeadlineAt(Date.now());
  for (const compCtx of componentContexts) {
    // Check for cancellation before starting each component
    if (opts.cancelSignal?.cancelled) {
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
          "runMicroAnalysis",
          componentsAnalyzed,
          componentContexts.length - componentsAnalyzed,
          effectiveDeadlineAt,
        ),
      );
      break;
    }
    componentsAnalyzed++;

    // Skip components already completed in a prior run (checkpoint or incremental)
    if (opts.resumeFrom?.completedComponentIds.has(compCtx.id)) {
      skippedComponentCount++;
      report("component", `Skipping ${compCtx.name} (already done)`);
      continue;
    }

    // SCOPE: skip components not in the requested set
    const nodeId = dbIdToNodeId.get(compCtx.id);
    if (
      opts.componentNodeIds?.length &&
      nodeId &&
      !opts.componentNodeIds.includes(nodeId)
    ) {
      continue;
    }

    // SCOPE: skip the entire threat-generation pass if mitigations-only
    if (opts.mitigationsOnly) continue;

    // Skip components whose hash hasn't changed since last analysis
    if (nodeId && skipNodeIds.has(nodeId)) {
      skippedComponentCount++;
      report(
        "component",
        `Skipping ${compCtx.name} (unchanged since last analysis)`,
      );
      continue;
    }

    // True if any unit for this component recorded a failure.
    // Guards the analyzedAt stamp below — a failed unit must be
    // re-analysed next run, not skipped forever by buildSkipSet.
    let componentHadFailures = false;

    for (const methodology of opts.methodologies) {
      if (!styledAiCall) break;

      report("component", `Analyzing ${compCtx.name} (${methodology})...`);

      // Get sequence flows involving this component
      const flows = componentSequenceFlows.get(compCtx.id);

      const { threats, llmCalls, parseFailures, roleInference } =
        await analyzeComponent(
          styledAiCall,
          compCtx,
          methodology,
          // Merge human rejections into the per-round refuted set. Existing
          // entries win on key collision — a threat refuted by the verifier in
          // THIS run is at least as current as a past human decision, and the
          // arrays are concatenated rather than replaced so neither is lost.
          mergeRefuted(opts, humanRefuted),
          flows,
        );
      allThreats.push(...threats);
      allParseFailures.push(...parseFailures);
      totalLlmCalls += llmCalls;
      if (threats.length > 0) newThreatsGenerated += threats.length;
      if (parseFailures.length > 0) componentHadFailures = true;

      // A guess that changes which weaknesses the model is shown must be
      // visible as a guess. Reported on the progress stream AND carried in the
      // result, so it reaches both the live job view and anything reading the
      // summary afterwards.
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

      // Pipeline-level cap — count emissions across all category calls
      // for this component. Throws if the running total crosses the cap;
      // cleanupSessionThreats (via the failure handler) wipes the partial
      // writes so the DB returns to a consistent state.
      emissionsByComponent.set(
        compCtx.id,
        (emissionsByComponent.get(compCtx.id) ?? 0) + threats.length,
      );
      assertUnderCap(compCtx.id, compCtx.name);

      // STREAMING PERSIST: write threats immediately so the UI shows results
      // as each component completes. Mitigations + calibration will UPDATE
      // these rows later via the final persistAIThreats call at the end.
      if (persist && threats.length > 0) {
        const streamResult = await persistAIThreats(
          persist.threatModelId,
          persist.userId,
          threats,
          undefined, // skip citation verification on streaming write
          { componentNodeId: nodeId, methodology },
          persist.sessionId,
        );
        // MAX_THREATS_PER_COMPONENT_PER_RUN in review-service.ts
        // returns a success-shaped { created:0, updated:0, skipped:n,
        // capped:true } when it refuses the whole batch. Left unchecked,
        // this loop reports "Persisted" and (below) stamps analyzedAt as
        // if the batch had succeeded, permanently losing the recall for a
        // component that emitted nothing. Record it as a failure for this
        // component instead: skip the analyzedAt stamp (componentHadFailures)
        // so the next run retries it, and surface it in parseFailures so the
        // job summary is not silently COMPLETED.
        if (streamResult.capped) {
          componentHadFailures = true;
          allParseFailures.push({
            stage: "component-cap",
            component: compCtx.name,
            category: methodology,
            index: 0,
            error: `Threat-persistence cap hit for "${compCtx.name}" (${methodology}): ${threats.length} threats generated but 0 persisted (review-service.ts MAX_THREATS_PER_COMPONENT_PER_RUN).`,
          });
          report(
            "component",
            `Threat cap hit for ${compCtx.name} (${methodology}) — 0 of ${threats.length} persisted, recorded as a failure`,
          );
        } else {
          report(
            "component",
            `Persisted ${threats.length} threats for ${compCtx.name} (${methodology})`,
          );
        }
        if (nodeId) {
          opts.onComponentPersisted?.(nodeId, streamResult);
        }
      }
    }

    // Mark this component as analyzed so the next run can skip it if unchanged.
    // NOT when a unit failed — stamping analyzedAt here would make
    // buildSkipSet treat this component as "already analyzed" and skip it
    // forever (until force/canvas edit), permanently losing the recall a
    // transient provider failure should only have delayed by one run.
    if (persist && nodeId && !componentHadFailures) {
      const prisma = await getPrisma();
      // updateMany silently skips if the component was deleted between
      // queue-time and analysis-completion (e.g. user deleted the model).
      // Using update() throws P2025, which is noisy and not actionable.
      await prisma.component.updateMany({
        where: { threatModelId: persist.threatModelId, nodeId },
        data: { analyzedAt: new Date() },
      });
    }

    // Checkpoint after each component so a retry can resume here
    if (opts.onCheckpoint) {
      await opts.onCheckpoint(compCtx.id, [...allThreats]);
    }
  }

  report(
    "components_done",
    `${allThreats.length} threats from ${componentContexts.length} components`,
  );

  // Every unit this run attempted failed at the PROVIDER CALL itself
  // (provider down for the whole run) — zero new threats AND at least one
  // provider-failure record. Scoped to "provider-failure" specifically
  // (not "threat-generation", which also covers a successful call whose
  // JSON happened to fail schema validation) so an isolated malformed-output
  // hiccup does not fail the whole run — only a provider that never
  // recovers does. Complete the run as FAILED rather than silently
  // succeeding with nothing.
  // Safe to throw here: nothing from THIS run was streamed to the DB (the
  // per-methodology persist above only fires when threats.length > 0), so
  // there is nothing of this run's for cleanupSessionThreats to wipe —
  // ai-worker.ts additionally recognises this error's `.code` and skips
  // that cleanup call outright rather than relying on it being a no-op.
  const providerFailureCount = allParseFailures.filter(
    (f) => f.stage === "provider-failure",
  ).length;
  if (
    !opts.mitigationsOnly &&
    newThreatsGenerated === 0 &&
    providerFailureCount > 0
  ) {
    throw new AllUnitsFailedError(
      `Micro-analysis produced no threats: all ${providerFailureCount} ` +
        "attempted unit(s) failed (provider errors). Prior threats are unaffected.",
    );
  }

  // Mitigations run after dedup and the confidence floor (below), on
  // the identification threats that survive them, so no call is spent on a
  // threat that is then merged or dropped. Supplemental (supply-chain/ML) and
  // compound threats never got LLM mitigations here and still don't.
  const identificationKeys = new Set(allThreats.map(mitigationKey));

  // --- Supply chain + ML threats (rule-based, no LLM) ---
  if (persist) {
    report("supplemental", "Checking supply chain + ML threats...");
    const supplyChainThreats = await generateSupplyChainThreats(
      persist.threatModelId,
    );
    const mlThreats = await generateMLThreats(persist.threatModelId, context);
    if (supplyChainThreats.length > 0 || mlThreats.length > 0) {
      allThreats.push(...supplyChainThreats, ...mlThreats);
      report(
        "supplemental",
        `Added ${supplyChainThreats.length} supply chain + ${mlThreats.length} ML threats`,
      );
    }
  }

  // --- Cross-component compound analysis ---
  report("compound", "Analyzing cross-component attack chains...");

  const {
    attackChains,
    compoundThreats,
    parseFailures: compoundFailures,
  } = await analyzeCompoundThreats(
    styledAiCall,
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
  allParseFailures.push(...(compoundFailures ?? []));
  if (styledAiCall) totalLlmCalls++;

  // --- Severity calibration ---
  report("calibration", "Calibrating severities...");
  const combined = [...allThreats, ...compoundThreats];
  const epssEnabled = persist
    ? await isExternalEnrichmentAllowed(persist.threatModelId)
    : false;
  const calibrated = await calibrateSeverities(
    styledAiCall,
    combined,
    attackChains,
    { epssEnabled },
  );
  if (styledAiCall) totalLlmCalls++;

  // --- LLM semantic dedup pass (non-load-bearing) ---
  // Runs after exact-match dedup has already folded exact paraphrase variants. Catches
  // semantically-equivalent threats with divergent lexicon. Failure-safe:
  // any LLM / parse error falls back to the input unchanged.
  let deduped = calibrated;
  if (styledAiCall && calibrated.length >= 2) {
    try {
      const { dedupThreatsViaLLM } = await import("./llm-dedup.js");
      report("dedup", "LLM semantic dedup pass...");
      deduped = await dedupThreatsViaLLM(styledAiCall, calibrated, {
        onProgress: (phase, detail) => report(phase, detail),
      });
      // Rough bound — dedupThreatsViaLLM makes at most 1 call per component
      totalLlmCalls += new Set(calibrated.map((t) => t.componentId)).size;
    } catch (err) {
      logger.warn({ err }, "dedup failed; keeping calibrated set");
      deduped = calibrated;
    }
  }

  // --- Persistence-time confidence floor ---
  // Runs after dedup, right before persist, so counts/persisted rows/loser
  // cleanup below all agree on the same final set. Template threats
  // (supply-chain/ML) are exempt; see confidence-floor.ts.
  const { kept: floored, droppedCount: droppedLowConfidence } =
    applyConfidenceFloor(deduped, opts.minPersistConfidence);
  deduped = floored;

  // --- Mitigation generation pass (after dedup + floor, batched per component) ---
  if (mitigationAiCall && identificationKeys.size > 0) {
    const pass = await runMitigationPass({
      aiCall: mitigationAiCall,
      threats: deduped,
      isIdentification: (t) => identificationKeys.has(mitigationKey(t)),
      componentContexts,
      requirements: context.requirements,
      parseFailures: allParseFailures,
      report,
    });
    totalLlmCalls += pass.llmCalls;
  }

  // --- Duplicate guard (services/ai/dedup) — same position as the v2 tail
  // (floorAndMitigateV2Final): after the mitigation pass, before persist. ---
  // Mitigations-only mode re-mitigates EXISTING rows: merging two of them in
  // memory would silently skip the loser's refresh, so the guard stays off.
  const guard = await runDuplicateGuard(opts.mitigationsOnly ? [] : deduped, {
    aiCall: styledAiCall,
    report,
  });
  if (!opts.mitigationsOnly) deduped = guard.threats;
  totalLlmCalls += guard.metrics.llmCalls;
  let guardPersisted: Parameters<typeof guardOutcome>[1] = {};

  // --- Persist to database (human-in-the-loop) ---
  let persistResult: Awaited<ReturnType<typeof persistAIThreats>> | undefined;
  if (persist) {
    report(
      "persist",
      "Saving threats to database (respecting human reviews)...",
    );
    persistResult = await persistAIThreats(
      persist.threatModelId,
      persist.userId,
      deduped,
      persist.verifyClient,
      undefined, // no batch scope — final persist writes all
      persist.sessionId,
    );
    reportFinalPersist(persistResult, deduped.length, allParseFailures, report);

    // --- Dedup loser marking (never deletes; see markDedupLosers above) ---
    guardPersisted = { linked: persistResult.linked };
    if (persist.sessionId) {
      const { unconfirmed } = await markDedupLosers({
        threatModelId: persist.threatModelId,
        sessionId: persist.sessionId,
        deduped,
        dbIdToNodeId,
        guardMerges: guard.merges,
        report,
      });
      guardPersisted.unconfirmed = unconfirmed;
      await persistSharedControls({
        prisma: await getPrisma(),
        threatModelId: persist.threatModelId,
        sessionId: persist.sessionId,
        groups: guard.controlGroups,
        dbIdToNodeId,
        linked: persistResult.linked,
      });
    }
  }
  const dedupOutcome = guardOutcome(guard, guardPersisted);

  // --- Build summary (uses deduped set so counts match what was persisted) ---
  const categoryCoverage: Record<string, number> = {};
  for (const t of deduped) {
    categoryCoverage[t.category] = (categoryCoverage[t.category] || 0) + 1;
  }

  const coveredComponents = new Set(
    deduped
      .filter((t) => t.componentId !== "compound")
      .map((t) => t.componentId),
  );

  const result: MicroAnalysisResult = {
    threats: deduped.filter((t) => t.componentId !== "compound"),
    attackChains,
    compoundThreats: deduped.filter((t) => t.componentId === "compound"),
    parseFailures: allParseFailures,
    // Additive and only present when the guard found something, so a run with
    // nothing to report keeps the frozen result shape byte-identical.
    ...(dedupOutcome.report ? { dedup: dedupOutcome.report } : {}),
    summary: {
      totalThreats: deduped.length,
      componentsAnalyzed: componentContexts.length,
      categoriesPerComponent: opts.methodologies.reduce((sum, m) => {
        if (m === "stride") return sum + 6;
        if (m === "pasta") return sum + 8;
        if (m === "kill_chain") return sum + 6;
        return sum;
      }, 0),
      categoryCoverage,
      componentsCovered: coveredComponents.size,
      totalComponents: context.components.length,
      llmCalls: totalLlmCalls,
      duration: Date.now() - startTime,
      skippedComponentCount,
      parseFailures: allParseFailures.length,
      droppedLowConfidence,
      dedup: dedupOutcome.metrics,
      // Never let a time-bounded stop look like a complete run.
      ...(deadlineStopped ? { deadlineStopped: true } : {}),
      ...(roleInferences.length ? { roleInferences } : {}),
      ...(opts.tokenMeter ? { tokens: opts.tokenMeter.totals() } : {}),
    },
  };

  logger.info(
    {
      threats: result.summary.totalThreats,
      components: result.summary.componentsAnalyzed,
      covered: result.summary.componentsCovered,
      chains: attackChains.length,
      compounds: compoundThreats.length,
      llmCalls: totalLlmCalls,
      tokens: result.summary.tokens,
      duration: result.summary.duration,
    },
    "Micro-analysis pipeline complete",
  );

  report(
    "done",
    `${result.summary.totalThreats} threats, ${coveredComponents.size}/${context.components.length} components covered`,
  );

  return result;
}

/**
 * Merge human REJECTED threats into a round's refuted set.
 *
 * Both sources answer the same question — "do not propose this again" — so they
 * are concatenated per key rather than one overwriting the other. Returns the
 * original options object unchanged when there is nothing to merge, so the
 * common path allocates nothing and the prompt hash is untouched.
 */
export function mergeRefuted(
  options: MicroAnalysisOptions,
  human: Record<string, Array<{ name: string; reason?: string }>>,
): MicroAnalysisOptions {
  const keys = Object.keys(human);
  if (keys.length === 0) return options;
  const merged: Record<string, Array<{ name: string; reason?: string }>> = {
    ...(options.refutedThreats ?? {}),
  };
  for (const k of keys) {
    merged[k] = [...(merged[k] ?? []), ...human[k]];
  }
  return { ...options, refutedThreats: merged };
}

// ---------------------------------------------------------------------------
// Bridge: ThreatModelContext component → ComponentContext
// ---------------------------------------------------------------------------

export function toComponentContext(
  comp: ThreatModelContext["components"][number],
  ctx: ThreatModelContext,
): ComponentContext {
  // Build DB-id → human name map so the LLM prompt shows "Sensor Network"
  // instead of "cmoc3p7nb000507qlefypieot". The CUID leakage from passing
  // raw DB IDs poisons both threat descriptions ("sends to cmo…") and
  // mitigation quality (LLM can't reason about opaque identifiers — prod
  // data showed 43% mitigation coverage on CUID-leaking threats vs 69%
  // without). For disconnected refs, fall back to a readable placeholder.
  const nameById = new Map<string, string>();
  for (const c of ctx.components) {
    if (c.name && c.name.trim().length > 0) nameById.set(c.id, c.name);
  }
  const resolveName = (id: string): string =>
    nameById.get(id) || `external system (${id.slice(0, 8)})`;

  // Trust zones per component, so an edge can say whether it crosses a
  // boundary. A DMZ→INTERNAL hop is the interesting one and the prompt could
  // not previously see it: zones and per-edge classifications were dropped
  // here, not missing from the model.
  const zoneById = new Map<string, string | undefined>(
    ctx.components.map((c) => [c.id, c.trustZone]),
  );
  const ownZone = comp.trustZone;
  const edgeMeta = (peerId: string, c: (typeof ctx.connections)[number]) => {
    const peerTrustZone = zoneById.get(peerId);
    return {
      dataClassifications: c.dataTypes,
      peerTrustZone,
      // Unknown on either side is not a crossing — absence of data is not
      // evidence of a boundary.
      crossesBoundary:
        ownZone !== undefined &&
        peerTrustZone !== undefined &&
        ownZone !== peerTrustZone,
    };
  };

  const inbound = ctx.connections
    .filter((c) => c.target === comp.id)
    .map((c) => ({
      from: resolveName(c.source),
      protocol: c.protocol,
      encrypted: c.encrypted,
      auth: c.authentication,
      ...edgeMeta(c.source, c),
    }));

  const outbound = ctx.connections
    .filter((c) => c.source === comp.id)
    .map((c) => ({
      to: resolveName(c.target),
      protocol: c.protocol,
      encrypted: c.encrypted,
      auth: c.authentication,
      ...edgeMeta(c.target, c),
    }));

  // Read rich metadata from properties (populated by buildThreatModelContext)
  const props = (comp.properties || {}) as Record<string, unknown>;

  const dataClassification =
    (props.dataClassification as ComponentContext["dataClassification"]) ||
    "INTERNAL";

  // dataHandled comes as an array from the new schema field
  const dataHandled = Array.isArray(props.dataHandled)
    ? (props.dataHandled as string[])
    : [];

  return {
    id: comp.id,
    name: comp.name,
    type: comp.type,
    description: comp.description,
    dataClassification,
    dataTypes: dataHandled,
    accessPattern: (props.accessPattern as string) || "INTERNAL_ONLY",
    complianceFrameworks: (props.complianceFrameworks as string[]) || [],
    existingControls: (props.existingControls as string[]) || [],
    technologyVersion: (props.technology as string) || undefined,
    trustZone: comp.trustZone,
    inbound,
    outbound,
  };
}

// ---------------------------------------------------------------------------
// Writing style suffix for micro-analysis system prompts
// ---------------------------------------------------------------------------

export function buildStyleSuffix(style: UserWritingStyle): string {
  const parts: string[] = [];
  if (style.tone) {
    const tones: Record<string, string> = {
      formal: "Use formal, professional language with precise terminology.",
      concise: "Be brief and direct. Short sentences, no filler.",
      detailed:
        "Provide thorough explanations with context and technical details.",
      conversational: "Use clear, approachable language.",
    };
    parts.push(tones[style.tone]);
  }
  if (style.examples) {
    parts.push(`Match this writing style:\n${style.examples}`);
  }
  return parts.length > 0 ? `\n\nWriting Style: ${parts.join(" ")}` : "";
}
