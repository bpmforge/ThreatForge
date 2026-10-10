/**
 * BullMQ FlowProducer fan-out for ThreatIdentifier.
 *
 * Parent job `ai-analysis-{threatModelId}` on `ai-heavy`; one child
 * `threat-identifier-{executionId}-{componentId}-{category}` on `ai-fast`
 * per (componentId, category) pair AFTER skip-set filtering. Child payload
 * is a fixed shape; children re-derive component context from the DB.
 *
 * Each child consults the stage-boundary cache for its
 * (componentId, category) unit FIRST — on a resume (same executionId) a unit
 * that already completed returns its cached result without re-running the LLM
 * analysis. A miss falls through to normal execution and the result is written
 * back to the cache (gzipped, 48 h TTL). Pure optimization: no Redis / a cache
 * error simply means the unit runs normally.
 *
 * VERIFIED bullmq@5.76.6 semantics (node_modules, not training data):
 * - `FlowProducer.add` enqueues the tree atomically; the parent is processed
 *   only after all children settle.
 * - `job.getChildrenValues()` reads the parent's processed-children hash —
 *   readable from any Job handle at any time, so the PARENT-SIDE STAGE
 *   aggregates by polling it (plus `getIgnoredChildrenFailures()`) instead
 *   of waiting for the parent job's processor. Waiting on the parent would
 *   deadlock `ai-heavy` (concurrency 2) when two analyses run concurrently:
 *   both active jobs would hold the slots their flow parents need.
 * - Child opt `ignoreDependencyOnFailure: true` moves a failed child to the
 *   parent's ignored/failed dependencies, so a failed child does NOT fail
 *   (or block) the parent; failed units are reported and can be retried.
 * - The parent's own processor (`processFlowParentJob`, routed by name in
 *   ai-queue.ts) is a cheap aggregator that just records child counts.
 *
 * PERSIST POINT (documented decision): children NEVER persist — they return
 * `{ threats, tokensUsed, parseFailures }` and the parent re-imposes the
 * sequential loop's canonical (component, methodology) order, then performs
 * the SAME streaming persists / analyzedAt marks / checkpoints the legacy
 * loop does. This keeps a single ADR-006 entry point (sessionId tagging,
 * cleanupSessionThreats, loser cleanup all stay parent-side), keeps
 * the job contract stable, and means failed children leave no
 * orphans. Aggregation is ordering-independent: child completion
 * order never affects the output (canonical re-ordering).
 */
import logger from "../utils/logger.js";
import type { FlowProducer, Job } from "bullmq";
import type { ComponentContext } from "../services/threat-generation/context-aware-pipeline.js";
import { analyzeComponent } from "../services/ai/micro-analysis/component-analyzer.js";
import type {
  AICallFn,
  MicroAnalysisOptions,
  MicroThreat,
  ParseFailure,
} from "../services/ai/micro-analysis/types.js";
import {
  DEFAULT_OPTIONS,
  KILL_CHAIN_STAGES,
  MITRE_ATTACK_TACTICS,
  PASTA_CATEGORIES,
} from "../services/ai/micro-analysis/types.js";
import {
  buildComponentSequenceFlows,
  wrapWithThreatStyle,
  type SequenceFlowMessage,
} from "../services/ai/stages/identifier-context.js";
import { getPrisma } from "../db.js";
import {
  getCachedStage,
  stageCacheKey,
  unitKeyFor,
} from "../services/ai/stages/stage-cache.js";
import { AI_FAST_QUEUE_NAME, AI_HEAVY_QUEUE_NAME } from "./ai-queue.js";
import { DEFAULT_TEMPERATURE } from "../services/ai/generation-settings.js";
import {
  TokenMeter,
  meteredAiCall,
} from "../services/ai/providers/token-meter.js";

const AI_ANALYSIS_FLOW_PREFIX = "ai-analysis-";
const THREAT_IDENTIFIER_CHILD_PREFIX = "threat-identifier-";
const POLL_MS = 250;

