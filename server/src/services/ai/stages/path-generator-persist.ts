/**
 * PathGenerator new-threat persistence helper.
 *
 * A pass-3 hop may exploit a threat NOT yet in the model (`newThreat`). Per
 * ADR-006 these are persisted AI_SUGGESTED through the SAME dedup path the
 * threat pipeline uses (`persistAIThreats`) — never a bespoke insert. The
 * resulting threat is then resolved back to a stable handle so the hop's
 * `threatRef` points at the persisted row.
 *
 * Idempotency: `persistAIThreats` matches on `${targetKey}::${normalizedName}`,
 * so persisting the same new-threat twice updates the existing PENDING row
 * rather than creating a duplicate. Running path generation twice therefore
 * yields the SAME threatRef and exactly one stored threat (the dedup guarantee).
 */
import { getPrisma } from "../../../db.js";
import { persistAIThreats } from "../../threat-review/review-service.js";
import { normalizeThreatName } from "../../threat-review/normalize-threat-name.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import type { HopZShape } from "../schemas/llm-response-schemas.js";

/** Build the stable handle used as a hop threatRef: `targetKey::normalizedName`. */
function buildThreatRef(componentNodeId: string, threatName: string): string {
  return `${componentNodeId || "__compound__"}::${normalizeThreatName(threatName)}`;
}

/** Adapt a hop's `newThreat` to the MicroThreat shape persistAIThreats takes. */
function toMicroThreat(
  hop: HopZShape,
  componentName: string,
): MicroThreat | null {
  if (!hop.newThreat) return null;
  const nt = hop.newThreat;
  return {
    name: nt.name,
    description: nt.description,
    category: nt.category ?? "TAMPERING",
    severity: nt.severity === "INFO" ? "LOW" : nt.severity,
    componentId: hop.componentId,
    componentName,
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "low", effectiveness: "0.5" },
    confidence: 0.6,
    sourceMethodology: "attack-chain",
  };
}

export interface PersistNewThreatResult {
  /** The resolved `targetKey::normalizedName` handle for the hop. */
  threatRef: string;
  /** The persisted threat row id (for AttackChainHop.threatId), if resolvable. */
  threatId: string | null;
  created: number;
}

/**
 * Persist a hop's proposed new threat AI_SUGGESTED via the dedup path, then
 * resolve its id + canonical threatRef. The hop's `componentId` is the canvas
 * node id (same id space the chain echoes), which is what persistAIThreats
 * stores as `componentNodeId` when it is not a DB component id — so the
 * resolved threatRef is deterministic and stable across runs.
 */
export async function persistHopNewThreat(
  threatModelId: string,
  userId: string,
  hop: HopZShape,
  componentName: string,
  sessionId: string | undefined,
): Promise<PersistNewThreatResult> {
  const micro = toMicroThreat(hop, componentName);
  if (!micro) {
    // Caller guards on hop.newThreat; defensive only.
    return { threatRef: hop.threatRef, threatId: null, created: 0 };
  }

  const result = await persistAIThreats(
    threatModelId,
    userId,
    [micro],
    undefined, // skip citation verification — chain hops carry no citations
    { componentNodeId: hop.componentId, methodology: "attack-chain" },
    sessionId,
  );

  const threatRef = buildThreatRef(hop.componentId, micro.name);
  const prisma = await getPrisma();
  const row = await prisma.threat.findFirst({
    where: {
      threatModelId,
      componentNodeId: hop.componentId,
      normalizedName: normalizeThreatName(micro.name),
    },
    select: { id: true },
  });

  return { threatRef, threatId: row?.id ?? null, created: result.created };
}
