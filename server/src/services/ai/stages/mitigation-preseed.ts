/**
 * MitigationSynthesizer — mitigations-only PRESEED.
 *
 * Byte-equivalent port of the legacy pipeline.ts MITIGATIONS-ONLY block
 * (kept separate from the main stage): load existing PENDING, non-manually-
 * edited threats from the DB so the mitigation pass runs against them
 * without re-running threat identification. Logic is copied, not
 * reinterpreted — if pipeline.ts changes, change this the same way.
 */
import { getPrisma } from "../../../db.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import { buildNodeIdMaps } from "./identifier-context.js";

/** Port of pipeline.ts "MITIGATIONS-ONLY: pre-seed allThreats" block. */
export async function preseedExistingThreats(
  threatModelId: string,
  componentNodeIds: string[] | undefined,
): Promise<MicroThreat[]> {
  const prisma = await getPrisma();
  const { nodeIdToDbId } = await buildNodeIdMaps(threatModelId);
  const existing = await prisma.threat.findMany({
    where: {
      threatModelId,
      reviewStatus: "PENDING",
      manuallyEdited: false,
      ...(componentNodeIds?.length
        ? { componentNodeId: { in: componentNodeIds } }
        : {}),
    },
  });

  const seeded: MicroThreat[] = [];
  for (const t of existing) {
    const componentId =
      (t.componentNodeId ? nodeIdToDbId.get(t.componentNodeId) : undefined) ??
      t.componentNodeId ??
      "";
    seeded.push({
      name: t.name,
      description: t.description ?? "",
      category: (() => {
        try {
          return JSON.parse(t.strideCategories as string)[0] ?? "TAMPERING";
        } catch {
          return "TAMPERING";
        }
      })(),
      severity: t.severity as MicroThreat["severity"],
      componentId,
      componentName: "",
      cweIds: (() => {
        try {
          return JSON.parse(t.cweIds as string);
        } catch {
          return [];
        }
      })(),
      owaspIds: (() => {
        try {
          return JSON.parse(t.owaspIds as string);
        } catch {
          return [];
        }
      })(),
      evidence: (() => {
        try {
          return t.evidence ? JSON.parse(t.evidence as string) : {};
        } catch {
          return {};
        }
      })(),
      mitigations: [],
      mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
      confidence: (t.aiConfidence as number | null) ?? 0.7,
      sourceMethodology: (t.aiMethodology as string | null) ?? "stride",
    });
  }
  return seeded;
}
