/**
 * Stage Registry — unified AI orchestrator.
 *
 * See docs/architecture/AI_ARCHITECTURE.md. The stage
 * names are a CLOSED union — use these exact strings everywhere (PipelineStage
 * rows seeded by scripts/seed-pipelines.ts use the same names, which is how
 * the unified executor dispatches a stage row to its code-backed handler).
 *
 * Invariants (every Track A task):
 * 1. Handlers are pure orchestration — business logic stays in the modules
 *    they wrap (micro-analysis/*, reference-lookup, severity-calibrator, …).
 * 2. Every LLM call goes through ctx.aiCall (provider routing + token budget
 *    are enforced there). Never instantiate a provider client directly.
 * 3. Every DB write carries ctx.sessionId (ADR-006 dedup/cleanup path).
 * 4. Human-reviewed threats (ACCEPTED/REJECTED/MODIFIED) are never overwritten.
 */
import type { AICallFn, ParseFailure } from "../micro-analysis/types.js";

/**
 * promptTemplateId sentinel for code-backed stages: `handler:<StageName>`.
 * Seeded by scripts/seed-pipelines.ts; dispatched by pipeline-service.
 */
export const HANDLER_STAGE_PREFIX = "handler:";

export const STAGE_NAMES = [
  "ArchitectureReader",
  "ThreatIdentifier",
  "EvidenceEnricher",
  "StrideClassifier",
  "MitigationSynthesizer",
  "ComplianceMapper",
  "SeverityCalibrator",
  "Verifier",
  // Attack-chain pipeline (attack-chain-v1). These are NOT part of the
  // threat-analysis-v2 flow — they back the second PromptPipeline definition
  // (see docs/architecture/AI_ARCHITECTURE.md).
  "EntryPointDetector", // Pass 1
  "TargetAssetDetector", // Pass 2
  "PathGenerator", // Pass 3
  "ChainValidator", // Pass 4 (code topology/capability check + LLM review)
  "ChainScorer", // Pass 5 (residual severity via mitigation effectiveness)
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

/**
 * Stage names belonging to the threat-analysis-v2 micro pipeline (the original
 * 8). The attack-chain stages are excluded; seed-pipelines + the v2 executor
 * iterate THIS list so adding A5 stages to STAGE_NAMES never injects them into
 * the threat pipeline.
 */
export const THREAT_ANALYSIS_STAGE_NAMES = [
  "ArchitectureReader",
  "ThreatIdentifier",
  "EvidenceEnricher",
  "StrideClassifier",
  "MitigationSynthesizer",
  "ComplianceMapper",
  "SeverityCalibrator",
  "Verifier",
] as const satisfies readonly StageName[];

export interface StageContext {
  /** PipelineExecution.id */
  executionId: string;
  threatModelId: string;
  organizationId: string;
  /** ADR-006 session tag — REQUIRED on every persist */
  sessionId: string;
  /** Resolved via PipelineStage.inputMapping */
  inputs: Record<string, unknown>;
  /** SAME type micro-analysis/pipeline.ts takes — (systemPrompt, userPrompt) => Promise<string> */
  aiCall: AICallFn;
  progress: (pct: number, msg: string) => Promise<void>;
  /** Writes AiJob.checkpoint */
  checkpoint: <T>(key: string, value: T) => Promise<void>;
  signal: AbortSignal;
}

export interface StageResult {
  /** Keys must match PipelineStage.outputFields */
  outputs: Record<string, unknown>;
  tokensUsed: number;
  /** Reuse type from micro-analysis result */
  parseFailures: ParseFailure[];
}

export type StageHandler = (ctx: StageContext) => Promise<StageResult>;

const registry = new Map<StageName, StageHandler>();

export function registerStage(name: StageName, handler: StageHandler): void {
  registry.set(name, handler);
}

/** Get a registered stage handler. Throws on unknown, listing what IS registered. */
export function getStage(name: StageName): StageHandler {
  const handler = registry.get(name);
  if (!handler) {
    const registered = [...registry.keys()];
    throw new Error(
      `Stage "${name}" is not registered. Registered stages: ` +
        (registered.length > 0 ? registered.join(", ") : "(none)"),
    );
  }
  return handler;
}

/** Test-only: clear all registrations (module-level registry is shared per process). */
export function resetStageRegistry(): void {
  registry.clear();
}
