/**
 * ThreatIdentifier stage — context helpers.
 *
 * Byte-equivalent ports of the private setup blocks inside
 * micro-analysis/pipeline.ts `runMicroAnalysis` (sequence-flow extraction,
 * nodeId maps, anomaly cap, writing-style wrap). Logic is copied, not
 * reinterpreted — if pipeline.ts changes, change this the same way.
 */
import type { GenerationStage } from "../generation-settings.js";
import type { ThreatModelContext } from "../../../types/ai.js";
import { getPrisma } from "../../../db.js";
import {
  buildStyleSuffix,
  PIPELINE_COMPONENT_CAP,
} from "../micro-analysis/pipeline.js";
import type { AICallFn, MicroThreat } from "../micro-analysis/types.js";
import { persistAIThreats } from "../../threat-review/review-service.js";
import { getUserWritingStyle } from "../universal-system-prompt.js";

export interface SequenceFlowMessage {
  from: string;
  to: string;
  label: string;
  protocol?: string;
  authentication?: string;
}

/** Port of pipeline.ts "Extract sequence flows per component (no LLM)". */
export function buildComponentSequenceFlows(
  context: ThreatModelContext,
): Map<string, SequenceFlowMessage[]> {
  const componentSequenceFlows = new Map<string, SequenceFlowMessage[]>();
  if (context.sequenceFlows) {
    for (const flow of context.sequenceFlows) {
      for (const msg of flow.messages) {
        // Map messages to components by name match
        for (const comp of context.components) {
          if (msg.from === comp.name || msg.to === comp.name) {
            const existing = componentSequenceFlows.get(comp.id) || [];
            existing.push(msg);
            componentSequenceFlows.set(comp.id, existing);
          }
        }
      }
    }
  }
  return componentSequenceFlows;
}

/** Port of pipeline.ts "Map: DB componentId → nodeId" block (persist only). */
export async function buildNodeIdMaps(threatModelId: string): Promise<{
  dbIdToNodeId: Map<string, string>;
  nodeIdToDbId: Map<string, string>;
}> {
  const prisma = await getPrisma();
  const comps = await prisma.component.findMany({
    where: { threatModelId },
    select: { id: true, nodeId: true },
  });
  const dbIdToNodeId = new Map<string, string>();
  const nodeIdToDbId = new Map<string, string>();
  for (const c of comps) {
    dbIdToNodeId.set(c.id, c.nodeId);
    nodeIdToDbId.set(c.nodeId, c.id);
  }
  return { dbIdToNodeId, nodeIdToDbId };
}

/**
 * Port of the pipeline-level anomaly cap tracker. Returns a function
 * that records `emitted` threats for a component and throws once the running
 * total crosses PIPELINE_COMPONENT_CAP (same message as the legacy loop —
 * the fail handler's session cleanup contract depends on the throw).
 */
export function createEmissionCapTracker(): (
  compKey: string,
  compName: string,
  emitted: number,
) => void {
  const emissionsByComponent = new Map<string, number>();
  return (compKey: string, compName: string, emitted: number) => {
    emissionsByComponent.set(
      compKey,
      (emissionsByComponent.get(compKey) ?? 0) + emitted,
    );
    const total = emissionsByComponent.get(compKey) ?? 0;
    if (total > PIPELINE_COMPONENT_CAP) {
      throw new Error(
        `Anomaly cap exceeded: component "${compName}" emitted ${total} ` +
          `threats in this run (cap: ${PIPELINE_COMPONENT_CAP}). Aborting ` +
          `to prevent runaway accumulation — check micro-analysis loop settings.`,
      );
    }
  };
}

/**
 * Port of the legacy loop's STREAMING PERSIST block — write threats
 * immediately so the UI shows results as each component completes
 * (mitigations + calibration UPDATE these rows later, unchanged legacy path).
 */
export async function streamPersistThreats(
  persist: { threatModelId: string; userId: string; sessionId?: string },
  threats: MicroThreat[],
  nodeId: string | undefined,
  methodology: string,
  componentName: string,
  report: (phase: string, detail: string) => void,
  onComponentPersisted?: (
    componentNodeId: string,
    persistResult: { created: number; updated: number; skipped: number },
  ) => void,
): Promise<void> {
  const streamResult = await persistAIThreats(
    persist.threatModelId,
    persist.userId,
    threats,
    undefined, // skip citation verification on streaming write
    { componentNodeId: nodeId, methodology },
    persist.sessionId,
  );
  report(
    "component",
    `Persisted ${threats.length} threats for ${componentName} (${methodology})`,
  );
  if (nodeId) onComponentPersisted?.(nodeId, streamResult);
}

/**
 * Port of the legacy loop's analyzedAt mark — updateMany silently skips
 * components deleted between queue-time and analysis-completion (update()
 * would throw a noisy, non-actionable P2025).
 */
export async function markComponentAnalyzed(
  threatModelId: string,
  nodeId: string,
): Promise<void> {
  const prisma = await getPrisma();
  await prisma.component.updateMany({
    where: { threatModelId, nodeId },
    data: { analyzedAt: new Date() },
  });
}

/**
 * Port of the pipeline.ts writing-style wraps: when the user enabled a
 * writing style of the given kind ("threats" for identification/calibration,
 * "mitigations" for the mitigation pass — pipeline.ts keeps them separate),
 * append its suffix to every system prompt. Without a userId (or with the
 * style disabled) the caller is returned unchanged — exactly the legacy
 * behavior when `persist` is absent.
 */
export async function wrapWithThreatStyle(
  aiCall: AICallFn,
  userId?: string,
  kind: "threats" | "mitigations" = "threats",
): Promise<AICallFn> {
  if (!userId) return aiCall;
  const style = await getUserWritingStyle(userId, kind);
  if (!style?.enabled) return aiCall;
  return async (system: string, user: string, stage?: GenerationStage) => {
    const styleSuffix = buildStyleSuffix(style);
    return aiCall(system + styleSuffix, user, stage);
  };
}