function childJobName(
  executionId: string,
  componentId: string,
  category: string,
): string {
  return `${THREAT_IDENTIFIER_CHILD_PREFIX}${executionId}-${componentId}-${category}`;
}

export function isThreatIdentifierChildJob(name: string): boolean {
  return name.startsWith(THREAT_IDENTIFIER_CHILD_PREFIX);
}

export function isAiAnalysisFlowParentJob(name: string): boolean {
  return name.startsWith(AI_ANALYSIS_FLOW_PREFIX);
}

// --- FlowProducer lifecycle (mirrors ai-queue.ts: lazy bullmq import) ---
let _redisUrl: string | null = null;
let _flowProducer: FlowProducer | null = null;

/** Call once at startup (initAiQueue does) or from integration tests. */
export function initAiFlowProducer(redisUrl: string): void {
  _redisUrl = redisUrl;
}

/** Fan-out requires Redis; without it ThreatIdentifier stays sequential. */
export function isAiFlowReady(): boolean {
  return _redisUrl !== null;
}

async function getFlowProducer(): Promise<FlowProducer> {
  if (!_redisUrl) {
    throw new Error("AI flow not initialized — call initAiFlowProducer first");
  }
  if (!_flowProducer) {
    const { FlowProducer: FP } = await import("bullmq");
    _flowProducer = new FP({ connection: { url: _redisUrl } });
  }
  return _flowProducer;
}

export async function closeAiFlowProducer(): Promise<void> {
  await _flowProducer?.close();
  _flowProducer = null;
  _redisUrl = null;
}

// --- Child contract ---
/**
 * Child payload — the core identifying fields plus an optional `categories`.
 * A child analyzes one fixed chunk of categories for one component; `category`
 * stays set to the chunk's first category, and a payload without `categories`
 * (a job enqueued before `categories` existed) is analyzed as `[category]`, as before.
 */
export interface ThreatIdentifierChildData {
  executionId: string;
  threatModelId: string;
  organizationId: string;
  sessionId: string;
  componentId: string;
  category: string;
  /** The chunk's categories (fixed partition, see chunkCategories). */
  categories?: string[];
}

/** The categories a unit/payload covers (older jobs without `categories`: one). */
export function unitCategories(u: {
  category: string;
  categories?: string[];
}): string[] {
  return u.categories?.length ? u.categories : [u.category];
}

/**
 * Child result (`threats`/`tokensUsed`/`parseFailures`) plus additive
 * ride-alongs: `llmCalls` feeds the legacy result summary; `componentId`/
 * `category` let the parent map results to units without parsing job keys.
 */
export interface ThreatIdentifierChildResult {
  threats: MicroThreat[];
  tokensUsed: number;
  parseFailures: ParseFailure[];
  llmCalls: number;
  componentId: string;
  category: string;
  /** The chunk this result covers. */
  categories?: string[];
}

/** Category names are globally unique across the four methodologies. */
export function methodologyForCategory(
  category: string,
): MicroAnalysisOptions["methodologies"][number] {
  if ((PASTA_CATEGORIES as readonly string[]).includes(category)) {
    return "pasta";
  }
  if ((KILL_CHAIN_STAGES as readonly string[]).includes(category)) {
    return "kill_chain";
  }
  if ((MITRE_ATTACK_TACTICS as readonly string[]).includes(category)) {
    return "mitre_attack";
  }
  return "stride";
}

// --- Test seam: integration tests resolve units from the fixture context
// and inject the replay AICallFn (no DB, zero network). ---
export interface ChildUnit {
  component: ComponentContext;
  methodology: MicroAnalysisOptions["methodologies"][number];
  options: MicroAnalysisOptions;
  sequenceFlows?: SequenceFlowMessage[];
}

export interface AiFlowTestOverrides {
  resolveUnit: (data: ThreatIdentifierChildData) => Promise<ChildUnit>;
  aiCall: AICallFn;
}

