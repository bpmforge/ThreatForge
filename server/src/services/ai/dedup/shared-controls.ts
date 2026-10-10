/**
 * Persist the duplicate guard's shared-control groups as ArchitecturalMitigation
 * rows (kind OTHER), one row per control, `threatIds` = every threat it closes.
 *
 * Why this table: a Mitigation row belongs to exactly one threat, while an
 * ArchitecturalMitigation already carries a JSON `threatIds` list and the
 * AI_SUGGESTED → ACCEPTED/REJECTED review lifecycle. No schema change.
 *
 * Ownership mirrors planArchitecturalMitigationWrite: only rows this guard
 * wrote (marker in `rationale`) that are still source=AI + AI_SUGGESTED are
 * replaced on a rerun; a human-reviewed one is kept and its control is not
 * suggested again. Rows from the ARCHITECTURAL_MITIGATIONS job are never
 * touched here, and that job leaves guard rows alone in turn
 * (planArchitecturalMitigationWrite excludes the marker).
 */
import type { PrismaClient } from "@prisma/client";
import type { MicroThreat } from "../micro-analysis/types.js";
import type { LinkedDuplicate } from "../../threat-review/review-service.js";
import { normalizeThreatName } from "../../threat-review/normalize-threat-name.js";
import {
  architecturalMitigationRowData,
  isSharedControlRow,
  SHARED_CONTROL_MARKER,
  type GeneratedArchitecturalMitigation,
} from "../architectural-mitigation-service.js";

export { SHARED_CONTROL_MARKER };

const PRIORITY_BY_SEVERITY: Record<
  MicroThreat["severity"],
  GeneratedArchitecturalMitigation["priority"]
> = { CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" };
const SEVERITY_RANK: Record<MicroThreat["severity"], number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const normControl = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function persistSharedControls(args: {
  prisma: PrismaClient;
  threatModelId: string;
  sessionId: string;
  groups: Array<{ control: string; threats: MicroThreat[] }>;
  /** DB component id → canvas nodeId (threat rows store the nodeId). */
  dbIdToNodeId: Map<string, string>;
  /** Threats persistAIThreats linked to an existing row instead of creating. */
  linked?: LinkedDuplicate[];
}): Promise<{ created: number }> {
  const { prisma, threatModelId, sessionId, dbIdToNodeId } = args;
  if (args.groups.length === 0) return { created: 0 };

  const targetOf = (componentId: string) =>
    (componentId && dbIdToNodeId.get(componentId)) || "__compound__";
  const rows = await prisma.threat.findMany({
    where: { threatModelId },
    select: {
      id: true,
      componentNodeId: true,
      connectionEdgeId: true,
      normalizedName: true,
    },
  });
  const idByKey = new Map<string, string>();
  for (const r of rows) {
    const target = r.componentNodeId || r.connectionEdgeId || "__compound__";
    idByKey.set(`${target}::${r.normalizedName ?? ""}`, r.id);
  }
  for (const l of args.linked ?? []) {
    idByKey.set(
      `${l.componentNodeId || "__compound__"}::${normalizeThreatName(l.name)}`,
      l.existingThreatId,
    );
  }

  const existing = await prisma.architecturalMitigation.findMany({
    where: { threatModelId, kind: "OTHER" },
    select: {
      id: true,
      status: true,
      source: true,
      rationale: true,
      proposedChange: true,
    },
  });
  const ours = existing.filter(isSharedControlRow);
  const replaceable = ours.filter(
    (e) => e.source === "AI" && e.status === "AI_SUGGESTED",
  );
  const reviewedControls = new Set(
    ours
      .filter((e) => !(e.source === "AI" && e.status === "AI_SUGGESTED"))
      .map((e) => normControl(e.proposedChange)),
  );

  const proposals: GeneratedArchitecturalMitigation[] = [];
  for (const g of args.groups) {
    if (reviewedControls.has(normControl(g.control))) continue;
    const threatIds: string[] = [];
    const componentIds: string[] = [];
    let top: MicroThreat["severity"] = "LOW";
    for (const t of g.threats) {
      const id = idByKey.get(
        `${targetOf(t.componentId)}::${normalizeThreatName(t.name)}`,
      );
      if (!id || threatIds.includes(id)) continue;
      threatIds.push(id);
      if (
        dbIdToNodeId.has(t.componentId) &&
        !componentIds.includes(t.componentId)
      )
        componentIds.push(t.componentId);
      if (SEVERITY_RANK[t.severity] > SEVERITY_RANK[top]) top = t.severity;
    }
    if (threatIds.length < 2) continue;
    const title = `Shared control: ${g.control}`;
    proposals.push({
      kind: "OTHER",
      title: title.length > 200 ? `${title.slice(0, 199)}…` : title,
      proposedChange: g.control,
      rationale: `${SHARED_CONTROL_MARKER} One control closes ${threatIds.length} threats; their per-threat mitigations are unchanged.`,
      affectedComponentIds: componentIds,
      affectedConnectionIds: [],
      threatIds,
      attackChainIds: [],
      priority: PRIORITY_BY_SEVERITY[top],
    });
  }
  if (proposals.length === 0) return { created: 0 };

  await prisma.$transaction(async (tx) => {
    if (replaceable.length > 0) {
      await tx.architecturalMitigation.deleteMany({
        where: {
          id: { in: replaceable.map((e) => e.id) },
          status: "AI_SUGGESTED",
          source: "AI",
        },
      });
    }
    for (const p of proposals) {
      await tx.architecturalMitigation.create({
        data: architecturalMitigationRowData(threatModelId, sessionId, p),
      });
    }
  });
  return { created: proposals.length };
}
