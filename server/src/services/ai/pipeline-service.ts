/**
 * Pipeline Service - Orchestrates multi-stage AI prompt execution
 *
 * Features:
 * - Execute pipelines with multiple stages
 * - Map outputs from previous stages to inputs for next stages
 * - Track execution progress in real-time
 * - Handle errors, retries, and conditional execution
 * - Log detailed execution metrics
 */
import { getPrisma } from "../../db.js";
import type {
  PromptPipeline,
  PipelineStage,
  PipelineExecution,
  PipelineStageExecution,
  ExecutionStatus,
  PrismaClient,
} from "@prisma/client";
import { preparePrompt } from "./prompt-service.js";
import { AIService } from "./ai-service.js";
import { withUsageScope } from "./providers/usage-meter.js";
import {
  getStage,
  HANDLER_STAGE_PREFIX,
  type StageContext,
  type StageName,
} from "./stages/registry.js";
import type { AICallFn, ParseFailure } from "./micro-analysis/types.js";
import { getCachedStage, stageCacheKey } from "./stages/stage-cache.js";

// Cache for pipeline definitions
const CACHE_TTL_MS = 5 * 60 * 1000;
const pipelineCache = new Map<
  string,
  { data: PipelineWithStages; timestamp: number }
>();

/**
 * Pipeline with stages included
 */
interface PipelineWithStages extends PromptPipeline {
  stages: PipelineStage[];
}

/**
 * Execution context for pipeline
 */
export interface PipelineExecutionInput {
  pipelineId: string;
  userId: string;
  organizationId?: string;
  threatModelId?: string;
  /** Inline document text — use documentId instead when document is already stored */
  inputDocument?: string;
  /** Reference to a stored Document record; content is loaded at runtime */
  documentId?: string;
  inputMetadata?: Record<string, unknown>;
  /**
   * Resume: reuse an existing PipelineExecution.id instead of creating a
   * new one, so the stage-boundary cache (keyed `stage:{executionId}:...`)
   * serves the stages that completed before the job was interrupted. The
   * re-enqueued job reads this from `AiJob.checkpoint.executionId`. When absent
   * (the normal first run) a fresh execution is created and the cache fills as
   * each stage completes.
   */
  resumeExecutionId?: string;
}

/**
 * Runtime services for code-backed (handler:) stages. Callers that
 * execute handler-backed pipelines (e.g. ai-worker) supply the AICallFn / ADR-006 sessionId / progress plumbing here; every
 * field is optional and defaults to a safe no-op (aiCall falls back to the
 * provided AIService).
 */
export interface StageHandlerRuntime {
  aiCall?: AICallFn;
  /** ADR-006 session tag for stage persists. Defaults to the execution id. */
  sessionId?: string;
  signal?: AbortSignal;
  progress?: (pct: number, msg: string) => Promise<void>;
  checkpoint?: <T>(key: string, value: T) => Promise<void>;
}

/**
 * Result of pipeline execution
 */
export interface PipelineExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  outputs: Record<string, unknown>;
  finalResult?: unknown;
  totalDurationMs: number;
  totalTokensUsed: number;
  stageResults: StageResult[];
  error?: { message: string; stageId?: string };
}

/**
 * Result of a single stage execution
 */
interface StageResult {
  stageId: string;
  stageName: string;
  status: ExecutionStatus;
  output?: unknown;
  durationMs?: number;
  tokensUsed?: number;
  error?: string;
}

/**
 * Variable mapping definition
 */
type VariableMapping =
  | {
      source: string; // Stage ID or 'input'
      field: string; // Field name to extract
    }
  // Literal value baked into the pipeline definition (e.g. ThreatIdentifier
  // `fanOut` defaults live in seed-pipelines, not in caller input).
  | { value: unknown };

/**
 * Condition for conditional stage execution
 */
interface StageCondition {
  field: string;
  equals?: string;
  contains?: string;
  exists?: boolean;
}

/**
 * Get pipeline by ID with stages
 */