let _overrides: AiFlowTestOverrides | null = null;
export function setAiFlowTestOverrides(o: AiFlowTestOverrides): void {
  _overrides = o;
}
export function resetAiFlowTestOverrides(): void {
  _overrides = null;
}

/**
 * Re-derive ONE component's context from the DB via the same canonical
 * builder the ArchitectureReader stage uses.
 *
 * Two documented gaps remain (orthogonal to the unit cache, which caches
 * the child RESULT, not its input context): (a) custom run options
 * (minCategoryConfidence, maxCategoryLoops) are not part of the child
 * payload, so children use DEFAULT_OPTIONS; (b) children see the CURRENT DB
 * state, not the snapshot the parent run started from.
 */
async function resolveUnitFromDb(
  data: ThreatIdentifierChildData,
): Promise<ChildUnit> {
  const { buildThreatModelContext } = await import("../api/ai/helpers.js");
  const context = await buildThreatModelContext(data.threatModelId);
  if (!context) {
    throw new Error(`Threat model not found: ${data.threatModelId}`);
  }
  const comp = context.components.find((c) => c.id === data.componentId);
  if (!comp) {
    throw new Error(
      `Component ${data.componentId} not found in model ${data.threatModelId}`,
    );
  }
  const { toComponentContext } = await import(
    "../services/ai/micro-analysis/pipeline.js"
  );
  return {
    component: toComponentContext(comp, context),
    methodology: methodologyForCategory(data.category),
    options: { ...DEFAULT_OPTIONS },
    sequenceFlows: buildComponentSequenceFlows(context).get(comp.id),
  };
}

/** Same legacy-identical call shape as the v2 runner (temp 0.3, 45000). */
async function buildChildAiCall(
  data: ThreatIdentifierChildData,
  meter: TokenMeter,
): Promise<AICallFn> {
  const prisma = await getPrisma();
  const { createJobAIClient } = await import("./job-ai-client.js");
  const { client } = await createJobAIClient(data.organizationId, prisma);
  return meteredAiCall(client, meter, {
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: 45000,
  });
}

/**
 * Child processor: ONE (component, category) analysis. Routed by job-name
 * prefix from the ai-fast worker (ai-queue.ts). Never persists (see module
 * doc). The per-user writing-style wrap the sequential loop applies via
 * `persist.userId` is recovered from the PipelineExecution row (the same
 * userId the v2 runner passes to executePipeline).
 */
