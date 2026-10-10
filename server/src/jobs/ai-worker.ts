/**
 * AI Job Worker
 *
 * Processes AI jobs in the background. Routes each job type to
 * the appropriate AIService method and updates the DB record.
 */
import {
  generationSettingsFor,
  DEFAULT_TEMPERATURE,
  type GenerationStage,
} from "../services/ai/generation-settings.js";
import { getPrisma } from "../db.js";
import { AIService } from "../services/ai/index.js";
import { aiMetrics } from "../services/ai/ai-metrics.js";
import { parseAISettings } from "../types/settings.js";
import type { AISettings } from "../types/settings.js";
import { decryptValue, getKeyConfig } from "../services/encryption/index.js";
import logger from "../utils/logger.js";
import { warnIfTruncated } from "../services/ai/providers/finish-reason.js";
import { Metrics } from "../services/observability/metrics.js";
import type { AIProviderClient } from "../types/ai.js";
import type { AiJobData } from "./ai-queue.js";
import { createJobAIClient } from "./job-ai-client.js";
import { sanitizeMessage } from "../utils/sanitize.js";
import {
  classifyContextSensitivity,
  enforceRoutingPolicy,
  type AIRoutingPolicy,
} from "../services/ai/provider-router.js";
import { dispatchWebhookEvent } from "../services/webhooks/webhook-dispatcher.js";
import { computeDeadlineAt } from "../services/ai/job-deadline.js";
import { validateMitigationRefreshReply } from "../services/ai/mitigation-refresh-validator.js";

/**
 * Get an AIService instance for the given organization.
 */
/** Build the (system, user, stage) => completion callback the v2 pipelines use. */
function createV2AiCall(client: AIProviderClient) {
  return async (system: string, user: string, stage?: GenerationStage) => {
    // The Verify/REVIEWER pass runs with its settings row.
    const settings = generationSettingsFor(stage);
    const resp = await client.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: settings?.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: settings?.maxTokens ?? 45000,
      thinking: settings?.thinking,
    });
    warnIfTruncated(resp, stage);
    return resp.content;
  };
}

async function getAIServiceForOrg(
  organizationId: string,
): Promise<AIService | null> {
  const prisma = await getPrisma();
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, aiSettings: true },
  });

  if (!org) return null;

  const settings: AISettings = parseAISettings(org.aiSettings);

  if (!settings.enabled || settings.provider === "none") return null;

  // Decrypt API key if encrypted
  if (settings.encryptedApiKey && !settings.apiKey) {
    try {
      const keyConfig = await getKeyConfig(org.id);
      const decryptedKey = decryptValue(
        settings.encryptedApiKey,
        keyConfig ?? undefined,
      );
      if (decryptedKey) {
        settings.apiKey = decryptedKey;
      }
    } catch (error) {
      logger.error(
        { error, organizationId },
        "Failed to decrypt API key for AI job",
      );
      return null;
    }
  }

  return new AIService(settings, organizationId);
}

/**
 * Build threat model context from database (same logic as helpers.ts).
 */
async function buildContext(threatModelId: string) {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    include: {
      components: true,
      connections: true,
      boundaries: true,
      project: {
        include: {
          organization: { select: { threatMethodology: true } },
        },
      },
    },
  });

  if (!model) return null;

  const methodology =
    model.project?.organization?.threatMethodology ?? "STRIDE";

  return {
    name: model.name,
    methodology,
    components: model.components.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      description: c.description || undefined,
      properties: c.properties ? JSON.parse(c.properties) : undefined,
    })),
    connections: model.connections.map((c) => ({
      id: c.id,
      source: c.sourceComponentId,
      target: c.targetComponentId,
      label: c.label || undefined,
      protocol: c.protocol || undefined,
      encrypted: c.encrypted,
    })),
    boundaries: model.boundaries.map((b) => ({
      id: b.id,
      name: b.name,
      trustLevel: b.trustLevel || undefined,
    })),
  };
}

/** Jobs that have been requested to cancel — checked between components */
const pendingCancellations = new Set<string>();

/**
 * Abort controllers for jobs whose runner can honour an AbortSignal (the v2
 * pipeline path). `cancelJob` aborts it so in-flight stage work stops instead
 * of waiting for the next component checkpoint.
 */
const jobAbortControllers = new Map<string, AbortController>();

/** Signal a running job to stop after its current component finishes */
export function cancelJob(dbJobId: string): void {
  pendingCancellations.add(dbJobId);
  jobAbortControllers.get(dbJobId)?.abort();
}

/**
 * Register an AbortSignal that `cancelJob(dbJobId)` aborts. A cancel requested
 * before registration aborts immediately. Call `dispose()` when the run ends.
 */
export function registerJobAbort(dbJobId: string): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  if (pendingCancellations.has(dbJobId)) controller.abort();
  jobAbortControllers.set(dbJobId, controller);
  return {
    signal: controller.signal,
    dispose: () => {
      if (jobAbortControllers.get(dbJobId) === controller) {
        jobAbortControllers.delete(dbJobId);
      }
    },
  };
}

/**
 * Consume a pending cancellation request. The unified v2 path checks
 * this from its onCheckpoint closure exactly where the legacy block reads
 * `pendingCancellations` directly. Returns true at most once per request.
 */
export function consumeCancellation(dbJobId: string): boolean {
  if (!pendingCancellations.has(dbJobId)) return false;
  pendingCancellations.delete(dbJobId);
  return true;
}

/**
 * Enforce the org's AI routing policy before any job ships data to a provider.
 * Throws when the org policy (e.g. local-only) forbids the configured provider
 * for this job. Pass `components` when a threat-model context is available so
 * sensitivity classification can refine the decision; document/text jobs may
 * omit it — local-only orgs are still blocked from external providers.
 *
 * Previously this guard lived inline only in SUGGEST_THREATS, so document
 * extraction, attack-tree, refresh-mitigations, and chat all bypassed org
 * routing policy. Now every data-sending mode calls this.
 */
