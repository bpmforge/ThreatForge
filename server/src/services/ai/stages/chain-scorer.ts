/**
 * ChainScorer stage handler — attack-chain Pass 5.
 * AGENTIC_AI.md "Pass 5 — Mitigation Effectiveness" (canonical).
 *
 * For each validated chain (survivors of Pass 4), evaluate which EXISTING
 * mitigations — when their `status` is IMPLEMENTED — break a hop, and compute a
 * residual chain severity. This reuses the SHARED "realistic mitigation
 * effectiveness" model (services/risk/residual-severity.ts: 0–85 % cap,
 * diminishing returns) rather than reinventing the math.
 *
 * A hop is "broken" by its threat's IMPLEMENTED mitigations: their
 * effectivenessScores compound (diminishing returns) into a residual fraction
 * for that hop. The chain's residual severity drops based on the MOST-mitigated
 * hop (the chokepoint that most limits the attacker).
 *
 * Persistence: when `persist` is supplied (job path), each validated chain is
 * written via the AttackChain CRUD (`prisma.attackChain.create`) as
 * AI_SUGGESTED, carrying `residualSeverity` and per-hop `isMitigated` +
 * `mitigationIds`. DB-free (scoring only, no write) when `persist` is absent —
 * the same convention the path generator uses.
 */
import type { ParseFailure } from "../micro-analysis/types.js";
import { getPrisma } from "../../../db.js";
import {
  residualChainSeverity,
  residualFraction,
  type SeverityLabel,
} from "../../risk/residual-severity.js";
import type { ThreatModelContext } from "../../../types/ai.js";
import type { CandidateChain } from "./path-generator.js";
import type { StageContext, StageResult } from "./registry.js";
import logger from "../../../utils/logger.js";

interface ChainScorerInputs {
  validatedChains: CandidateChain[];
  /** Topology — used to resolve hop component names for persistence. */
  context?: ThreatModelContext;
  /** Persist scored chains AI_SUGGESTED (job path). Scoring-only when absent. */
  persist?: { threatModelId: string };
}

/** A hop's breaking-mitigation evaluation. */
interface HopMitigation {
  threatId: string | null;
  isMitigated: boolean;
  mitigationIds: string[];
  /** Residual fraction (0–1) of risk surviving the IMPLEMENTED mitigations. */
  residualFraction: number;
}

/** A scored chain ready for persistence / inspection. */
export interface ScoredChain {
  chain: CandidateChain;
  residualSeverity: SeverityLabel;
  hopMitigations: HopMitigation[];
}

/** A model threat with its mitigations (the index the scorer reasons over). */
export interface ThreatWithMitigations {
  id: string;
  componentNodeId: string | null;
  normalizedName: string;
  mitigations: Array<{
    id: string;
    status: string;
    effectivenessScore: number | null;
  }>;
}

/**
 * Build the threatRef → threat index. A hop's `threatRef` is the stable
 * `componentNodeId::normalizedName` handle (see path-generator-persist
 * buildThreatRef / verifier-checks threatRefOf), so the index is keyed the same
 * way and resolution is exact.
 */
export function buildThreatIndex(
  threats: ThreatWithMitigations[],
): Map<string, ThreatWithMitigations> {
  const idx = new Map<string, ThreatWithMitigations>();
  for (const t of threats) {
    const key = `${t.componentNodeId ?? "__compound__"}::${t.normalizedName}`;
    idx.set(key, t);
  }
  return idx;
}

/**
 * Evaluate one hop: resolve its threat, gather IMPLEMENTED mitigations, and
 * compute the residual fraction surviving them (diminishing returns). A hop is
 * `isMitigated` when ≥ 1 IMPLEMENTED mitigation with a positive effectiveness
 * applies.
 */
function evaluateHop(
  threatRef: string,
  index: Map<string, ThreatWithMitigations>,
): HopMitigation {
  const threat = index.get(threatRef);
  if (!threat) {
    return {
      threatId: null,
      isMitigated: false,
      mitigationIds: [],
      residualFraction: 1,
    };
  }
  const implemented = threat.mitigations.filter(
    (m) => m.status === "IMPLEMENTED" && (m.effectivenessScore ?? 0) > 0,
  );
  const scores = implemented.map((m) => m.effectivenessScore ?? 0);
  return {
    threatId: threat.id,
    isMitigated: implemented.length > 0,
    mitigationIds: implemented.map((m) => m.id),
    residualFraction: residualFraction(scores),
  };
}

