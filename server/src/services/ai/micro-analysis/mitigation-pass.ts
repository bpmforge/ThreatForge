/**
 * Mitigation pass, shared by the legacy pipeline and the v2 finalize step.
 *
 * Runs after dedup and the confidence floor, on the identification threats
 * that survive them, batched per component (MITIGATION_BATCH_SIZE threats per
 * call). Both paths must call this one function: a batch's prompt depends on
 * which threats share it, so the replay journal recorded on the legacy path
 * only matches v2 if v2 sends byte-identical batches — same threats, same
 * order, same component grouping.
 */
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import {
  generateMitigationsForComponent,
  MITIGATION_BATCH_SIZE,
} from "./mitigation-analyzer.js";
import type { AICallFn, MicroThreat, ParseFailure } from "./types.js";

type Requirement = { reqId: string; text: string; category?: string | null };

/** Identifies an identification-pass threat across dedup and the floor. */
export function mitigationKey(t: MicroThreat): string {
  return `${t.componentId}::${t.name}`;
}

export interface MitigationPassArgs {
  aiCall: AICallFn;
  /** Post-dedup, post-floor set. Mitigated entries are replaced in place. */
  threats: MicroThreat[];
  /** Which threats get LLM mitigations (supplemental/compound never do). */
  isIdentification: (t: MicroThreat) => boolean;
  componentContexts: ComponentContext[];
  requirements?: Requirement[];
  parseFailures: ParseFailure[];
  report: (phase: string, detail: string) => void;
}

export interface MitigationPassResult {
  mitigatedCount: number;
  llmCalls: number;
}

export async function runMitigationPass(
  args: MitigationPassArgs,
): Promise<MitigationPassResult> {
  const { threats, report } = args;
  report("mitigations", "Generating mitigations per threat...");

  // Positions in `threats` of the identification threats, by component
  const positionsByComponent = new Map<string, number[]>();
  threats.forEach((t, i) => {
    if (!args.isIdentification(t)) return;
    const positions = positionsByComponent.get(t.componentId) || [];
    positions.push(i);
    positionsByComponent.set(t.componentId, positions);
  });

  let mitigatedCount = 0;
  let llmCalls = 0;
  for (const [compId, positions] of positionsByComponent) {
    const compCtx = args.componentContexts.find((c) => c.id === compId);
    if (!compCtx) continue;

    const withMitigations = await generateMitigationsForComponent(
      args.aiCall,
      compCtx,
      positions.map((i) => threats[i]),
      (detail) => report("mitigations", detail),
      args.requirements,
      args.parseFailures,
    );
    positions.forEach((i, k) => {
      threats[i] = withMitigations[k];
    });
    mitigatedCount += positions.length;
    llmCalls += Math.ceil(positions.length / MITIGATION_BATCH_SIZE);
  }

  report(
    "mitigations_done",
    `Mitigations generated for ${mitigatedCount} threats`,
  );
  return { mitigatedCount, llmCalls };
}