async function assertRoutingAllowed(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  organizationId: string,
  jobType: string,
  components: Array<{ properties?: Record<string, unknown> | null }> = [],
): Promise<void> {
  const orgForPolicy = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { aiRoutingPolicy: true, aiSettings: true },
  });
  const policy = (orgForPolicy?.aiRoutingPolicy ??
    "allow-cloud") as AIRoutingPolicy;
  const settings: AISettings = orgForPolicy?.aiSettings
    ? JSON.parse(orgForPolicy.aiSettings)
    : { provider: "none" };
  const routingDecision = classifyContextSensitivity({ components });
  const allowed = enforceRoutingPolicy(
    settings.provider,
    routingDecision,
    policy,
    {
      organizationId,
      jobType,
    },
  );
  if (!allowed) {
    throw new Error(
      `Job blocked by org routing policy (${policy}): ${routingDecision.reason}`,
    );
  }
}

/**
 * Process a single AI job.
 * Called by the BullMQ worker -- runs in the background.
 */
export async function processAiJob(data: AiJobData): Promise<unknown> {
  const prisma = await getPrisma();

  logger.info(
    { type: data.type, dbJobId: data.dbJobId, userId: data.userId },
    "Starting AI job",
  );

  // Mark as PROCESSING. updateMany instead of update so a canceled job
  // (DB row deleted between enqueue and pickup) doesn't throw P2025 and
  // burn a BullMQ retry cycle — the result isn't used by the caller.
  await prisma.aiJob.updateMany({
    where: { id: data.dbJobId },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  try {
    const aiService = await getAIServiceForOrg(data.organizationId);
    if (!aiService) {
      throw new Error("AI service not configured for organization");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let input: any;
    try {
      input = JSON.parse(data.input);
    } catch (parseErr) {
      logger.error(
        { parseErr, jobType: data.type, jobId: data.dbJobId },
        "Failed to parse job input payload",
      );
      throw new Error(`Invalid job input for ${data.type}`);
    }
    let result: unknown;

    switch (data.type) {
      case "SUGGEST_THREATS": {
        const context = await buildContext(input.modelId || data.threatModelId);
        if (!context) throw new Error("Threat model not found");

        // Routing policy check — warn/block based on data sensitivity + org policy
        await assertRoutingAllowed(
          prisma,
          data.organizationId,
          data.type,
          context.components.map((c) => ({
            properties: c.properties as Record<string, unknown> | null,
          })),
        );

        // Unified-orchestrator rollout: orgs with
        // the `agent-chain-v2` flag run micro-mode analysis through the seeded
        // threat-analysis-v2 pipeline. Every other mode (expert / agentic /
        // single-shot) and every flag-off org takes the legacy paths below,
        // untouched. The job contract (progress %,
        // progressMessage, checkpoint, result shape) is preserved inside
        // runSuggestThreatsV2 — see that module's header for the mapping.
        if (input.mode === "micro") {
          const { isAgentChainV2Enabled } = await import(
            "../services/ai/agent-chain-flag.js"
          );
          if (await isAgentChainV2Enabled(data.organizationId)) {
            const { runSuggestThreatsV2 } = await import(
              "./suggest-threats-v2.js"
            );
            result = await runSuggestThreatsV2({
              prisma,
              data,
              input,
              context,
            });
            break;
          }
        }

        if (
          input.mode === "expert" ||
          input.mode === "agentic" ||
          input.mode === "micro"
        ) {
          const { client } = await createJobAIClient(
            data.organizationId,
            prisma,
          );

          if (input.mode === "micro") {
            // Per-component, per-category micro-analysis
            const { runMicroAnalysis } = await import(
              "../services/ai/micro-analysis/index.js"
            );
            const { TokenMeter, meteredAiCall } = await import(
              "../services/ai/providers/token-meter.js"
            );
            const tokenMeter = new TokenMeter();
            const aiCall = meteredAiCall(client, tokenMeter, {
              temperature: DEFAULT_TEMPERATURE,
              maxTokens: 45000,
            });

            // Progress tracker: category-level granularity
            const methodologies = (input.methodologies as
              | string[]
              | undefined) ?? ["stride"];
            const catCountForMethodology = (m: string) =>
              m === "pasta" ? 8 : m === "mitre_attack" ? 11 : 6;
            const categoriesPerComp = methodologies.reduce(
              (sum, m) => sum + catCountForMethodology(m),
              0,
            );
            const totalCategoryEvents = Math.max(
              context.components.length * categoriesPerComp,
              1,
            );
            let categoriesDone = 0;
            let lastUpdateMs = 0;
            const DEBOUNCE_MS = 1500;

            const clamp = (n: number) => Math.min(99, Math.max(0, n));
            const phaseToPercent = (phase: string): number => {
              const componentPct = clamp(
                5 + Math.round((categoriesDone / totalCategoryEvents) * 70),
              );
              if (phase === "init" || phase === "context") return 2;
              if (phase === "component" || phase === "category")
                return componentPct;
              // Mitigations run after dedup and the confidence floor.
              if (phase === "components_done") return 76;
              if (phase === "supplemental") return 78;
              if (phase === "compound") return 80;
              if (phase === "calibration") return 82;
              if (phase === "dedup" || phase === "dedup_done") return 84;
              if (phase === "mitigations" || phase === "mitigations_done")
                return 88;
              if (phase === "persist") return 96;
              if (phase === "done") return 100;
              return componentPct;
            };

            const cancelSignal = { cancelled: false };
            const completedComponentIds: string[] = [];
            let completedComponents = 0;
            const totalComponents = Math.max(context.components.length, 1);
            type MicroThreat =
              import("../services/ai/micro-analysis/types.js").MicroThreat;
            let resumeFrom:
              | {
                  completedComponentIds: Set<string>;
                  seedThreats: MicroThreat[];
                }
              | undefined;

            // Track which component DB IDs are dirty for analyzedAt write-back.
            // Starts as all IDs; clean components are removed after incremental check.
            const dirtyComponentDbIds = new Set(
              context.components.map((c) => c.id),
            );

            // 0. Sweep orphan AI_SUGGESTED PENDING threats — rows whose
            //    componentNodeId no longer matches any component in this
            //    model (user redrew the canvas, component was deleted, etc).
            //    Name-based dedup in persistAIThreats can't catch these
            //    because their componentNodeId differs from current ones.
            //    Only PENDING AI threats are removed — human-reviewed rows
            //    (ACCEPTED/MODIFIED/REJECTED) and manual threats are kept.
            if (data.threatModelId) {
              const liveComponents = await prisma.component.findMany({
                where: { threatModelId: data.threatModelId },
                select: { nodeId: true },
              });
              const liveNodeIds = liveComponents.map((c) => c.nodeId);
              const orphanResult = await prisma.threat.deleteMany({
                where: {
                  threatModelId: data.threatModelId,
                  source: "AI_SUGGESTED",
                  reviewStatus: "PENDING",
                  manuallyEdited: false,
                  componentNodeId: { notIn: liveNodeIds, not: null },
                },
              });
              if (orphanResult.count > 0) {
                logger.info(
                  {
                    dbJobId: data.dbJobId,
                    orphansDeleted: orphanResult.count,
                  },
                  "Swept orphan AI threats before analysis",
                );
              }
            }

            // 1. Check for an in-progress checkpoint (cancelled/failed resume).
            //    Checkpoint takes priority over incremental logic.
            const selfRecord = await prisma.aiJob.findUnique({
              where: { id: data.dbJobId },
              select: { checkpoint: true },
            });
            if (selfRecord?.checkpoint) {
              const ckpt = JSON.parse(selfRecord.checkpoint) as {
                completedComponentIds: string[];
                threats: MicroThreat[];
              };
              if (ckpt.completedComponentIds?.length) {
                const validIds = ckpt.completedComponentIds.filter((id) =>
                  context.components.some((c) => c.id === id),
                );
                if (validIds.length > 0) {
                  resumeFrom = {
                    completedComponentIds: new Set(validIds),
                    seedThreats: ckpt.threats ?? [],
                  };
                  completedComponentIds.push(...validIds);
                  categoriesDone = validIds.length * categoriesPerComp;
                  // Already-processed components are not dirty in this run
                  for (const id of validIds) dirtyComponentDbIds.delete(id);
                  logger.info(
                    { dbJobId: data.dbJobId, skipping: validIds.length },
                    "Resuming from own checkpoint",
                  );
                } else {
                  // All checkpoint component IDs are stale — the model was
                  // redrawn while the job was paused/interrupted. Silently
                  // restarting from zero re-generates the entire threat set
                  // with paraphrase duplicates piling on top of existing rows.
                  // Fail loudly so the user knows to start a fresh analysis.
                  logger.error(
                    {
                      dbJobId: data.dbJobId,
                      checkpointIds: ckpt.completedComponentIds.length,
                      currentComponents: context.components.length,
                    },
                    "Checkpoint all IDs stale — model changed since last run, aborting to avoid duplicate threats",
                  );
                  throw new Error(
                    "Threat model was modified while this analysis was paused. " +
                      "Please start a new analysis from the current model state.",
                  );
                }
              }
            }

            // 2. Incremental check: skip components whose threat surface hasn't changed.
            //    Only applies when there's no active checkpoint resume.
            //    input.fullAnalysis = true forces a full re-run (user override).
            if (!resumeFrom && !input.fullAnalysis && data.threatModelId) {
              const statuses = await prisma.component.findMany({
                where: { threatModelId: data.threatModelId },
                select: {
                  id: true,
                  nodeId: true,
                  name: true,
                  analyzedAt: true,
                },
              });

              const cleanComponents = statuses.filter(
                (c) => c.analyzedAt !== null,
              );
              const dirtyComponents = statuses.filter(
                (c) => c.analyzedAt === null,
              );

              // Short-circuit: nothing changed
              if (dirtyComponents.length === 0 && cleanComponents.length > 0) {
                logger.info(
                  { dbJobId: data.dbJobId, total: statuses.length },
                  "Incremental: all components clean — skipping analysis",
                );
                result = {
                  skipped: true,
                  message: `All ${statuses.length} components are up to date — nothing to re-analyze`,
                };
                break;
              }

              if (cleanComponents.length > 0) {
                // Load existing threats for clean components as seeds so compound
                // analysis can see the full threat picture across the model.
                const cleanNodeIds = cleanComponents.map((c) => c.nodeId);
                const nodeIdToDbId = new Map(
                  statuses.map((c) => [c.nodeId, c.id]),
                );
                const nodeIdToName = new Map(
                  statuses.map((c) => [c.nodeId, c.name]),
                );

                const existingThreats = await prisma.threat.findMany({
                  where: {
                    threatModelId: data.threatModelId,
                    componentNodeId: { in: cleanNodeIds },
                    source: { not: "MANUAL" },
                  },
                  include: { mitigations: { take: 10 } },
                });

                const seeds: MicroThreat[] = existingThreats.map((t) => {
                  const nodeId = t.componentNodeId ?? "";
                  const ev = t.evidence ? JSON.parse(t.evidence) : {};
                  const mits = t.mitigations.map((m) => ({
                    description: m.description,
                    controlCategory: m.controlCategory ?? "GENERAL",
                    testCriteria: m.testCriteria ?? "",
                    effort: "medium" as const,
                    effectiveness: String(m.effectivenessScore ?? 0.5),
                  }));
                  return {
                    name: t.name,
                    description: t.description ?? "",
                    category:
                      (JSON.parse(t.strideCategories || "[]") as string[])[0] ??
                      t.category ??
                      "SPOOFING",
                    severity: t.severity as
                      | "CRITICAL"
                      | "HIGH"
                      | "MEDIUM"
                      | "LOW",
                    componentId: nodeIdToDbId.get(nodeId) ?? nodeId,
                    componentName: nodeIdToName.get(nodeId) ?? "Unknown",
                    cweIds: JSON.parse(t.cweIds || "[]") as string[],
                    owaspIds: JSON.parse(t.owaspIds || "[]") as string[],
                    evidence: {
                      owasp: ev.owasp,
                      cwe: ev.cwe,
                      compliance: ev.compliance,
                      attackPath: ev.attackPath,
                    },
                    mitigations: mits,
                    mitigation: {
                      description: mits[0]?.description ?? "",
                      effort: "medium",
                      effectiveness: "0.5",
                    },
                    confidence: t.aiConfidence ?? 0.7,
                    sourceMethodology: t.aiMethodology ?? "stride",
                  };
                });

                const cleanDbIds = cleanComponents.map((c) => c.id);
                resumeFrom = {
                  completedComponentIds: new Set(cleanDbIds),
                  seedThreats: seeds,
                };
                completedComponentIds.push(...cleanDbIds);
                categoriesDone = cleanComponents.length * categoriesPerComp;

                // Clean components are not dirty — only dirty ones need write-back
                for (const c of cleanComponents)
                  dirtyComponentDbIds.delete(c.id);

                logger.info(
                  {
                    dbJobId: data.dbJobId,
                    clean: cleanComponents.length,
                    dirty: dirtyComponents.length,
                    seeds: seeds.length,
                  },
                  "Incremental: skipping clean components",
                );
              }
            }

            result = await runMicroAnalysis(
              context,
              aiCall,
              {
                methodologies: input.methodologies,
                minCategoryConfidence: input.minConfidence,
                tokenMeter,
                cancelSignal,
                // One deadline per job, computed here at the entry point.
                deadlineAt: computeDeadlineAt(Date.now()),
                resumeFrom,
                force:
                  (input.force as boolean | undefined) || input.fullAnalysis,
                componentNodeIds: input.componentNodeIds as
                  | string[]
                  | undefined,
                categories: input.categories as string[] | undefined,
                mitigationsOnly:
                  (input.mitigationsOnly as boolean | undefined) ?? false,
                onCheckpoint: async (componentId, threatssoFar) => {
                  if (pendingCancellations.has(data.dbJobId)) {
                    pendingCancellations.delete(data.dbJobId);
                    cancelSignal.cancelled = true;
                  }
                  completedComponentIds.push(componentId);
                  await prisma.aiJob.updateMany({
                    where: { id: data.dbJobId },
                    data: {
                      checkpoint: JSON.stringify({
                        completedComponentIds,
                        threats: threatssoFar,
                      }),
                    },
                  });
                },
                onComponentPersisted: (_nodeId, persistResult) => {
                  completedComponents++;
                  const pct = Math.min(
                    75,
                    5 +
                      Math.round((completedComponents / totalComponents) * 70),
                  );
                  prisma.aiJob
                    .update({
                      where: { id: data.dbJobId },
                      data: {
                        progress: pct,
                        progressMessage: `Analyzed ${completedComponents}/${totalComponents} components (${persistResult.created} new threats)`,
                      },
                    })
                    .catch(() => {});
                },
                onProgress: (phase, detail) => {
                  if (phase === "category") categoriesDone++;
                  const now = Date.now();
                  // Always flush streaming-persist messages so the frontend can
                  // invalidate the threat list and show live results.
                  const isStreamingPersist =
                    phase === "component" &&
                    typeof detail === "string" &&
                    detail.startsWith("Persisted");
                  if (
                    !isStreamingPersist &&
                    now - lastUpdateMs < DEBOUNCE_MS &&
                    phase !== "done"
                  )
                    return;
                  lastUpdateMs = now;
                  const pct = phaseToPercent(phase);
                  prisma.aiJob
                    .update({
                      where: { id: data.dbJobId },
                      data: { progress: pct, progressMessage: detail },
                    })
                    .catch(() => {});
                },
              },
              data.threatModelId
                ? {
                    threatModelId: data.threatModelId,
                    userId: data.userId,
                    verifyClient: client,
                    // Tag every threat row with this job's id so
                    // cleanupSessionThreats() can atomically delete partial
                    // writes if the job fails mid-pipeline or is cancelled.
                    sessionId: data.dbJobId,
                  }
                : undefined,
            );

            // Write-back analyzedAt for dirty components that were successfully analyzed.
            if (dirtyComponentDbIds.size > 0 && data.threatModelId) {
              await prisma.component
                .updateMany({
                  where: {
                    id: { in: [...dirtyComponentDbIds] },
                    threatModelId: data.threatModelId,
                  },
                  data: { analyzedAt: new Date() },
                })
                .catch((err) =>
                  logger.warn(
                    { err, dbJobId: data.dbJobId },
                    "Failed to write analyzedAt",
                  ),
                );
            }
          } else if (input.mode === "agentic") {
            // Multi-framework agentic analysis.
            // Flag-on orgs run the SAME parallel framework runners +
            // verify loop through the seeded agentic-analysis-v2 pipeline
            // (PipelineExecution rows + prompt-template-backed runner stages).
            // Both paths return the identical
            // AgenticAnalysisResult shape the worker stores as AiJob.result.
            // Flag-off orgs are unaffected.
            const onAgenticProgress = (status: string) => {
              prisma.aiJob
                .update({
                  where: { id: data.dbJobId },
                  data: { progress: status === "complete" ? 100 : 50 },
                })
                .catch(() => {});
            };
            const { isAgentChainV2Enabled } = await import(
              "../services/ai/agent-chain-flag.js"
            );
            if (await isAgentChainV2Enabled(data.organizationId)) {
              const { runAgenticAnalysisV2 } = await import(
                "../services/ai/agentic-analysis-v2.js"
              );
              result = await runAgenticAnalysisV2({
                prisma,
                context,
                userId: data.userId,
                organizationId: data.organizationId,
                threatModelId: data.threatModelId,
                aiCall: createV2AiCall(client),
                frameworks: input.frameworks,
                minConfidence: input.minConfidence,
                onProgress: (_stage, status) => onAgenticProgress(status),
              });
            } else {
              const { runAgenticAnalysis } = await import(
                "../services/ai/agentic-analysis.js"
              );
              result = await runAgenticAnalysis(client, context, {
                frameworks: input.frameworks,
                minConfidence: input.minConfidence,
                onProgress: (_framework, status) => onAgenticProgress(status),
              });
            }
          } else {
            // Multi-pass expert analysis (6 passes with verification).
            // Flag-on orgs run the SAME 6 passes through the seeded
            // expert-analysis-v2 pipeline (PipelineExecution rows + prompt-
            // template-backed stages). Both
            // paths return the identical ExpertAnalysisResult shape the
            // worker stores as AiJob.result. Flag-off orgs are unaffected.
            const onExpertProgress = (pass: number) => {
              const progress = Math.round((pass / 6) * 100);
              prisma.aiJob
                .update({
                  where: { id: data.dbJobId },
                  data: { progress },
                })
                .catch(() => {});
            };
            const { isAgentChainV2Enabled } = await import(
              "../services/ai/agent-chain-flag.js"
            );
            if (await isAgentChainV2Enabled(data.organizationId)) {
              const { runExpertAnalysisV2 } = await import(
                "../services/ai/expert-analysis-v2.js"
              );
              result = await runExpertAnalysisV2({
                prisma,
                context,
                userId: data.userId,
                organizationId: data.organizationId,
                threatModelId: data.threatModelId,
                aiCall: createV2AiCall(client),
                onProgress: (pass) => onExpertProgress(pass),
              });
            } else {
              const { runExpertAnalysis } = await import(
                "../services/ai/expert-analysis.js"
              );
              result = await runExpertAnalysis(
                client,
                context,
                (pass, _status) => onExpertProgress(pass),
              );
            }
          }
        } else {
          result = await aiService.suggestThreats(context);
        }
        break;
      }

      case "EXTRACT_DOCUMENT": {
        // Document text is untrusted and may be sensitive — enforce org policy
        // before it leaves the building for an external provider.
        await assertRoutingAllowed(prisma, data.organizationId, data.type);
        const extractResult = await aiService.extractArchitecture(
          input.text || input.prompt,
          { documentType: input.documentType || "auto" },
        );
        result = extractResult;
        break;
      }

      case "ATTACK_TREE": {
        await assertRoutingAllowed(prisma, data.organizationId, data.type);
        const context = data.threatModelId
          ? await buildContext(data.threatModelId)
          : null;
        const contextInfo = context
          ? `\nModel components: ${context.components.map((c) => `${c.name} (${c.type})`).join(", ")}`
          : "";

        const ATTACK_TREE_PROMPT = `You are a security expert generating attack trees for threat modeling.
Given a threat and its context, produce an attack tree as JSON with goal, operator, and children nodes.
Return ONLY the JSON object, no markdown.`;

        const userContent = [
          "Generate an attack tree for this threat:",
          `Threat: ${sanitizeMessage(String(input.threatName), 500)}`,
          input.threatDescription
            ? `Description: ${sanitizeMessage(String(input.threatDescription), 2000)}`
            : "",
          input.strideCategory
            ? `STRIDE Category: ${sanitizeMessage(String(input.strideCategory), 100)}`
            : "",
          input.componentName
            ? `Target Component: ${sanitizeMessage(String(input.componentName), 200)} (${sanitizeMessage(String(input.componentType || "unknown"), 100)})`
            : "",
          contextInfo,
        ]
          .filter(Boolean)
          .join("\n");

        const response = await aiService.complete([
          { role: "system", content: ATTACK_TREE_PROMPT },
          { role: "user", content: userContent },
        ]);

        let content = response.content.trim();
        if (content.startsWith("```")) {
          content = content
            .replace(/^```(?:json)?\n?/, "")
            .replace(/\n?```$/, "");
        }
        result = JSON.parse(content);
        break;
      }

      case "CALCULATE_SEVERITY": {
        await assertRoutingAllowed(prisma, data.organizationId, data.type);
        result = await aiService.calculateSeverity(
          {
            title: input.title,
            description: input.description,
            category: input.category,
          },
          input.context,
        );
        break;
      }

      case "SUGGEST_MITIGATIONS": {
        await assertRoutingAllowed(prisma, data.organizationId, data.type);
        const context = data.threatModelId
          ? await buildContext(data.threatModelId)
          : null;
        result = await aiService.suggestMitigations(
          {
            title: input.title,
            description: input.description,
            category: input.category,
          },
          context || undefined,
        );
        break;
      }

      case "SEQUENCE_DIAGRAM": {
        await assertRoutingAllowed(prisma, data.organizationId, data.type);
        const response = await aiService.complete([
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: sanitizeMessage(String(input.userPrompt), 20000),
          },
        ]);
        result = { content: response.content, usage: response.usage };
        break;
      }

      case "REFINEMENT_QUESTIONS": {
        await assertRoutingAllowed(prisma, data.organizationId, data.type);
        const response = await aiService.complete([
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: sanitizeMessage(String(input.userPrompt), 20000),
          },
        ]);
        result = { content: response.content, usage: response.usage };
        break;
      }

      case "VERIFY_CITATIONS": {
        const { batchVerifyCitations } = await import(
          "../services/citation/batch-verifier.js"
        );
        const { client, orgSettings } = await createJobAIClient(
          data.organizationId,
          prisma,
        );
        result = await batchVerifyCitations(
          prisma,
          client,
          input.threatModelId,
          { providerName: orgSettings.provider },
        );
        break;
      }

      case "REFRESH_MITIGATIONS": {
        // Re-generate mitigations for PENDING threats using uploaded requirements context.
        // ACCEPTED/MODIFIED threats are owned by humans — skip them.
        if (!data.threatModelId) throw new Error("threatModelId required");
        await assertRoutingAllowed(prisma, data.organizationId, data.type);

        const { client: client2 } = await createJobAIClient(
          data.organizationId,
          prisma,
        );

        // Load PENDING threats for this model
        const pendingThreats = await prisma.threat.findMany({
          where: {
            threatModelId: data.threatModelId,
            reviewStatus: "PENDING",
            source: { not: "MANUAL" },
          },
          include: { mitigations: true },
        });

        // Load accepted requirements from the model
        const requirements = await prisma.requirement.findMany({
          where: { threatModelId: data.threatModelId },
          select: { id: true, reqId: true, text: true, category: true },
          take: 50,
        });

        const reqContext =
          requirements.length > 0
            ? `Required controls from project requirements:\n${requirements
                .map((r) => `- ${r.reqId ?? r.id}: ${r.text}`)
                .join("\n")}`
            : "";

        const REFRESH_MAX_THREATS = 200;
        if (pendingThreats.length > REFRESH_MAX_THREATS) {
          logger.warn(
            {
              threatCount: pendingThreats.length,
              cap: REFRESH_MAX_THREATS,
              modelId: data.threatModelId,
            },
            "REFRESH_MITIGATIONS: capping threat count to prevent runaway LLM calls",
          );
        }
        const threatsToProcess = pendingThreats.slice(0, REFRESH_MAX_THREATS);

        let threatsUpdated = 0;
        let mitigationsCreated = 0;
        const mitigationsUpdated = 0;
        let threatsFailed = 0;

        // Process threats in parallel batches to avoid overwhelming the LLM
        const BATCH_SIZE = 5;
        for (
          let batchStart = 0;
          batchStart < threatsToProcess.length;
          batchStart += BATCH_SIZE
        ) {
          const batch = threatsToProcess.slice(
            batchStart,
            batchStart + BATCH_SIZE,
          );

          await Promise.allSettled(
            batch.map(async (threat, batchIdx) => {
              const i = batchStart + batchIdx;

              const SYSTEM = `You are a security architect generating specific, actionable mitigations.
Given a threat and required security controls, produce 2-4 concrete mitigations that reference the specific controls.
Return JSON array: [{description, controlCategory, testCriteria, effort, effectiveness}]
controlCategory: IAM|ENCRYPTION|ACCESS_CONTROL|NETWORK|LOGGING|INPUT_VALIDATION|SECRETS|BACKUP|MONITORING|SUPPLY_CHAIN
effort: low|medium|high
effectiveness: 0.0-0.85`;

              const USER = [
                `Threat: ${sanitizeMessage(threat.name, 500)}`,
                `Description: ${sanitizeMessage(threat.description ?? "", 2000)}`,
                reqContext,
                "Generate specific mitigations that reference the above controls where applicable.",
              ]
                .filter(Boolean)
                .join("\n\n");

              try {
                const resp = await client2.complete({
                  messages: [
                    { role: "system", content: SYSTEM },
                    { role: "user", content: USER },
                  ],
                  temperature: DEFAULT_TEMPERATURE,
                  maxTokens: 2000,
                });

                let mitsRaw = resp.content.trim();
                if (mitsRaw.startsWith("```"))
                  mitsRaw = mitsRaw
                    .replace(/^```(?:json)?\n?/, "")
                    .replace(/\n?```$/, "");

                // Validate the shape BEFORE any delete. JSON.parse alone
                // is not enough — a reply that parses but has the wrong shape
                // ({}, [null], objects missing fields) used to pass straight
                // through a naive `as Array<...>` cast into the delete loop
                // below. Reject it here and leave the threat's existing
                // mitigations untouched.
                const validation = validateMitigationRefreshReply(mitsRaw);
                if (!validation.ok) {
                  throw new Error(
                    `REFRESH_MITIGATIONS: invalid LLM output for threat ${threat.id}: ${validation.error}`,
                  );
                }
                const newMits = validation.mitigations;

                // Replace the AI's own NOT_IMPLEMENTED mitigations; keep
                // IMPLEMENTED and verified ones.
                //
                // Source is load-bearing here. NOT_IMPLEMENTED is the schema
                // default, so without it this refresh deleted hand-written and
                // template mitigations in their normal state — the same defect as
                // the persistAIThreats delete, and this one ignored `verified`
                // too, so it also took human work that had been signed off.
                //
                // Delete + createMany run in one transaction so a mid-way
                // failure (e.g. createMany rejecting a bad row) cannot leave
                // the threat with zero mitigations.
                await prisma.$transaction(async (tx) => {
                  for (const mit of threat.mitigations) {
                    if (
                      mit.source === "AI" &&
                      mit.status === "NOT_IMPLEMENTED" &&
                      !mit.verified
                    ) {
                      await tx.mitigation.delete({ where: { id: mit.id } });
                    }
                  }

                  await tx.mitigation.createMany({
                    data: newMits.map((m) => ({
                      description: m.description,
                      controlCategory: m.controlCategory || null,
                      testCriteria: m.testCriteria || null,
                      effectivenessScore: parseFloat(m.effectiveness) || null,
                      threatId: threat.id,
                      createdById: data.userId,
                      source: "AI" as const,
                    })),
                  });
                });

                threatsUpdated++;
                mitigationsCreated += newMits.length;
              } catch (err) {
                threatsFailed++;
                logger.warn(
                  { err, threatId: threat.id, idx: i },
                  "REFRESH_MITIGATIONS: failed to refresh one threat",
                );
              }
            }),
          );

          // Update progress after each batch completes
          const pct = Math.round(
            5 + ((batchStart + batch.length) / threatsToProcess.length) * 90,
          );
          prisma.aiJob
            .update({
              where: { id: data.dbJobId },
              data: {
                progress: pct,
                progressMessage: `Refreshed mitigations for ${Math.min(batchStart + batch.length, threatsToProcess.length)} of ${threatsToProcess.length} threats`,
              },
            })
            .catch(() => {});
        }

        // Clear the stale flag on the model
        await prisma.threatModel.update({
          where: { id: data.threatModelId },
          data: { mitigationsStaleAt: null },
        });

        result = {
          threatsUpdated,
          mitigationsCreated,
          mitigationsUpdated,
          threatsFailed,
        };
        break;
      }

      case "ATTACK_CHAIN_ANALYSIS": {
        if (!data.threatModelId) throw new Error("threatModelId required");
        // Captured as a local: TS narrowing on `data.threatModelId` from the
        // guard above doesn't survive into the $transaction callback closure
        // below (it's a property access on a parameter, not a local const).
        const threatModelId = data.threatModelId;
        await assertRoutingAllowed(prisma, data.organizationId, data.type);

        const { client: chainClient } = await createJobAIClient(
          data.organizationId,
          prisma,
        );

        const chainContext = await buildContext(threatModelId);
        if (!chainContext) throw new Error("Threat model not found");

        const existingThreats = await prisma.threat.findMany({
          where: { threatModelId },
          select: { id: true, name: true, componentNodeId: true },
        });

        const { generateAttackChains } = await import(
          "../services/ai/attack-chain-service.js"
        );
        const { randomUUID } = await import("crypto");
        const sessionId = randomUUID();

        const { chains, failed } = await generateAttackChains(
          chainClient,
          chainContext,
          existingThreats,
          sessionId,
        );

        // Only wipe the prior AI_SUGGESTED chains when there is a
        // validated, non-empty replacement to put in their place. The old
        // code deleted them unconditionally with no guard on chains.length —
        // generateAttackChains fails SOFT (returns { chains: [] }, never
        // throws) on malformed/unparseable LLM output, so a bad reply wiped
        // every existing AI-suggested chain and replaced it with nothing.
        // `failed` (set by generateAttackChains) distinguishes that case from
        // a genuine "no chains found" result; either way, nothing is deleted
        // unless we have real chains to persist. Delete + creates run inside
        // one transaction (the removed comment claimed this already; it was
        // a bare for-loop of creates with no transaction at all) so a
        // mid-way failure can't leave the model with zero chains.
        if (chains.length > 0) {
          await prisma.$transaction(async (tx) => {
            await tx.attackChain.deleteMany({
              where: {
                threatModelId,
                status: "AI_SUGGESTED",
              },
            });

            for (const chain of chains) {
              await tx.attackChain.create({
                data: {
                  threatModelId,
                  name: chain.name,
                  description: chain.description,
                  severity: chain.severity,
                  status: "AI_SUGGESTED",
                  sessionId,
                  entryPointId: chain.entryPointId,
                  entryPointName: chain.entryPointName,
                  targetAssetId: chain.targetAssetId,
                  targetAssetName: chain.targetAssetName,
                  hops: {
                    create: chain.hops.map((hop) => ({
                      position: hop.position,
                      componentId: hop.componentId,
                      componentName: hop.componentName,
                      description: hop.description,
                      technique: hop.technique ?? null,
                      threatId: hop.threatId ?? null,
                    })),
                  },
                },
              });
            }
          });
        } else if (failed) {
          // Malformed/unparseable LLM output at some pass — surface as a job
          // failure instead of a silent "0 chains generated" success, and
          // leave any existing AI_SUGGESTED chains exactly as they were.
          throw new Error(
            "ATTACK_CHAIN_ANALYSIS: LLM returned no usable attack chains " +
              "(malformed output); existing chains were left untouched",
          );
        }
        // else: chains.length === 0 && !failed — the analysis genuinely
        // found no attack chains (e.g. no entry points on this diagram).
        // That's a legitimate result, not a failure; existing AI_SUGGESTED
        // chains from a prior run are left in place since there's nothing
        // validated to replace them with.

        // Fire webhook — fire-and-forget
        dispatchWebhookEvent(data.organizationId, "attack_chain.analyzed", {
          threatModelId: data.threatModelId,
          chainCount: chains.length,
        });

        result = { chainsGenerated: chains.length, sessionId };
        break;
      }

      case "ARCHITECTURAL_MITIGATIONS": {
        if (!data.threatModelId) throw new Error("threatModelId required");
        const threatModelId = data.threatModelId;
        await assertRoutingAllowed(prisma, data.organizationId, data.type);

        const { client: archClient } = await createJobAIClient(
          data.organizationId,
          prisma,
        );
        const archContext = await buildContext(threatModelId);
        if (!archContext) throw new Error("Threat model not found");

        // Threats reference diagram node/edge ids; the prompt context uses row
        // ids, so translate to keep every cited id resolvable.
        const [threatRows, chainRows, compRows, connRows] = await Promise.all([
          prisma.threat.findMany({
            where: { threatModelId },
            select: {
              id: true,
              name: true,
              severity: true,
              componentNodeId: true,
              connectionEdgeId: true,
            },
          }),
          prisma.attackChain.findMany({
            where: { threatModelId, status: { not: "REJECTED" } },
            select: {
              id: true,
              name: true,
              severity: true,
              hops: { select: { componentId: true } },
            },
          }),
          prisma.component.findMany({
            where: { threatModelId },
            select: { id: true, nodeId: true },
          }),
          prisma.connection.findMany({
            where: { threatModelId },
            select: { id: true, edgeId: true },
          }),
        ]);
        const compByNode = new Map(compRows.map((c) => [c.nodeId, c.id]));
        const connByEdge = new Map(connRows.map((c) => [c.edgeId, c.id]));

        const {
          generateArchitecturalMitigations,
          planArchitecturalMitigationWrite,
          architecturalMitigationRowData,
        } = await import("../services/ai/architectural-mitigation-service.js");
        const { proposals, failed: archFailed } =
          await generateArchitecturalMitigations(
            archClient,
            archContext,
            threatRows.map((t) => ({
              id: t.id,
              name: t.name,
              severity: t.severity,
              componentId: t.componentNodeId
                ? (compByNode.get(t.componentNodeId) ?? t.componentNodeId)
                : null,
              connectionId: t.connectionEdgeId
                ? (connByEdge.get(t.connectionEdgeId) ?? t.connectionEdgeId)
                : null,
            })),
            chainRows.map((c) => ({
              id: c.id,
              name: c.name,
              severity: c.severity,
              componentIds: c.hops.map((h) => h.componentId),
            })),
          );

        if (archFailed) {
          throw new Error(
            "ARCHITECTURAL_MITIGATIONS: LLM returned no usable proposals " +
              "(malformed output); existing proposals were left untouched",
          );
        }

        const sessionId = (await import("crypto")).randomUUID();
        const existingArch = await prisma.architecturalMitigation.findMany({
          where: { threatModelId },
        });
        const plan = planArchitecturalMitigationWrite(existingArch, proposals);
        // Only AI_SUGGESTED/source=AI rows are ever deleted (human-owned and
        // reviewed rows are protected by the plan), and only when there is a
        // validated replacement to put in their place.
        if (plan.create.length > 0) {
          await prisma.$transaction(async (tx) => {
            await tx.architecturalMitigation.deleteMany({
              where: {
                id: { in: plan.deleteIds },
                status: "AI_SUGGESTED",
                source: "AI",
              },
            });
            for (const p of plan.create) {
              await tx.architecturalMitigation.create({
                data: architecturalMitigationRowData(
                  threatModelId,
                  sessionId,
                  p,
                ),
              });
            }
          });
        }

        result = { proposalsGenerated: plan.create.length, sessionId };
        break;
      }

      default:
        throw new Error(`Unknown AI job type: ${data.type}`);
    }

    // Enrich micro-analysis results with parse-failure summary before storing
    type MicroResult = {
      summary?: {
        parseFailures?: number;
        tokens?: { truncatedCalls?: number };
      };
      parseFailures?: unknown[];
    };
    const enrichedResult =
      result &&
      typeof result === "object" &&
      "summary" in (result as object) &&
      (result as MicroResult).summary !== undefined
        ? {
            ...(result as MicroResult),
            summary: {
              ...(result as MicroResult).summary,
              parseFailures:
                (result as MicroResult).summary?.parseFailures ?? 0,
            },
            parseFailuresSamples: (
              (result as MicroResult).parseFailures ?? []
            ).slice(0, 5),
          }
        : result;

    // Structural-reliability signal. parseFailures was already computed per job
    // and written into the result blob, but nothing ever aggregated it — so a
    // prompt or provider change that broke response parsing was invisible until
    // someone opened an individual job. Emit it as a counter so it trends.
    try {
      const microSummary =
        "summary" in (result as object)
          ? (result as MicroResult).summary
          : undefined;
      const pf = microSummary?.parseFailures ?? 0;
      const truncated = microSummary?.tokens?.truncatedCalls ?? 0;
      if (pf > 0) {
        Metrics.aiParseFailuresTotal.inc({ stage: data.type }, pf);
      }
      if (truncated > 0) {
        Metrics.aiTruncatedResponsesTotal.inc({ stage: data.type }, truncated);
      }
      // Roll both into the org-level AI metrics summary.
      aiMetrics.recordQuality(data.organizationId, {
        parseFailures: pf,
        truncatedResponses: truncated,
      });
    } catch (metricErr) {
      logger.debug({ metricErr }, "parse-failure metric emit failed");
    }

    // Mark as COMPLETED. updateMany — parent row may have been deleted
    // (threat model / job canceled) while the LLM call was in flight.
    await prisma.aiJob.updateMany({
      where: { id: data.dbJobId },
      data: {
        status: "COMPLETED",
        result: JSON.stringify(enrichedResult),
        completedAt: new Date(),
        progress: 100,
      },
    });

    // Fire webhook event — fire-and-forget, don't await
    dispatchWebhookEvent(data.organizationId, "ai_job.completed", {
      jobId: data.dbJobId,
      type: data.type,
      threatModelId: data.threatModelId ?? null,
    });

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: "AI_JOB_COMPLETE",
        category: "AI",
        priority: "NORMAL",
        title: `AI ${formatJobType(data.type)} completed`,
        message: `Your ${formatJobType(data.type)} job has finished successfully.`,
        link: `/api/ai-jobs/${data.dbJobId}`,
        metadata: JSON.stringify({
          jobId: data.dbJobId,
          type: data.type,
          threatModelId: data.threatModelId,
        }),
      },
    });

    logger.info(
      { type: data.type, dbJobId: data.dbJobId },
      "AI job completed successfully",
    );

    return result;
  } catch (err) {
    const isCancelled =
      (err as { code?: string }).code === "CANCELLED" ||
      (err instanceof Error && err.message === "Analysis cancelled by user");

    // Every unit this run attempted failed at the provider call
    // itself (pipeline.ts's AllUnitsFailedError) — nothing from THIS run
    // was streamed to the DB, so cleanupSessionThreats has nothing of its
    // own to remove. Skip it outright rather than relying on that being a
    // no-op: a distinct error type keeps this failure path from ever
    // reaching into (and wiping) threats an earlier successful component —
    // in this run or a prior one — already persisted.
    //
    // The PIPELINE_COMPONENT_CAP throw (pipeline.ts's
    // ComponentCapExceededError) is the same shape of problem — it fires
    // mid-run, AFTER earlier components this run already stream-persisted.
    // cleanupSessionThreats keys off analysisSessionId === dbJobId, so
    // running it here would delete exactly those already-good writes.
    // Skip cleanup for this error too; the cap's job is to stop ONE
    // runaway component, not to justify wiping the whole session.
    const skipsSessionCleanup = [
      "ALL_UNITS_FAILED",
      "COMPONENT_CAP_EXCEEDED",
    ].includes((err as { code?: string }).code ?? "");

    const message = isCancelled
      ? "Cancelled by user"
      : err instanceof Error
        ? err.message
        : "Unknown error";

    await prisma.aiJob.update({
      where: { id: data.dbJobId },
      data: {
        status: isCancelled ? "CANCELLED" : "FAILED",
        error: message,
        completedAt: new Date(),
        progressMessage: isCancelled ? "Stopped — checkpoint saved" : message,
      },
    });

    // Sweep partial-write threats from this session. Only applies to
    // SUGGEST_THREATS jobs (they're the ones that stream-persist). On FAIL
    // we remove everything; on CANCEL we keep the checkpoint so the user
    // can resume.
    if (
      !isCancelled &&
      !skipsSessionCleanup &&
      data.type === "SUGGEST_THREATS"
    ) {
      try {
        const { cleanupSessionThreats } = await import(
          "../services/threat-review/review-service.js"
        );
        await cleanupSessionThreats(data.dbJobId);
      } catch (cleanupErr) {
        logger.warn(
          { cleanupErr, dbJobId: data.dbJobId },
          "Session cleanup failed — run startup sweeper to recover",
        );
      }
    }

    if (!isCancelled) {
      // Fire webhook event — fire-and-forget, don't await
      dispatchWebhookEvent(data.organizationId, "ai_job.failed", {
        jobId: data.dbJobId,
        type: data.type,
        threatModelId: data.threatModelId ?? null,
        error: message,
      });

      await prisma.notification.create({
        data: {
          userId: data.userId,
          type: "AI_JOB_FAILED",
          category: "AI",
          priority: "HIGH",
          title: `AI ${formatJobType(data.type)} failed`,
          message: `Your ${formatJobType(data.type)} job failed: ${message}`,
          link: `/api/ai-jobs/${data.dbJobId}`,
          metadata: JSON.stringify({
            jobId: data.dbJobId,
            type: data.type,
            error: message,
          }),
        },
      });
      logger.error(
        { err, type: data.type, dbJobId: data.dbJobId },
        "AI job failed",
      );
    } else {
      logger.info({ dbJobId: data.dbJobId }, "AI job cancelled by user");
    }

    throw err;
  }
}

/** Format job type for human-readable notification */
function formatJobType(type: string): string {
  const map: Record<string, string> = {
    SUGGEST_THREATS: "threat suggestion",
    SUGGEST_MITIGATIONS: "mitigation suggestion",
    EXTRACT_DOCUMENT: "document extraction",
    EXTRACT_DIAGRAM: "diagram extraction",
    ATTACK_TREE: "attack tree generation",
    CALCULATE_SEVERITY: "severity calculation",
    SEQUENCE_DIAGRAM: "sequence diagram",
    REFINEMENT_QUESTIONS: "refinement questions",
    VERIFY_CITATIONS: "citation verification",
    REFRESH_MITIGATIONS: "mitigation refresh",
  };
  return map[type] || type.toLowerCase().replace(/_/g, " ");
}
