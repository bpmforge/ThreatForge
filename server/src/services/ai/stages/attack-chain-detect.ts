/**
 * Shared detection helper for the attack-chain Pass 1 / Pass 2 stages.
 *
 * Both passes have the same shape: one adversarial-free LLM call that returns a
 * JSON array of `{ componentId, justification, ... }`, parsed via safeParseArray,
 * then validated against the model's topology. Any returned componentId that is
 * not a real component in the model is a HALLUCINATION — it is dropped and
 * recorded as a parseFailure (stage "attack-chain"), never trusted downstream.
 *
 * Kept out of the stage handlers so the topology-drop logic is unit-testable in
 * isolation and both handlers stay well within the service line budget.
 */
import { z } from "zod";
import type { ThreatModelContext } from "../../../types/ai.js";
import type { ParseFailure } from "../micro-analysis/types.js";
import { safeParseArray } from "../schemas/llm-response-schemas.js";

/** The minimal shape both EntryPointZ and TargetAssetZ share. */
export interface DetectedComponentRef {
  componentId: string;
  justification: string;
}

export interface DetectResult<T extends DetectedComponentRef> {
  /** Items whose componentId exists in the model. componentName is attached. */
  items: Array<T & { componentName: string }>;
  parseFailures: ParseFailure[];
  /** Hallucinated component ids that were dropped (subset of parseFailures). */
  hallucinatedIds: string[];
}

/**
 * Parse a raw LLM response against `schema` (an array element schema), then
 * drop any item whose componentId is absent from the model. Schema-invalid
 * rows AND topology-invalid (hallucinated) rows both become parseFailures.
 */
export function detectComponents<T extends DetectedComponentRef>(
  raw: string,
  schema: z.ZodArray<z.ZodType<T>>,
  context: ThreatModelContext,
): DetectResult<T> {
  const componentNameById = new Map(
    context.components.map((c) => [c.id, c.name]),
  );

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    json = raw; // safeParseArray reports a structured "Not an array" failure
  }

  const { valid, failed } = safeParseArray(schema, json);
  const parseFailures: ParseFailure[] = failed.map((f) => ({
    stage: "attack-chain" as const,
    index: f.index,
    error: f.error,
  }));

  const items: Array<T & { componentName: string }> = [];
  const hallucinatedIds: string[] = [];
  for (let i = 0; i < valid.length; i++) {
    const item = valid[i];
    const componentName = componentNameById.get(item.componentId);
    if (componentName === undefined) {
      hallucinatedIds.push(item.componentId);
      parseFailures.push({
        stage: "attack-chain",
        index: i,
        error: `Hallucinated componentId "${item.componentId}" — not in model topology; dropped`,
      });
      continue;
    }
    items.push({ ...item, componentName });
  }

  return { items, parseFailures, hallucinatedIds };
}