/**
 * Score one chain: evaluate every hop, then drop the chain's base severity by
 * the residual fraction of its MOST-mitigated (chokepoint) hop.
 */
export function scoreChain(
  chain: CandidateChain,
  index: Map<string, ThreatWithMitigations>,
): ScoredChain {
  const hopMitigations = chain.hops.map((h) => evaluateHop(h.threatRef, index));
  const breakingFractions = hopMitigations
    .filter((h) => h.isMitigated)
    .map((h) => h.residualFraction);
  const residualSeverity = residualChainSeverity(
    chain.severity as SeverityLabel,
    breakingFractions,
  );
  return { chain, residualSeverity, hopMitigations };
}

export async function chainScorerStage(
  ctx: StageContext,
): Promise<StageResult> {
  const inputs = ctx.inputs as unknown as ChainScorerInputs;
  const { validatedChains, context, persist } = inputs;
  if (!Array.isArray(validatedChains))
    throw new Error("ChainScorer requires inputs.validatedChains");

  const nameById = new Map(
    (context?.components ?? []).map((c) => [c.id, c.name]),
  );

  const parseFailures: ParseFailure[] = [];

  // Load the model's threats + mitigations to resolve breaking controls.
  let index = new Map<string, ThreatWithMitigations>();
  if (persist) {
    const prisma = await getPrisma();
    const threats = (await prisma.threat.findMany({
      where: { threatModelId: persist.threatModelId },
      select: {
        id: true,
        componentNodeId: true,
        normalizedName: true,
        mitigations: {
          select: { id: true, status: true, effectivenessScore: true },
        },
      },
    })) as ThreatWithMitigations[];
    index = buildThreatIndex(threats);
  }

  const scored = validatedChains.map((c) => scoreChain(c, index));

  await ctx.progress(
    50,
    `Chain scoring: ${scored.length} chains scored for residual severity`,
  );

  // --- Persist scored chains AI_SUGGESTED via the AttackChain CRUD. -----
  let persisted = 0;
  if (persist) {
    const prisma = await getPrisma();
    for (const sc of scored) {
      try {
        await prisma.attackChain.create({
          data: {
            threatModelId: persist.threatModelId,
            name: sc.chain.name,
            description: sc.chain.description,
            severity: sc.chain.severity,
            residualSeverity: sc.residualSeverity,
            likelihood: sc.chain.likelihood ?? null,
            status: "AI_SUGGESTED",
            sessionId: ctx.sessionId,
            entryPointId: sc.chain.entryPointId,
            entryPointName: sc.chain.entryPointName,
            targetAssetId: sc.chain.targetAssetId,
            targetAssetName: sc.chain.targetAssetName,
            hops: {
              create: sc.chain.hops.map((hop, i) => ({
                position: i,
                componentId: hop.componentId,
                componentName: nameById.get(hop.componentId) ?? hop.componentId,
                connectionId: hop.connectionId ?? null,
                threatId: sc.hopMitigations[i].threatId,
                description: hop.description,
                technique: hop.technique ?? null,
                isMitigated: sc.hopMitigations[i].isMitigated,
                mitigationIds: JSON.stringify(
                  sc.hopMitigations[i].mitigationIds,
                ),
                preconditions: JSON.stringify(hop.preconditions),
                yields: JSON.stringify(hop.yields),
              })),
            },
          },
        });
        persisted++;
      } catch (err) {
        logger.warn(
          { err, chain: sc.chain.name, stage: "ChainScorer" },
          "Failed to persist scored attack chain",
        );
      }
    }
  }

  await ctx.progress(
    100,
    `Chain scoring: ${scored.length} scored, ${persisted} persisted AI_SUGGESTED`,
  );

  return {
    outputs: {
      scoredChains: scored.map((sc) => ({
        name: sc.chain.name,
        severity: sc.chain.severity,
        residualSeverity: sc.residualSeverity,
        entryPointId: sc.chain.entryPointId,
        targetAssetId: sc.chain.targetAssetId,
        hopMitigations: sc.hopMitigations,
      })),
      chainsPersisted: persisted,
    },
    tokensUsed: 0,
    parseFailures,
  };
}