export async function processThreatIdentifierChild(
  job: Job<ThreatIdentifierChildData>,
): Promise<ThreatIdentifierChildResult> {
  const data = job.data;

  // Serve this (componentId, category) unit from the stage cache on a
  // resume (same executionId). Fail-open — a miss runs the analysis below.
  const categories = unitCategories(data);
  const cacheKey = stageCacheKey(
    data.executionId,
    "ThreatIdentifier",
    unitKeyFor(data.componentId, categories.join("+")),
  );
  const cached = await getCachedStage(cacheKey);
  const cachedChild = cached?.outputs?.childResult as
    | ThreatIdentifierChildResult
    | undefined;
  if (cachedChild) return cachedChild;

  const unit = _overrides
    ? await _overrides.resolveUnit(data)
    : await resolveUnitFromDb(data);
  const meter = new TokenMeter();
  let aiCall = _overrides
    ? _overrides.aiCall
    : await buildChildAiCall(data, meter);
  if (!_overrides) {
    const prisma = await getPrisma();
    const exec = await prisma.pipelineExecution
      .findUnique({ where: { id: data.executionId }, select: { userId: true } })
      .catch(() => null);
    if (exec?.userId) aiCall = await wrapWithThreatStyle(aiCall, exec.userId);
  }
  const { threats, llmCalls, parseFailures, roleInference } =
    await analyzeComponent(
      aiCall,
      unit.component,
      unit.methodology,
      { ...unit.options, categories },
      unit.sequenceFlows,
    );
  // Same reason as the other two call sites: a guess that reshapes the
  // reference data must be visible wherever it happens.
  if (roleInference) {
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

  const result: ThreatIdentifierChildResult = {
    threats,
    tokensUsed: meter.totals().totalTokens,
    parseFailures,
    llmCalls,
    componentId: data.componentId,
    category: data.category,
    categories,
  };

  // The unit result is deliberately NOT cached — see pipeline-service.ts;
  // nothing sets `resumeExecutionId`, so a written payload is never read.

  return result;
}

/**
 * Flow-parent processor (routed by name prefix from the ai-heavy worker).
 * The stage has already aggregated by polling the parent job's children
 * hashes, so this is a cheap observability finisher — it records counts so
 * the parent job completes cleanly in BullMQ instead of failing through
 * processAiJob with a foreign payload.
 */
export async function processFlowParentJob(
  job: Job,
): Promise<{ childCount: number; failedCount: number }> {
  const [values, failures] = await Promise.all([
    job.getChildrenValues(),
    job.getIgnoredChildrenFailures(),
  ]);
  return {
    childCount: Object.keys(values).length,
    failedCount: Object.keys(failures).length,
  };
}

// --- Stage-side fan-out orchestration ---

/**
 * One unit the stage decided to analyze post-skip-set: a component and a fixed
 * chunk of its categories (`category` is the chunk's first category).
 */
export interface FanOutUnit {
  componentId: string;
  category: string;
  categories?: string[];
}

/** A child that failed (see the partial-failure handling below). */
export interface FanOutFailedUnit {
  componentId: string;
  category: string;
  error: string;
}

export interface FanOutResult {
  threats: MicroThreat[];
  parseFailures: ParseFailure[];
  llmCalls: number;
  /** Children whose value was collected (succeeded). */
  completedCount: number;
  /** Children that failed (recorded, did not fail the parent). */
  failedUnits: FanOutFailedUnit[];
  /** Total children enqueued = units.length. */
  unitCount: number;
}

export interface FanOutParams {
  executionId: string;
  threatModelId: string;
  organizationId: string;
  sessionId: string;
  units: FanOutUnit[];
  /** Drives the progress mapping as children complete. */
  onUnitDone?: (done: number, total: number) => void | Promise<void>;
  signal?: AbortSignal;
}

/**
 * Enqueue one `ai-fast` child per fan-out unit under a single `ai-heavy`
 * flow parent, then poll the parent's children hashes until every child has
 * either returned a value or been moved to ignored failures. Returns the
 * aggregated child results; the CALLER (ThreatIdentifier stage) re-imposes
 * canonical order, runs the supplemental/compound sub-steps, and performs the
 * single persist — children never persist (see module doc / persist-point).
 *
 * Aggregation polls `getChildrenValues()` + `getIgnoredChildrenFailures()`
 * rather than blocking on the parent processor: waiting on the parent would
 * deadlock `ai-heavy` (concurrency 2) when two analyses run at once, since
 * both active jobs would hold the slots their flow parents need to run.
 */
export async function runThreatIdentifierFanOut(
  params: FanOutParams,
): Promise<FanOutResult> {
  const {
    executionId,
    threatModelId,
    organizationId,
    sessionId,
    units,
    onUnitDone,
    signal,
  } = params;

  const producer = await getFlowProducer();
  const parentName = `${AI_ANALYSIS_FLOW_PREFIX}${threatModelId}`;

  const children = units.map((u) => ({
    name: childJobName(executionId, u.componentId, unitCategories(u).join("+")),
    queueName: AI_FAST_QUEUE_NAME,
    data: {
      executionId,
      threatModelId,
      organizationId,
      sessionId,
      componentId: u.componentId,
      category: u.category,
      categories: unitCategories(u),
    } satisfies ThreatIdentifierChildData,
    opts: {
      // A failed child must NOT fail (or block) the parent; failed units are
      // collected and reported for retry.
      ignoreDependencyOnFailure: true,
      attempts: 1,
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800 },
    },
  }));

  const tree = await producer.add({
    name: parentName,
    queueName: AI_HEAVY_QUEUE_NAME,
    data: { executionId, threatModelId, unitCount: units.length },
    children,
    opts: { attempts: 1, removeOnComplete: { age: 86_400 } },
  });

  const parentJob = tree.job;
  const total = units.length;
  let lastDone = -1;

  // Map each child job ID → its unit. `getIgnoredChildrenFailures()` keys
  // failures by the child's full job KEY (`bull:<queue>:<jobId>`), NOT by job
  // name — so the only reliable correlation back to (componentId, category)
  // is via the IDs BullMQ assigned the children we just enqueued.
  const childIdToUnit = new Map<string, FanOutUnit>();
  for (const node of tree.children ?? []) {
    const id = node.job.id;
    const d = node.job.data as Partial<ThreatIdentifierChildData>;
    if (id && d.componentId && d.category) {
      childIdToUnit.set(id, {
        componentId: d.componentId,
        category: d.category,
        categories: d.categories,
      });
    }
  }

  // Poll the parent's children hashes until every child has settled.
  for (;;) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Analysis cancelled by user"), {
        code: "CANCELLED",
      });
    }
    const [values, failures] = await Promise.all([
      parentJob.getChildrenValues<ThreatIdentifierChildResult>(),
      parentJob.getIgnoredChildrenFailures(),
    ]);
    const done = Object.keys(values).length + Object.keys(failures).length;
    if (done !== lastDone) {
      lastDone = done;
      await onUnitDone?.(done, total);
    }
    if (done >= total) {
      return aggregateChildren(values, failures, childIdToUnit, total);
    }
    await delay(POLL_MS);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flatten the parent's children-value hash into the aggregate result. Order
 * is irrelevant (results are compared as sets); the stage re-imposes canonical order.
 *
 * Both hashes are keyed by the child's full job KEY (`bull:<queue>:<jobId>`),
 * NOT by job name — so the only reliable way to recover the failed
 * (componentId, category) pair (retry needs it) is the `childIdToUnit`
 * map built from the IDs BullMQ assigned the children we enqueued. A failure
 * key ends in `<jobId>`; we match on suffix.
 */
