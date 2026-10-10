/**
 * Threat Review Service
 *
 * Handles the human-in-the-loop review workflow:
 * - Accept/reject/modify AI-generated threats
 * - Persist AI threats with CVSS scores to the database
 * - On re-analysis, respect human decisions (never overwrite)
 * - Provide existing reviewed threats as context for new AI runs
 */
import { parseStringArray } from "../../utils/safe-json.js";
import { getPrisma } from "../../db.js";
import { autoScoreThreat } from "./cvss-auto-scorer.js";
import { normalizeThreatName } from "./normalize-threat-name.js";
import {
  findMergeMatch,
  type DetectorThreat,
} from "../ai/dedup/duplicate-detector.js";
import { Metrics } from "../observability/metrics.js";
import type { MicroThreat } from "../ai/micro-analysis/types.js";
import type { AIProviderClient } from "../../types/ai.js";
import { parseClaim } from "../citation/citation-parser.js";
import { verifyClaims } from "../citation/citation-verifier.js";
import logger from "../../utils/logger.js";

/**
 * Anomaly cap — per-component, per-run. If a single persist call tries
 * to write more than this many threats for one component, the pipeline is
 * either looping or the LLM is hallucinating; abort the batch rather than
 * compound the problem.
 *
 * STRIDE has 6 categories × up to ~3 threats/category = 18 expected. PASTA
 * has 8 × 3 = 24. MITRE ATT&CK can legitimately produce more across 11
 * categories, so the cap is generous.
 */
const MAX_THREATS_PER_COMPONENT_PER_RUN = 40;

// ---------------------------------------------------------------------------
// Review Actions
// ---------------------------------------------------------------------------

export interface ReviewAction {
  action: "accept" | "reject" | "modify";
  notes?: string;
  changes?: {
    name?: string;
    description?: string;
    severity?: string;
    category?: string;
    cvssVector31?: string;
    cvssScore31?: number;
    cvssVector40?: string;
    cvssScore40?: number;
  };
}

/**
 * Apply a human review decision to a threat.
 */
export async function reviewThreat(
  threatId: string,
  userId: string,
  review: ReviewAction,
): Promise<void> {
  const prisma = await getPrisma();

  const updateData: Record<string, unknown> = {
    reviewedById: userId,
    reviewedAt: new Date(),
    reviewNotes: review.notes || null,
  };

  switch (review.action) {
    case "accept":
      updateData.reviewStatus = "ACCEPTED";
      updateData.source = "AI_ACCEPTED";
      break;

    case "reject":
      updateData.reviewStatus = "REJECTED";
      updateData.status = "NOT_APPLICABLE";
      break;

    case "modify":
      updateData.reviewStatus = "MODIFIED";
      updateData.source = "AI_MODIFIED";
      if (review.changes) {
        if (review.changes.name) updateData.name = review.changes.name;
        if (review.changes.description)
          updateData.description = review.changes.description;
        if (review.changes.severity)
          updateData.severity = review.changes.severity;
        if (review.changes.category)
          updateData.category = review.changes.category;
        if (review.changes.cvssVector31)
          updateData.cvssVector31 = review.changes.cvssVector31;
        if (review.changes.cvssScore31 !== undefined)
          updateData.cvssScore31 = review.changes.cvssScore31;
        if (review.changes.cvssVector40)
          updateData.cvssVector40 = review.changes.cvssVector40;
        if (review.changes.cvssScore40 !== undefined)
          updateData.cvssScore40 = review.changes.cvssScore40;
      }
      break;
  }

  const reviewed = await prisma.threat.update({
    where: { id: threatId },
    data: updateData,
    select: { aiMethodology: true },
  });

  // AI output-quality signal (precision proxy). Emitted only after the write
  // succeeds, labelled by the methodology that produced the threat so a prompt
  // or methodology change can be evaluated against the accept rate afterwards.
  // Never let telemetry break a user action.
  try {
    Metrics.aiThreatReviewsTotal.inc({
      methodology: reviewed.aiMethodology || "unknown",
      decision: review.action,
    });
  } catch (metricErr) {
    logger.debug({ metricErr }, "review metric emit failed (non-fatal)");
  }

  logger.info(
    { threatId, action: review.action, userId },
    "Threat review applied",
  );
}

// ---------------------------------------------------------------------------
// Persist AI Threats (respecting human decisions)
// ---------------------------------------------------------------------------

