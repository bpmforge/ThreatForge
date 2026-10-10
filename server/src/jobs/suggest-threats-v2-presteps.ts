/**
 * SUGGEST_THREATS v2 — worker pre-steps + progress bridge.
 *
 * Ports of the private blocks inside ai-worker.ts's legacy
 * `input.mode === "micro"` branch. The job contract (progress %,
 * progressMessage, checkpoint JSON, orphan sweep, incremental short-circuit)
 * is reproduced here for the flag-on path so `GET /api/ai-jobs/:jobId` is
 * indistinguishable from the legacy path. Logic is copied, not reinterpreted
 * — if ai-worker.ts's legacy block changes, change this the same way.
 *
 * PROGRESS MAPPING (the documented contract — identical to legacy):
 *   init/context → 2 · component/category → 5 + (categoriesDone/total)*70
 *   (≤ 99) · components_done → 76 · mitigations(_done) → 82 · supplemental
 *   → 88 · compound → 93 · calibration/persist → 96 · done → 100. Updates
 *   are debounced at 1500 ms except streaming-persist messages ("Persisted
 *   …") and "done", which always flush. onComponentPersisted additionally
 *   writes `min(75, 5 + completed/total*70)` with "Analyzed X/Y components
 *   (Z new threats)". Stage-level ctx.progress is a NO-OP on this path —
 *   only these legacy phase events reach the AiJob row.
 */
import type { PrismaClient } from "@prisma/client";
import type { ThreatModelContext } from "../types/ai.js";
import type { MicroThreat } from "../services/ai/micro-analysis/types.js";
import logger from "../utils/logger.js";

/** Port of the legacy worker's category-count math. */
export function categoriesPerComponentFor(methodologies: string[]): number {
  const catCountForMethodology = (m: string) =>
    m === "pasta" ? 8 : m === "mitre_attack" ? 11 : 6;
  return methodologies.reduce((sum, m) => sum + catCountForMethodology(m), 0);
}

export interface ProgressBridge {
  onProgress: (phase: string, detail: string) => void;
  onComponentPersisted: (
    componentNodeId: string,
    persistResult: { created: number; updated: number; skipped: number },
  ) => void;
  seedCategoriesDone: (n: number) => void;
}

/** Port of the legacy worker's progress tracker (debounce + phase mapping). */
export function createProgressBridge(
  prisma: PrismaClient,
  dbJobId: string,
  totalComponents: number,
  totalCategoryEvents: number,
): ProgressBridge {
  let categoriesDone = 0;
  let completedComponents = 0;
  let lastUpdateMs = 0;
  const DEBOUNCE_MS = 1500;

  const clamp = (n: number) => Math.min(99, Math.max(0, n));
  const phaseToPercent = (phase: string): number => {
    const componentPct = clamp(
      5 + Math.round((categoriesDone / totalCategoryEvents) * 70),
    );
    if (phase === "init" || phase === "context") return 2;
    if (phase === "component" || phase === "category") return componentPct;
    if (phase === "components_done") return 76;
    if (phase === "mitigations" || phase === "mitigations_done") return 82;
    if (phase === "supplemental") return 88;
    if (phase === "compound") return 93;
    if (phase === "calibration" || phase === "persist") return 96;
    if (phase === "done") return 100;
    return componentPct;
  };

  return {
    seedCategoriesDone: (n: number) => {
      categoriesDone = n;
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
          where: { id: dbJobId },
          data: { progress: pct, progressMessage: detail },
        })
        .catch(() => {});
    },
    onComponentPersisted: (_nodeId, persistResult) => {
      completedComponents++;
      const pct = Math.min(
        75,
        5 + Math.round((completedComponents / totalComponents) * 70),
      );
      prisma.aiJob
        .update({
          where: { id: dbJobId },
          data: {
            progress: pct,
            progressMessage: `Analyzed ${completedComponents}/${totalComponents} components (${persistResult.created} new threats)`,
          },
        })
        .catch(() => {});
    },
  };
}