function aggregateChildren(
  values: Record<string, ThreatIdentifierChildResult>,
  failures: Record<string, string>,
  childIdToUnit: Map<string, FanOutUnit>,
  unitCount: number,
): FanOutResult {
  const threats: MicroThreat[] = [];
  const parseFailures: ParseFailure[] = [];
  let llmCalls = 0;
  for (const result of Object.values(values)) {
    threats.push(...result.threats);
    parseFailures.push(...result.parseFailures);
    llmCalls += result.llmCalls;
  }

  const failedUnits: FanOutFailedUnit[] = [];
  for (const [jobKey, error] of Object.entries(failures)) {
    const unit = unitForFailureKey(jobKey, childIdToUnit);
    // A failed chunk child is reported per category, so the retry surface
    // (per (componentId, category)) stays per-unit.
    for (const category of unit ? unitCategories(unit) : ["unknown"]) {
      failedUnits.push({
        componentId: unit?.componentId ?? jobKey,
        category,
        error,
      });
    }
  }

  return {
    threats,
    parseFailures,
    llmCalls,
    completedCount: Object.keys(values).length,
    failedUnits,
    unitCount,
  };
}

/** Resolve a `getIgnoredChildrenFailures` key (`bull:<queue>:<jobId>`) → unit. */
function unitForFailureKey(
  jobKey: string,
  childIdToUnit: Map<string, FanOutUnit>,
): FanOutUnit | undefined {
  const direct = childIdToUnit.get(jobKey);
  if (direct) return direct;
  // Failure keys carry the full job key; the last colon-segment is the job ID.
  const tail = jobKey.slice(jobKey.lastIndexOf(":") + 1);
  const byTail = childIdToUnit.get(tail);
  if (byTail) return byTail;
  for (const [id, unit] of childIdToUnit) {
    if (jobKey.endsWith(id)) return unit;
  }
  return undefined;
}