/**
 * Persist micro-analysis threats to the database.
 * Respects human decisions: skips threats that match already-reviewed ones.
 * Auto-calculates CVSS scores for new threats.
 *
 * @returns Count of created, updated, and skipped threats
 */
export async function persistAIThreats(
  threatModelId: string,
  userId: string,
  threats: MicroThreat[],
  /**
   * Optional. When supplied, each newly-created Threat row runs through
   * the citation verifier: the description is parsed for citation tags
   * and Citation rows are written with the cross-check result. Verifier
   * failures are logged but NEVER block threat persistence.
   */
  verifyClient?: AIProviderClient,
  /**
   * When set, narrows the existing-threats lookup to this component (and
   * optionally methodology) so a per-component streaming write doesn't
   * accidentally match a threat on a different component that shares the
   * same name.
   */
  batchScope?: { componentNodeId?: string; methodology?: string },
  /**
   * AI job id that initiated this write. Persisted as `analysisSessionId`
   * on every created Threat so the startup sweeper and failure-cleanup
   * hooks can atomically delete partial-run rows without touching
   * human-reviewed threats. Optional for backward compat with callers that
   * don't have a job id (manual imports), but omitting it means those
   * rows can't be auto-cleaned on job failure.
   */
  sessionId?: string,
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  /**
   * Set when MAX_THREATS_PER_COMPONENT_PER_RUN refused to write the
   * WHOLE batch (as opposed to `skipped` counting individual duplicate/
   * reviewed threats within an otherwise-accepted batch). Callers (e.g.
   * micro-analysis/pipeline.ts) use this to tell "the cap ate this batch"
   * apart from "everything in this batch matched an existing/reviewed
   * threat" — both are success-shaped `{ created: 0 }` otherwise.
   */
  capped?: boolean;
  /**
   * Duplicate guard: new threats NOT created because the detector put them
   * in the merge band with an existing threat (human-authored, reviewed, or
   * written by an earlier run). Each entry links to the threat it repeats.
   */
  linked?: LinkedDuplicate[];
}> {
  const prisma = await getPrisma();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const linked: LinkedDuplicate[] = [];

  // Anomaly alarm. Count threats per component in this batch; if any
  // component exceeds the cap, abort before writing. The cap protects
  // against future upstream bugs that would otherwise silently append
  // hundreds of paraphrase-dup rows.
  const perComponentCount = new Map<string, number>();
  for (const t of threats) {
    const key = t.componentId || "__compound__";
    perComponentCount.set(key, (perComponentCount.get(key) ?? 0) + 1);
  }
  for (const [compId, count] of perComponentCount) {
    if (count > MAX_THREATS_PER_COMPONENT_PER_RUN) {
      logger.error(
        {
          threatModelId,
          sessionId,
          componentId: compId,
          count,
          cap: MAX_THREATS_PER_COMPONENT_PER_RUN,
        },
        "Anomaly cap exceeded — refusing to write batch. Pipeline is likely looping.",
      );
      return { created: 0, updated: 0, skipped: threats.length, capped: true };
    }
  }

  // Long-running AI jobs (~5 min) can outlive the threat model if the user
  // deletes it mid-analysis. Check before inserting to avoid FK violations.
  const modelExists = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    select: { id: true },
  });
  if (!modelExists) {
    logger.warn(
      { threatModelId, threatCount: threats.length },
      "Threat model no longer exists — skipping AI threat persistence",
    );
    return { created: 0, updated: 0, skipped: threats.length };
  }

  // Build DB component ID → React Flow nodeId map so we store the canvas
  // node ID (which the frontend uses for filtering), not the database ID.
  const components = await prisma.component.findMany({
    where: { threatModelId },
    select: { id: true, nodeId: true, analysisHash: true },
  });
  const dbIdToNodeId = new Map(components.map((c) => [c.id, c.nodeId]));
  const dbIdToHash = new Map(components.map((c) => [c.id, c.analysisHash]));

  // Load existing threats — narrow to batchScope.componentNodeId when present
  // so a per-component streaming write doesn't cross-match other components.
  const existing = await prisma.threat.findMany({
    where: {
      threatModelId,
      ...(batchScope?.componentNodeId
        ? { componentNodeId: batchScope.componentNodeId }
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      componentNodeId: true,
      connectionEdgeId: true,
      strideCategories: true,
      cweIds: true,
      reviewStatus: true,
      source: true,
      manuallyEdited: true,
      analysisSessionId: true,
      dedupSupersededById: true,
    },
  });

  // Duplicate guard (re-analysis): existing threats a new one may repeat —
  // anything not written by THIS session (in-run duplicates are the in-memory
  // guard's job) and not already marked as a superseded duplicate.
  const linkCandidates = new Map<string, DetectorThreat[]>();
  for (const t of existing) {
    if (sessionId && t.analysisSessionId === sessionId) continue;
    if (t.dedupSupersededById) continue;
    const target = t.componentNodeId || t.connectionEdgeId || "__compound__";
    const list = linkCandidates.get(target) ?? [];
    list.push({
      id: t.id,
      name: t.name,
      description: t.description,
      targetId: target,
      categories: parseStringArray(t.strideCategories),
      cweIds: parseStringArray(t.cweIds),
      mitigations: [],
      source: t.source === "AI_SUGGESTED" ? "ai" : "human",
      manuallyEdited: t.manuallyEdited,
    });
    linkCandidates.set(target, list);
  }

  // Build lookup: normalized-name → existing threat. Uses the new
  // paraphrase-resistant normalizer, so "Unauthenticated X" and
  // "Missing auth on X" collapse to the same key.
  const existingMap = new Map<string, (typeof existing)[number]>();
  for (const t of existing) {
    const target = t.componentNodeId || "__compound__";
    const key = `${target}::${normalizeThreatName(t.name)}`;
    existingMap.set(key, t);
  }

  for (const threat of threats) {
    // Resolve DB component ID to React Flow nodeId for storage and dedup
    const resolvedNodeId = threat.componentId
      ? dbIdToNodeId.get(threat.componentId) || threat.componentId
      : "";
    const normalizedName = normalizeThreatName(threat.name);
    const targetForKey = resolvedNodeId || "__compound__";
    const key = `${targetForKey}::${normalizedName}`;
    const match = existingMap.get(key);

    if (match) {
      // Existing threat — check review status or manual edit flag
      if (
        match.reviewStatus === "ACCEPTED" ||
        match.reviewStatus === "MODIFIED" ||
        match.reviewStatus === "REJECTED" ||
        match.manuallyEdited
      ) {
        // Human already reviewed or edited — DO NOT touch
        skipped++;
        continue;
      }

      // PENDING — AI can update with improved analysis
      const cvss = autoScoreThreat(threat);
      await prisma.threat.update({
        where: { id: match.id },
        data: {
          description: threat.description,
          severity: threat.severity,
          cvssVector31: cvss.vector31,
          cvssScore31: cvss.score31,
          cvssVector40: cvss.vector40,
          cvssScore40: cvss.score40,
          aiConfidence: threat.confidence,
          aiMethodology: threat.sourceMethodology,
          attackVector: threat.evidence.attackPath
            ? JSON.stringify(threat.evidence.attackPath)
            : null,
          residualRisk: null,
          evidence: JSON.stringify(threat.evidence),
          normalizedName,
          // analysisSessionId is DELIBERATELY NOT re-stamped here.
          //
          // cleanupSessionThreats deletes every AI_SUGGESTED + PENDING +
          // unedited row carrying a failed job's sessionId. That is correct for
          // rows the failed job CREATED — they are partial writes. This branch
          // updates a row that already existed, typically from an earlier
          // SUCCESSFUL run. Re-stamping it moved someone else's surviving work
          // into this session's blast radius: if this job then failed, cleanup
          // deleted a threat the previous run had legitimately produced.
          //
          // The stamp means "this session created this row", so only the create
          // branch may set it. An update is not a partial write.
        },
      });

      // Refresh mitigations if this pass produced any (the mitigation-analyzer
      // pass runs after the streaming write; the final persist pass carries them).
      //
      // Scoped to source AI. status NOT_IMPLEMENTED + verified false are the
      // schema defaults, so before the source filter this predicate matched a
      // hand-written or template-instantiated mitigation in its NORMAL state —
      // every rerun silently destroyed remediation work nobody had got to yet.
      // IMPLEMENTED and verified rows stay excluded as a second line of defence.
      if (threat.mitigations && threat.mitigations.length > 0) {
        await prisma.mitigation.deleteMany({
          where: {
            threatId: match.id,
            source: "AI",
            status: "NOT_IMPLEMENTED",
            verified: false,
          },
        });
        for (const mit of threat.mitigations) {
          const created = await prisma.mitigation.create({
            data: {
              description: mit.description,
              strategy: mapMitigationStrategy(mit.controlCategory),
              controlCategory: mit.controlCategory || null,
              effectivenessScore: parseFloat(mit.effectiveness) || null,
              testCriteria: mit.testCriteria || null,
              threatId: match.id,
              createdById: userId,
              source: "AI",
            },
          });
          await linkMitigationRequirements(
            threatModelId,
            created.id,
            mit.description,
          );
          if (mit.suggestedRequirement?.text) {
            await persistSuggestedRequirement(
              threatModelId,
              userId,
              created.id,
              mit.suggestedRequirement,
            );
          }
        }
      }
      updated++;
    } else {
      // Duplicate guard: a reworded repeat of an existing threat (merge band,
      // same target) is linked to it instead of being created again. The
      // existing row is never touched — human decisions stay sacred.
      const repeatOf = findMergeMatch(
        {
          id: "__new__",
          name: threat.name,
          description: threat.description,
          targetId: targetForKey,
          categories: [threat.category],
          cweIds: threat.cweIds,
          mitigations: [],
          source: "ai",
        },
        linkCandidates.get(targetForKey) ?? [],
      );
      if (repeatOf) {
        linked.push({
          name: threat.name,
          componentNodeId: resolvedNodeId || null,
          existingThreatId: repeatOf.a === "__new__" ? repeatOf.b : repeatOf.a,
          score: repeatOf.score,
        });
        skipped++;
        continue;
      }

      // New threat — create with AI metadata + CVSS + session tag + normalized
      // name for the unique constraint. If a concurrent writer just inserted
      // a matching row (P2002), we skip — the DB constraint is the backstop
      // for the job mutex.
      const cvss = autoScoreThreat(threat);
      let createdThreat;
      try {
        createdThreat = await prisma.threat.create({
          data: {
            name: threat.name,
            description: threat.description,
            strideCategories: JSON.stringify([threat.category]),
            severity: threat.severity,
            status: "OPEN",
            threatModelId,
            componentNodeId: resolvedNodeId || null,
            cweIds:
              threat.cweIds.length > 0
                ? JSON.stringify(threat.cweIds)
                : threat.evidence.cwe
                  ? JSON.stringify([threat.evidence.cwe])
                  : "[]",
            owaspIds:
              threat.owaspIds.length > 0
                ? JSON.stringify(threat.owaspIds)
                : threat.evidence.owasp
                  ? JSON.stringify([threat.evidence.owasp])
                  : "[]",
            source: "AI_SUGGESTED",
            reviewStatus: "PENDING",
            cvssVector31: cvss.vector31,
            cvssScore31: cvss.score31,
            cvssVector40: cvss.vector40,
            cvssScore40: cvss.score40,
            aiConfidence: threat.confidence,
            aiMethodology: threat.sourceMethodology,
            attackVector: threat.evidence.attackPath
              ? JSON.stringify(threat.evidence.attackPath)
              : null,
            evidence: JSON.stringify(
              threat.cveIds?.length
                ? { ...threat.evidence, cveIds: threat.cveIds }
                : threat.evidence,
            ),
            analysisHash: threat.componentId
              ? (dbIdToHash.get(threat.componentId) ?? null)
              : null,
            normalizedName,
            ...(sessionId ? { analysisSessionId: sessionId } : {}),
            createdById: userId,
          },
        });
      } catch (err: unknown) {
        // P2002 unique constraint — concurrent writer won the race. Skip
        // instead of duplicating. This should be rare given the job mutex.
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          logger.warn(
            {
              threatModelId,
              sessionId,
              componentId: resolvedNodeId,
              normalizedName,
            },
            "Threat unique constraint conflict — another writer got there first, skipping",
          );
          skipped++;
          continue;
        }
        throw err;
      }

      // Create mitigation records from AI-generated mitigations
      const createdMitigationIds: string[] = [];
      if (threat.mitigations && threat.mitigations.length > 0) {
        for (const mit of threat.mitigations) {
          const created = await prisma.mitigation.create({
            data: {
              description: mit.description,
              strategy: mapMitigationStrategy(mit.controlCategory),
              controlCategory: mit.controlCategory || null,
              effectivenessScore: parseFloat(mit.effectiveness) || null,
              testCriteria: mit.testCriteria || null,
              threatId: createdThreat.id,
              createdById: userId,
              source: "AI",
            },
          });
          createdMitigationIds.push(created.id);

          // Link MitigationRequirement junction rows for any [req:REQ-ID] tags
          // the LLM embedded in the mitigation description. Failures are
          // swallowed so traceability never blocks persistence.
          await linkMitigationRequirements(
            threatModelId,
            created.id,
            mit.description,
          );

          // When the LLM proposed a NEW requirement because no existing one
          // applied, persist it as source=AI_SUGGESTED, reviewStatus=PENDING
          // and link it to the mitigation so the traceability chain is
          // closed immediately. User reviews / accepts / rejects later.
          if (mit.suggestedRequirement?.text) {
            await persistSuggestedRequirement(
              threatModelId,
              userId,
              created.id,
              mit.suggestedRequirement,
            );
          }
        }
      }

      // Citation verification — opt-in, non-blocking. Runs against the
      // threat description and each mitigation description; writes
      // Citation rows and rolls up verificationStatus on the owner.
      if (verifyClient) {
        await runCitationVerification(
          verifyClient,
          threatModelId,
          createdThreat.id,
          threat.description,
          createdMitigationIds,
          threat.mitigations?.map((m) => m.description) ?? [],
        );
      }
      created++;
    }
  }

  logger.info(
    {
      threatModelId,
      created,
      updated,
      skipped,
      linked: linked.length,
      total: threats.length,
    },
    "AI threats persisted",
  );

  return { created, updated, skipped, ...(linked.length ? { linked } : {}) };
}

