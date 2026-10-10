/**
 * ThreatIdentifier stage — input resolution.
 *
 * ThreatIdentifier supports two input shapes:
 * 1. ArchitectureReader-fed (the seeded pipeline path): componentContexts,
 *    skipSet, sequenceFlows, methodology arrive via inputMapping — assembly
 *    is owned by the ArchitectureReader stage.
 * 2. Raw-context (kept for the stage-equivalence harness and unit tests):
 *    only `context` is given and the handler computes everything itself,
 *    byte-equivalent to the legacy loop.
 * Either way the resolved setup is identical for identical contexts — the
 * replay journal (hash-matched prompts) enforces that.
 */
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import type { ThreatModelContext } from "../../../types/ai.js";
import {
  buildSkipSet,
  toComponentContext,
} from "../micro-analysis/pipeline.js";
import type { MicroAnalysisOptions } from "../micro-analysis/types.js";
import { DEFAULT_OPTIONS } from "../micro-analysis/types.js";
import {
  buildComponentSequenceFlows,
  buildNodeIdMaps,
  type SequenceFlowMessage,
} from "./identifier-context.js";

/** Inputs accepted by the ThreatIdentifier stage (see module doc). */
export interface ThreatIdentifierInputs {
  context: ThreatModelContext;
  options?: Partial<MicroAnalysisOptions>;
  /** Same shape as runMicroAnalysis's persist arg (minus verifyClient). */
  persist?: { threatModelId: string; userId: string; sessionId?: string };
  /** ArchitectureReader outputs (pipeline path) — optional in raw-context form. */
  componentContexts?: ComponentContext[];
  skipSet?: string[];
  sequenceFlows?: Record<string, SequenceFlowMessage[]>;
  methodology?: string;
}

/** Map an ArchitectureReader methodology label to the legacy options key. */
function toMethodologyKey(
  methodology: string,
): MicroAnalysisOptions["methodologies"][number] {
  const key = methodology
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  if (
    key === "stride" ||
    key === "pasta" ||
    key === "kill_chain" ||
    key === "mitre_attack"
  ) {
    return key;
  }
  return "stride"; // legacy DEFAULT_OPTIONS fallback
}

export interface IdentifierSetup {
  opts: MicroAnalysisOptions;
  componentContexts: ComponentContext[];
  componentSequenceFlows: Map<string, SequenceFlowMessage[]>;
  skipNodeIds: Set<string>;
  dbIdToNodeId: Map<string, string>;
}

/**
 * Resolve the run setup from either input shape. ArchitectureReader outputs
 * win when present; otherwise each piece is computed exactly as the legacy
 * loop does (toComponentContext / sequence-flow extraction / buildSkipSet).
 */
export async function resolveIdentifierSetup(
  inputs: ThreatIdentifierInputs,
): Promise<IdentifierSetup> {
  const { context, options, persist } = inputs;
  const opts: MicroAnalysisOptions = {
    ...DEFAULT_OPTIONS,
    ...(inputs.methodology && !options?.methodologies
      ? { methodologies: [toMethodologyKey(inputs.methodology)] }
      : {}),
    ...options,
  };

  const componentContexts =
    inputs.componentContexts ??
    context.components.map((comp) => toComponentContext(comp, context));

  const componentSequenceFlows = inputs.sequenceFlows
    ? new Map(Object.entries(inputs.sequenceFlows))
    : buildComponentSequenceFlows(context);

  const skipNodeIds = inputs.skipSet
    ? new Set(inputs.skipSet)
    : persist
      ? await buildSkipSet(persist.threatModelId, opts.force ?? false)
      : new Set<string>();

  const { dbIdToNodeId } = persist
    ? await buildNodeIdMaps(persist.threatModelId)
    : { dbIdToNodeId: new Map<string, string>() };

  return {
    opts,
    componentContexts,
    componentSequenceFlows,
    skipNodeIds,
    dbIdToNodeId,
  };
}