export async function getPipelineById(
  id: string,
): Promise<PipelineWithStages | null> {
  const cached = pipelineCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const prisma = await getPrisma();
  const pipeline = await prisma.promptPipeline.findUnique({
    where: { id, isActive: true },
    include: {
      stages: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (pipeline) {
    pipelineCache.set(id, { data: pipeline, timestamp: Date.now() });
    if (pipelineCache.size > 500) {
      // Evict oldest entry
      const oldestKey = pipelineCache.keys().next().value;
      if (oldestKey) pipelineCache.delete(oldestKey);
    }
  }

  return pipeline;
}

/**
 * Get all pipelines for an organization
 */
export async function getPipelines(
  organizationId?: string,
): Promise<PipelineWithStages[]> {
  const prisma = await getPrisma();

  return prisma.promptPipeline.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null }, // Built-in
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
    include: {
      stages: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });
}

/**
 * Execute a pipeline
 */
export async function executePipeline(
  input: PipelineExecutionInput,
  aiService: AIService,
  runtime?: StageHandlerRuntime,
): Promise<PipelineExecutionResult> {
  const startTime = Date.now();
  const prisma = await getPrisma();

  // Load pipeline definition
  const pipeline = await getPipelineById(input.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.pipelineId}`);
  }

  // Resolve document content — prefer stored Document over inline text
  let resolvedDocumentContent = input.inputDocument;
  if (input.documentId) {
    const doc = await prisma.document.findUnique({
      where: { id: input.documentId },
      select: { content: true },
    });
    resolvedDocumentContent = doc?.content ?? input.inputDocument;
  }

  // Resume: reuse the prior execution row when the caller supplies its id
  // (read from AiJob.checkpoint.executionId). The cache keyed by this id then
  // serves the stages that completed before the interruption. Fall through to a
  // fresh execution if the id is stale/missing.
  let execution =
    input.resumeExecutionId !== undefined
      ? await prisma.pipelineExecution.findUnique({
          where: { id: input.resumeExecutionId },
        })
      : null;

  if (!execution) {
    // Create execution record (store reference, not full text, when documentId given)
    const created = await prisma.pipelineExecution.create({
      data: {
        pipelineId: input.pipelineId,
        userId: input.userId,
        organizationId: input.organizationId,
        threatModelId: input.threatModelId,
        inputDocument: input.documentId ? null : input.inputDocument,
        inputDocumentId: input.documentId ?? null,
        inputMetadata: JSON.stringify(input.inputMetadata || {}),
        status: "RUNNING",
      },
    });
    execution = created;

    // Create stage execution records
    await Promise.all(
      pipeline.stages.map((stage) =>
        prisma.pipelineStageExecution.create({
          data: {
            pipelineExecutionId: created.id,
            stageId: stage.id,
            order: stage.order,
            status: "PENDING",
          },
        }),
      ),
    );
  } else {
    // Resuming: reset to RUNNING (stage rows already exist; cached stages are
    // re-marked COMPLETED on the cache hit, others re-run).
    await prisma.pipelineExecution.update({
      where: { id: execution.id },
      data: { status: "RUNNING", completedAt: null },
    });
  }

  // Persist executionId to the job checkpoint so a future re-enqueue resumes
  // this same execution (and hits the stage cache). No-op when the caller did
  // not wire a checkpoint sink (e.g. unit tests).
  await runtime?.checkpoint?.("executionId", execution.id);

  // Execute stages
  const stageResults: StageResult[] = [];
  const stageOutputs: Record<string, unknown> = {};
  let totalTokensUsed = 0;
  let errorInfo: { message: string; stageId?: string } | undefined;

  // Build context for variable resolution
  const context = {
    input: {
      documentContent: resolvedDocumentContent,
      ...input.inputMetadata,
    },
    stages: stageOutputs,
  };

  for (const stage of pipeline.stages) {
    // Check condition if specified
    if (stage.condition && !evaluateCondition(stage.condition, context)) {
      stageResults.push({
        stageId: stage.id,
        stageName: stage.name,
        status: "CANCELLED",
      });
      continue;
    }

    // Update current stage
    await prisma.pipelineExecution.update({
      where: { id: execution.id },
      data: { currentStageId: stage.id },
    });

    // Execute stage with retries
    const stageResult = await executeStageWithRetry(
      execution.id,
      stage,
      context,
      aiService,
      prisma,
      input,
      runtime,
    );

    stageResults.push(stageResult);

    if (stageResult.status === "COMPLETED" && stageResult.output) {
      stageOutputs[stage.id] = stageResult.output;
      context.stages = stageOutputs;
    }

    if (stageResult.tokensUsed) {
      totalTokensUsed += stageResult.tokensUsed;
    }

    // Handle failure
    if (stageResult.status === "FAILED") {
      if (!stage.optional && pipeline.stopOnError) {
        errorInfo = {
          message: stageResult.error || "Stage execution failed",
          stageId: stage.id,
        };
        break;
      }
    }
  }

  // errorInfo above is only set inside the
  // `!stage.optional && pipeline.stopOnError` branch, so a FAILED
  // non-optional stage with stopOnError=false left errorInfo unset and the
  // execution reported COMPLETED even though stageResults carried the
  // failure. Scan the finished results for any FAILED non-optional stage
  // regardless of stopOnError, mirroring the pattern already used at
  // suggest-threats-v2-round.ts:171-183.
  if (!errorInfo) {
    const optionalById = new Map(
      pipeline.stages.map((s) => [s.id, s.optional]),
    );
    const failedStage = stageResults.find(
      (s) => s.status === "FAILED" && !optionalById.get(s.stageId),
    );
    if (failedStage) {
      errorInfo = {
        message: failedStage.error || "Stage execution failed",
        stageId: failedStage.stageId,
      };
    }
  }

  const totalDurationMs = Date.now() - startTime;
  const finalStatus: ExecutionStatus = errorInfo ? "FAILED" : "COMPLETED";

  // Merge outputs for final result
  const finalResult = mergeStageOutputs(stageOutputs, pipeline.stages);

  // Update execution record
  await prisma.pipelineExecution.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      outputs: JSON.stringify(stageOutputs),
      finalResult: finalResult ? JSON.stringify(finalResult) : null,
      totalDurationMs,
      totalTokensUsed,
      errorMessage: errorInfo?.message,
      errorStageId: errorInfo?.stageId,
      completedAt: new Date(),
      currentStageId: null,
    },
  });

  return {
    executionId: execution.id,
    status: finalStatus,
    outputs: stageOutputs,
    finalResult,
    totalDurationMs,
    totalTokensUsed,
    stageResults,
    error: errorInfo,
  };
}

/**
 * Retry ceilings.
 *
 * `PromptStage.retryCount` is a DB column with no ceiling (`@default(0)`, and
 * the seeded threat-analysis-v2 stages leave it there, so this path is
 * currently dormant — but the column is writable). The backoff was
 * `2^attempt` seconds, also uncapped: at retryCount 20 the final wait alone is
 * ~145 hours.
 *
 * Capped in code rather than by a schema constraint, so the ceiling also
 * protects rows that already hold a bad value and no migration is needed.
 */
export const MAX_STAGE_RETRIES = 5;
export const MAX_BACKOFF_MS = 30_000;

/** Attempts allowed beyond the first, clamped. Non-finite/negative → 0. */
export function clampRetries(retryCount: number | null | undefined): number {
  if (typeof retryCount !== "number" || !Number.isFinite(retryCount)) return 0;
  return Math.min(Math.max(Math.trunc(retryCount), 0), MAX_STAGE_RETRIES);
}

/** Exponential backoff for `attempt` (0-based), capped. Pure, so the cap is testable without sleeping. */
export function backoffMs(attempt: number): number {
  if (!Number.isFinite(attempt) || attempt < 0) return 1_000;
  return Math.min(2 ** attempt * 1_000, MAX_BACKOFF_MS);
}

/**
 * Execute a single stage with retry logic
 */
async function executeStageWithRetry(
  executionId: string,
  stage: PipelineStage,
  context: { input: Record<string, unknown>; stages: Record<string, unknown> },
  aiService: AIService,
  prisma: PrismaClient,
  pipelineInput?: PipelineExecutionInput,
  runtime?: StageHandlerRuntime,
): Promise<StageResult> {
  const stageExecution = await prisma.pipelineStageExecution.findFirst({
    where: { pipelineExecutionId: executionId, stageId: stage.id },
  });

  if (!stageExecution) {
    throw new Error(
      `No stage execution record found for stage ${stage.id} in execution ${executionId}`,
    );
  }

  // Code-backed stage: `handler:<StageName>` rows dispatch to the
  // stage registry instead of preparePrompt(). An unregistered handler on an
  // optional stage is skipped like a false condition (all current handler
  // stages are registered; this guard remains for future optional handler stages).
  const isHandlerStage =
    stage.promptTemplateId.startsWith(HANDLER_STAGE_PREFIX);
  let handler: ((ctx: StageContext) => Promise<unknown>) | undefined;
  if (isHandlerStage) {
    try {
      handler = getStage(
        stage.promptTemplateId.slice(HANDLER_STAGE_PREFIX.length) as StageName,
      );
    } catch (err) {
      if (stage.optional) {
        return {
          stageId: stage.id,
          stageName: stage.name,
          status: "CANCELLED",
        };
      }
      throw err;
    }
  }

  // Stage-boundary cache. Consult BEFORE executing — a hit on resume
  // (same executionId) returns the cached StageResult so the handler never runs
  // and no tokens are spent. Handler stages only; the prompt path is not on the
  // unified v2 pipeline the cache serves. Fail-open: a miss/no-Redis falls
  // through to normal execution below.
  if (handler) {
    const cacheKey = stageCacheKey(executionId, stage.name);
    const cached = await getCachedStage(cacheKey);
    if (cached) {
      const outputFields: string[] = JSON.parse(stage.outputFields || "[]");
      const extractedOutput =
        outputFields.length > 0
          ? extractFields(cached.outputs, outputFields)
          : cached.outputs;
      await prisma.pipelineStageExecution.update({
        where: { id: stageExecution.id },
        data: {
          status: "COMPLETED",
          output: JSON.stringify(cached.outputs),
          outputParsed: JSON.stringify(extractedOutput),
          durationMs: 0,
          // The stage-execution row keeps the ORIGINAL token count for
          // historical accuracy; the run-level spend below is 0 (a cache hit
          // costs no new LLM tokens this run).
          tokensUsed: cached.tokensUsed,
          completedAt: new Date(),
        },
      });
      return {
        stageId: stage.id,
        stageName: stage.name,
        status: "COMPLETED",
        output: extractedOutput,
        durationMs: 0,
        // Run-level spend: a cache hit spends 0 tokens, so a resume's
        // totalTokensUsed reflects only the stages actually (re-)executed.
        tokensUsed: 0,
      };
    }
  }

  const maxRetries = clampRetries(stage.retryCount);
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Update stage status
      await prisma.pipelineStageExecution.update({
        where: { id: stageExecution.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          retryAttempts: attempt,
        },
      });

      const startTime = Date.now();

      // Resolve input variables
      const inputVariables = resolveVariables(stage.inputMapping, context);

      if (handler) {
        return await executeHandlerStage(
          handler as (ctx: StageContext) => Promise<{
            outputs: Record<string, unknown>;
            tokensUsed: number;
            parseFailures?: ParseFailure[];
          }>,
          { executionId, stage, stageExecutionId: stageExecution.id },
          inputVariables,
          { aiService, prisma, pipelineInput, runtime, startTime },
        );
      }

      // Prepare and execute prompt
      const prepared = await preparePrompt(
        stage.promptTemplateId,
        inputVariables,
      );
      if (!prepared) {
        throw new Error(`Prompt template not found: ${stage.promptTemplateId}`);
      }

      // Execute via AI service
      const response = await aiService.complete([
        { role: "system", content: prepared.systemPrompt },
        { role: "user", content: prepared.userPrompt },
      ]);

      const durationMs = Date.now() - startTime;

      // Parse output if JSON
      let parsedOutput: unknown = response.content;
      try {
        parsedOutput = JSON.parse(response.content);
      } catch {
        // Keep as string if not JSON
      }

      // Extract specified output fields
      const outputFields: string[] = JSON.parse(stage.outputFields || "[]");
      const extractedOutput =
        outputFields.length > 0 && typeof parsedOutput === "object"
          ? extractFields(parsedOutput as Record<string, unknown>, outputFields)
          : parsedOutput;

      // Update stage execution
      await prisma.pipelineStageExecution.update({
        where: { id: stageExecution.id },
        data: {
          status: "COMPLETED",
          input: JSON.stringify(inputVariables),
          output: response.content,
          outputParsed: JSON.stringify(extractedOutput),
          durationMs,
          tokensUsed: response.usage?.totalTokens ?? 0,
          completedAt: new Date(),
        },
      });

      return {
        stageId: stage.id,
        stageName: stage.name,
        status: "COMPLETED",
        output: extractedOutput,
        durationMs,
        tokensUsed: response.usage?.totalTokens ?? 0,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
      }
    }
  }

  // All retries failed
  await prisma.pipelineStageExecution.update({
    where: { id: stageExecution.id },
    data: {
      status: "FAILED",
      errorMessage: lastError,
      completedAt: new Date(),
    },
  });

  return {
    stageId: stage.id,
    stageName: stage.name,
    status: "FAILED",
    error: lastError,
  };
}

/**
 * Execute a code-backed (handler:) stage. Builds the
 * StageContext from the pipeline input + runtime, runs the registered
 * handler, extracts outputFields, and persists the stage execution row
 * exactly like the prompt path.
 */
async function executeHandlerStage(
  handler: (ctx: StageContext) => Promise<{
    outputs: Record<string, unknown>;
    tokensUsed: number;
    parseFailures?: ParseFailure[];
  }>,
  ids: { executionId: string; stage: PipelineStage; stageExecutionId: string },
  inputVariables: Record<string, unknown>,
  deps: {
    aiService: AIService;
    prisma: PrismaClient;
    pipelineInput?: PipelineExecutionInput;
    runtime?: StageHandlerRuntime;
    startTime: number;
  },
): Promise<StageResult> {
  const { stage } = ids;
  const { aiService, prisma, pipelineInput, runtime, startTime } = deps;

  const stageCtx: StageContext = {
    executionId: ids.executionId,
    threatModelId: pipelineInput?.threatModelId ?? "",
    organizationId: pipelineInput?.organizationId ?? "",
    sessionId: runtime?.sessionId ?? ids.executionId,
    inputs: inputVariables,
    aiCall:
      runtime?.aiCall ??
      (async (systemPrompt, userPrompt) => {
        const response = await aiService.complete([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ]);
        return response.content;
      }),
    progress: runtime?.progress ?? (async () => undefined),
    checkpoint: runtime?.checkpoint ?? (async () => undefined),
    signal: runtime?.signal ?? new AbortController().signal,
  };

  // AI-SPEND: stage handlers report tokensUsed: 0 because AICallFn returns
  // text only; the usage meter on the provider client counts what the
  // stage's calls actually used, so take that when the handler has none.
  const { result: handlerResult, usage } = await withUsageScope(() =>
    handler(stageCtx),
  );
  const result = {
    ...handlerResult,
    tokensUsed: handlerResult.tokensUsed || usage.totalTokens,
  };
  const durationMs = Date.now() - startTime;

  // The completed stage is deliberately NOT written to the stage cache.
  // The read side (see executeStage) serves a resume with the same executionId,
  // but no caller sets `resumeExecutionId` (the v2 runner mints a fresh
  // execution each run and never persists its id), so every gzipped payload
  // written here sat in Redis for 48 h and was never read. Re-enable the write
  // together with a resume caller that (a) persists executionId without
  // clobbering the component checkpoint and (b) refuses to resume when the
  // model/inputs changed — a stale cached stage would otherwise be replayed.

  const outputFields: string[] = JSON.parse(stage.outputFields || "[]");
  const extractedOutput =
    outputFields.length > 0
      ? extractFields(result.outputs, outputFields)
      : result.outputs;

  await prisma.pipelineStageExecution.update({
    where: { id: ids.stageExecutionId },
    data: {
      status: "COMPLETED",
      input: JSON.stringify(inputVariables),
      output: JSON.stringify(result.outputs),
      outputParsed: JSON.stringify(extractedOutput),
      durationMs,
      tokensUsed: result.tokensUsed,
      completedAt: new Date(),
    },
  });

  return {
    stageId: stage.id,
    stageName: stage.name,
    status: "COMPLETED",
    output: extractedOutput,
    durationMs,
    tokensUsed: result.tokensUsed,
  };
}

/**
 * Resolve variable mappings from context
 */
function resolveVariables(
  mappingJson: string,
  context: { input: Record<string, unknown>; stages: Record<string, unknown> },
): Record<string, unknown> {
  const mappings: Record<string, VariableMapping> = JSON.parse(
    mappingJson || "{}",
  );
  const resolved: Record<string, unknown> = {};

  for (const [varName, mapping] of Object.entries(mappings)) {
    if ("value" in mapping) {
      resolved[varName] = mapping.value;
      continue;
    }
    const sourceData =
      mapping.source === "input"
        ? context.input
        : context.stages[mapping.source];

    if (sourceData && typeof sourceData === "object") {
      resolved[varName] = (sourceData as Record<string, unknown>)[
        mapping.field
      ];
    }
  }

  return resolved;
}

/**
 * Evaluate a stage condition
 */
function evaluateCondition(
  conditionJson: string,
  context: { input: Record<string, unknown>; stages: Record<string, unknown> },
): boolean {
  try {
    const condition: StageCondition = JSON.parse(conditionJson);
    const allData = {
      ...context.input,
      ...flattenStageOutputs(context.stages),
    };
    const fieldValue = allData[condition.field];

    if (condition.exists !== undefined) {
      return condition.exists
        ? fieldValue !== undefined
        : fieldValue === undefined;
    }

    if (condition.equals !== undefined) {
      return String(fieldValue) === condition.equals;
    }

    if (condition.contains !== undefined && typeof fieldValue === "string") {
      return fieldValue.includes(condition.contains);
    }

    return true;
  } catch {
    return true; // Execute if condition is invalid
  }
}

/**
 * Flatten stage outputs for condition evaluation
 */
function flattenStageOutputs(
  stages: Record<string, unknown>,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [stageId, output] of Object.entries(stages)) {
    if (typeof output === "object" && output !== null) {
      for (const [key, value] of Object.entries(output)) {
        flat[`${stageId}.${key}`] = value;
      }
    }
  }
  return flat;
}

/**
 * Extract specific fields from an object
 */
function extractFields(
  obj: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Merge stage outputs into a final result
 */
function mergeStageOutputs(
  outputs: Record<string, unknown>,
  stages: PipelineStage[],
): unknown {
  // Simple merge: combine all stage outputs
  const merged: Record<string, unknown> = {};

  for (const stage of stages) {
    const stageOutput = outputs[stage.id];
    if (stageOutput && typeof stageOutput === "object") {
      Object.assign(merged, stageOutput);
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Get pipeline execution status
 */
export async function getExecutionStatus(executionId: string): Promise<{
  execution: PipelineExecution;
  stageExecutions: PipelineStageExecution[];
} | null> {
  const prisma = await getPrisma();

  const execution = await prisma.pipelineExecution.findUnique({
    where: { id: executionId },
    include: {
      stageExecutions: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!execution) return null;

  return {
    execution,
    stageExecutions: execution.stageExecutions,
  };
}

/**
 * Get execution history for a pipeline
 */
export async function getExecutionHistory(
  pipelineId: string,
  options: { organizationId?: string; limit?: number; offset?: number } = {},
): Promise<{ executions: PipelineExecution[]; total: number }> {
  const prisma = await getPrisma();
  const { organizationId, limit = 20, offset = 0 } = options;
  // Built-in pipelines are shared, so history must be narrowed to one org.
  const where = organizationId
    ? { pipelineId, organizationId }
    : { pipelineId };

  const [executions, total] = await Promise.all([
    prisma.pipelineExecution.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.pipelineExecution.count({ where }),
  ]);

  return { executions, total };
}

/**
 * Clear pipeline cache
 */
export function clearPipelineCache(): void {
  pipelineCache.clear();
}