/** Port of the legacy worker's step 0 — orphan AI_SUGGESTED PENDING sweep. */
export async function sweepOrphanThreats(
  prisma: PrismaClient,
  dbJobId: string,
  threatModelId: string,
): Promise<void> {
  const liveComponents = await prisma.component.findMany({
    where: { threatModelId },
    select: { nodeId: true },
  });
  const liveNodeIds = liveComponents.map((c) => c.nodeId);
  const orphanResult = await prisma.threat.deleteMany({
    where: {
      threatModelId,
      source: "AI_SUGGESTED",
      reviewStatus: "PENDING",
      manuallyEdited: false,
      componentNodeId: { notIn: liveNodeIds, not: null },
    },
  });
  if (orphanResult.count > 0) {
    logger.info(
      { dbJobId, orphansDeleted: orphanResult.count },
      "Swept orphan AI threats before analysis",
    );
  }
}

export interface ResumeState {
  resumeFrom?: {
    completedComponentIds: Set<string>;
    seedThreats: MicroThreat[];
  };
  /** Mutable — the onCheckpoint closure keeps appending to it. */
  completedComponentIds: string[];
  /** Components needing the post-run analyzedAt write-back. */
  dirtyComponentDbIds: Set<string>;
  /** Pre-seed for the progress tracker's categoriesDone counter. */
  seededCategories: number;
  /** Legacy "all components clean" short-circuit result, when applicable. */
  shortCircuit?: { skipped: true; message: string };
}

/**
 * Port of the legacy worker's steps 1 (checkpoint resume) + 2 (incremental
 * skip) — including the stale-checkpoint abort and the clean-component
 * threat seeding for compound analysis.
 */
export async function resolveResumeState(
  prisma: PrismaClient,
  dbJobId: string,
  threatModelId: string | undefined,
  context: ThreatModelContext,
  input: { fullAnalysis?: boolean },
  categoriesPerComp: number,
): Promise<ResumeState> {
  const state: ResumeState = {
    completedComponentIds: [],
    dirtyComponentDbIds: new Set(context.components.map((c) => c.id)),
    seededCategories: 0,
  };

  // 1. Check for an in-progress checkpoint (cancelled/failed resume).
  //    Checkpoint takes priority over incremental logic.
  const selfRecord = await prisma.aiJob.findUnique({
    where: { id: dbJobId },
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
        state.resumeFrom = {
          completedComponentIds: new Set(validIds),
          seedThreats: ckpt.threats ?? [],
        };
        state.completedComponentIds.push(...validIds);
        state.seededCategories = validIds.length * categoriesPerComp;
        for (const id of validIds) state.dirtyComponentDbIds.delete(id);
        logger.info(
          { dbJobId, skipping: validIds.length },
          "Resuming from own checkpoint",
        );
      } else {
        logger.error(
          {
            dbJobId,
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
  if (!state.resumeFrom && !input.fullAnalysis && threatModelId) {
    const statuses = await prisma.component.findMany({
      where: { threatModelId },
      select: { id: true, nodeId: true, name: true, analyzedAt: true },
    });
    const cleanComponents = statuses.filter((c) => c.analyzedAt !== null);
    const dirtyComponents = statuses.filter((c) => c.analyzedAt === null);

    if (dirtyComponents.length === 0 && cleanComponents.length > 0) {
      logger.info(
        { dbJobId, total: statuses.length },
        "Incremental: all components clean — skipping analysis",
      );
      state.shortCircuit = {
        skipped: true,
        message: `All ${statuses.length} components are up to date — nothing to re-analyze`,
      };
      return state;
    }

    if (cleanComponents.length > 0) {
      const cleanNodeIds = cleanComponents.map((c) => c.nodeId);
      const nodeIdToDbId = new Map(statuses.map((c) => [c.nodeId, c.id]));
      const nodeIdToName = new Map(statuses.map((c) => [c.nodeId, c.name]));

      const existingThreats = await prisma.threat.findMany({
        where: {
          threatModelId,
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
          severity: t.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
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
      state.resumeFrom = {
        completedComponentIds: new Set(cleanDbIds),
        seedThreats: seeds,
      };
      state.completedComponentIds.push(...cleanDbIds);
      state.seededCategories = cleanComponents.length * categoriesPerComp;
      for (const c of cleanComponents) state.dirtyComponentDbIds.delete(c.id);

      logger.info(
        {
          dbJobId,
          clean: cleanComponents.length,
          dirty: dirtyComponents.length,
          seeds: seeds.length,
        },
        "Incremental: skipping clean components",
      );
    }
  }

  return state;
}
