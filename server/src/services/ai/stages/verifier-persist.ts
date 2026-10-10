/**
 * Verifier persistence: the only place the challenger gate touches the
 * DB. Split out of verifier.ts so the stage stays within the service line
 * budget and the deletion-safety filter is testable in isolation.
 *
 * SAFETY INVARIANT (asserted here in code): every write is
 * scoped to AI_SUGGESTED, reviewStatus=PENDING, manuallyEdited=false rows
 * tagged with THIS sessionId. Human-authored, human-reviewed, or human-edited
 * threats can never be deleted or relabelled by the gate. No sessionId → no-op.
 */
import type { PrismaClient } from "@prisma/client";

export type VerifierPersist = { threatModelId: string; sessionId?: string };

/**
 * The two id spaces this file has to reconcile.
 *
 * A `MicroThreat.componentId` is a **DB component id**, so every ref key the
 * gate produces (`threatRefOf`) is in DB-id space. `persistAIThreats` stores
 * the *canvas* id: `componentNodeId = dbIdToNodeId.get(componentId) || componentId`.
 * Comparing a ref key straight against `componentNodeId` therefore only matched
 * when the two ids happened to be the same string — so on any real model the
 * gate deleted nothing and flagged nothing, while still reporting a count.
 *
 * Both directions are needed: deleteRefuted lifts stored rows back into DB-id
 * space, flagKept pushes ref keys down into stored space. The `?? raw` fallback
 * on each mirrors persistAIThreats's `|| componentId`, which is what keeps
 * topology-refuted ghosts (ids that resolve to no component) matching.
 */
export interface NodeIdMaps {
  dbIdToNodeId: Map<string, string>;
  nodeIdToDbId: Map<string, string>;
}

const NO_MAPS: NodeIdMaps = {
  dbIdToNodeId: new Map(),
  nodeIdToDbId: new Map(),
};

export interface VerifierDecision {
  threatRef: string; // normalizedName::targetKey
  challengeStatus: "CONFIRMED" | "UNCERTAIN";
  verificationNote?: string;
}

/** The session-scoped filter shared by both writers — the safety boundary. */
function sessionScope(persist: VerifierPersist) {
  return {
    threatModelId: persist.threatModelId,
    analysisSessionId: persist.sessionId, // THIS session only
    source: "AI_SUGGESTED" as const, // never human-authored
    reviewStatus: "PENDING" as const, // never human-reviewed
    manuallyEdited: false, // never human-edited
  };
}

async function loadPrisma(): Promise<PrismaClient> {
  const { getPrisma } = await import("../../../db.js");
  return getPrisma();
}

/**
 * Delete confidently-refuted rows. Resolves session rows, then keeps only the
 * ids whose (normalizedName::target) handle is in refKeys. Returns the count.
 */
export async function deleteRefuted(
  persist: VerifierPersist,
  refKeys: Set<string>,
  prismaOverride?: PrismaClient,
  maps: NodeIdMaps = NO_MAPS,
): Promise<number> {
  if (!persist.sessionId || refKeys.size === 0) return 0;
  const prisma = prismaOverride ?? (await loadPrisma());
  const rows = await prisma.threat.findMany({
    where: sessionScope(persist),
    select: {
      id: true,
      componentNodeId: true,
      connectionEdgeId: true,
      normalizedName: true,
    },
  });
  const ids = rows
    .filter((r) => {
      const stored = r.componentNodeId || r.connectionEdgeId || "__compound__";
      // Lift the stored canvas id back into the DB-id space the ref keys use.
      const target = maps.nodeIdToDbId.get(stored) ?? stored;
      return refKeys.has(`${r.normalizedName ?? ""}::${target}`);
    })
    .map((r) => r.id);
  if (ids.length === 0) return 0;
  const res = await prisma.threat.deleteMany({ where: { id: { in: ids } } });
  return res.count;
}

/** Flag kept rows with their challenge verdict (CONFIRMED / UNCERTAIN). */
export async function flagKept(
  persist: VerifierPersist,
  decisions: VerifierDecision[],
  prismaOverride?: PrismaClient,
  maps: NodeIdMaps = NO_MAPS,
): Promise<void> {
  if (!persist.sessionId || decisions.length === 0) return;
  const prisma = prismaOverride ?? (await loadPrisma());
  for (const d of decisions) {
    const [normalizedName, refTarget] = d.threatRef.split("::");
    const compound = refTarget === "__compound__";
    // Push the ref key's DB id down into the stored canvas-id space.
    const target = maps.dbIdToNodeId.get(refTarget) ?? refTarget;
    await prisma.threat.updateMany({
      where: {
        ...sessionScope(persist),
        normalizedName,
        OR: [
          { componentNodeId: compound ? null : target },
          { connectionEdgeId: compound ? null : target },
        ],
      },
      data: {
        challengeStatus: d.challengeStatus,
        verificationNote: d.verificationNote ?? null,
      },
    });
  }
}