export interface LinkedDuplicate {
  name: string;
  componentNodeId: string | null;
  existingThreatId: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Requirement traceability — parse [req:REQ-ID] tags and write junction rows
// ---------------------------------------------------------------------------

async function linkMitigationRequirements(
  threatModelId: string,
  mitigationId: string,
  description: string,
): Promise<void> {
  try {
    const parsed = parseClaim(description);
    const reqIds = parsed.citations
      .filter((c) => c.type === "REQUIREMENT" && c.requirementId)
      .map((c) => c.requirementId!);
    if (reqIds.length === 0) return;

    const prisma = await getPrisma();
    const found = await prisma.requirement.findMany({
      where: {
        threatModelId,
        reqId: { in: reqIds },
        supersededAt: null,
      },
      select: { id: true, reqId: true },
    });
    if (found.length === 0) return;

    await prisma.mitigationRequirement.createMany({
      data: found.map((r) => ({ mitigationId, requirementId: r.id })),
    });

    logger.debug(
      {
        mitigationId,
        linked: found.length,
        phantomReqs: reqIds.length - found.length,
      },
      "mitigation requirement junctions written",
    );
  } catch (err) {
    logger.warn(
      { err, mitigationId },
      "failed to link mitigation requirements — traceability missing but persistence OK",
    );
  }
}

/**
 * Persist an AI-suggested requirement for user review.
 *
 * Dedupe by (threatModelId, normalized text): if a suggested req with
 * identical text already exists for this model, reuse its id rather than
 * spawning duplicates when the same policy statement covers multiple
 * mitigations across threats.
 *
 * Always creates a MitigationRequirement junction row so the traceability
 * chain is visible in the UI even before the user reviews the suggestion.
 */
async function persistSuggestedRequirement(
  threatModelId: string,
  userId: string,
  mitigationId: string,
  suggestion: { text: string; category?: string },
): Promise<void> {
  try {
    const prisma = await getPrisma();
    const normalizedText = suggestion.text.trim();
    if (!normalizedText) return;

    // Dedupe: look for an existing AI_SUGGESTED req with matching text
    // scoped to this threat model. Case-insensitive exact match.
    const existing = await prisma.requirement.findFirst({
      where: {
        threatModelId,
        source: "AI_SUGGESTED",
        supersededAt: null,
        text: { equals: normalizedText },
      },
      select: { id: true },
    });

    let requirementId = existing?.id;
    if (!requirementId) {
      // Generate a short, human-readable reqId scoped to this model.
      // "SGR-<4char>" — SGR = SuGgested Requirement.
      const reqId = `SGR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const created = await prisma.requirement.create({
        data: {
          reqId,
          text: normalizedText,
          category: suggestion.category || "security",
          source: "AI_SUGGESTED",
          reviewStatus: "PENDING",
          threatModelId,
          createdById: userId,
        },
        select: { id: true },
      });
      requirementId = created.id;
    }

    // Junction (idempotent via @@unique on [mitigationId, requirementId])
    await prisma.mitigationRequirement
      .create({
        data: { mitigationId, requirementId },
      })
      .catch(() => {
        /* unique-constraint retry is fine — link already exists */
      });
  } catch (err) {
    logger.warn(
      { err, mitigationId },
      "failed to persist AI-suggested requirement — mitigation saved but suggestion dropped",
    );
  }
}

// ---------------------------------------------------------------------------
// Citation verification helper
// ---------------------------------------------------------------------------

async function runCitationVerification(
  verifyClient: AIProviderClient,
  threatModelId: string,
  threatId: string,
  threatDescription: string | null | undefined,
  mitigationIds: string[],
  mitigationDescriptions: string[],
): Promise<void> {
  try {
    const prisma = await getPrisma();
    const claims: Parameters<typeof verifyClaims>[3] = [];

    if (threatDescription) {
      claims.push({
        ownerType: "threat",
        ownerId: threatId,
        parsed: parseClaim(threatDescription),
      });
    }

    for (let i = 0; i < mitigationIds.length; i++) {
      const desc = mitigationDescriptions[i];
      if (!desc) continue;
      claims.push({
        ownerType: "mitigation",
        ownerId: mitigationIds[i],
        parsed: parseClaim(desc),
      });
    }

    if (claims.length === 0) return;

    await verifyClaims(prisma, verifyClient, threatModelId, claims);
  } catch (err) {
    // Verification failures MUST NOT block threat persistence. Threats
    // remain in verificationStatus=PENDING and can be re-verified later.
    logger.warn(
      { err, threatId, threatModelId },
      "citation verification failed for persisted threat — remains PENDING",
    );
  }
}

// ---------------------------------------------------------------------------
// Load Reviewed Threats (for AI context on re-run)
// ---------------------------------------------------------------------------

/**
 * Get human-reviewed threats for a model. These are passed to the AI
 * as context so it doesn't regenerate what humans already decided on.
 */
export async function getReviewedThreats(threatModelId: string): Promise<
  Array<{
    name: string;
    componentNodeId: string | null;
    category: string;
    severity: string;
    reviewStatus: string;
    reviewNotes: string | null;
  }>
> {
  const prisma = await getPrisma();
  const reviewed = await prisma.threat.findMany({
    where: {
      threatModelId,
      reviewStatus: { in: ["ACCEPTED", "REJECTED", "MODIFIED"] },
    },
    select: {
      name: true,
      componentNodeId: true,
      strideCategories: true,
      severity: true,
      reviewStatus: true,
      reviewNotes: true,
    },
  });

  return reviewed.map((t) => ({
    name: t.name,
    componentNodeId: t.componentNodeId,
    category: JSON.parse(t.strideCategories)[0] || "UNKNOWN",
    severity: t.severity,
    reviewStatus: t.reviewStatus,
    reviewNotes: t.reviewNotes,
  }));
}

// ---------------------------------------------------------------------------
// Session cleanup — failure/cancellation hooks
// ---------------------------------------------------------------------------

/**
 * Delete partial-write AI threats from a specific analysis session.
 *
 * Called when:
 *   - A SUGGEST_THREATS job fails (BullMQ failure handler)
 *   - A job is cancelled by the user
 *   - The startup sweeper finds rows tagged with FAILED/CANCELLED jobs
 *
 * Only deletes `AI_SUGGESTED` `PENDING` `manuallyEdited=false` rows. Human
 * decisions (ACCEPTED/MODIFIED/REJECTED) and manual edits are always kept.
 * Mitigations cascade via the `onDelete: Cascade` relation.
 */
export async function cleanupSessionThreats(sessionId: string): Promise<{
  deleted: number;
}> {
  if (!sessionId) return { deleted: 0 };
  const prisma = await getPrisma();
  const result = await prisma.threat.deleteMany({
    where: {
      analysisSessionId: sessionId,
      source: "AI_SUGGESTED",
      reviewStatus: "PENDING",
      manuallyEdited: false,
    },
  });
  if (result.count > 0) {
    logger.info(
      { sessionId, deleted: result.count },
      "Cleaned up partial-write threats from failed/cancelled session",
    );
  }
  return { deleted: result.count };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map control category to MitigationStrategy enum */
function mapMitigationStrategy(
  category?: string,
): "PREVENTION" | "DETECTION" | "RESPONSE" | "RECOVERY" | "DETERRENCE" {
  switch (category) {
    case "LOGGING":
    case "MONITORING":
      return "DETECTION";
    case "BACKUP":
      return "RECOVERY";
    default:
      return "PREVENTION";
  }
}
