/**
 * AI Response Parsers
 *
 * Robust parsing for LLM responses. Handles common quirks:
 * - Markdown code fences (```json ... ```)
 * - Thinking preambles (<think>...</think>)
 * - Extra text before/after JSON
 * - Trailing commas in JSON
 */
import type {
  AISuggestedThreat,
  AISuggestedMitigation,
  ComponentContext,
} from "../../types/ai.js";
import logger from "../../utils/logger.js";
import type { ParseFailure } from "./micro-analysis/types.js";

/** Strip thinking preambles and markdown fences from LLM output */
function cleanLLMOutput(content: string): string {
  let cleaned = content;

  // Remove <think>...</think> blocks (qwen, deepseek)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Remove markdown code fences
  cleaned = cleaned.replace(/```(?:json)?\s*\n?/g, "");

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/** Try multiple strategies to extract a JSON array from LLM output */
function extractJsonArray(content: string): unknown[] | null {
  const cleaned = cleanLLMOutput(content);

  // Strategy 1: Direct parse (output is already a valid JSON array)
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // parse fallback — intentionally silent
  }

  // Strategy 2: Find [...] in the content
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // parse fallback — intentionally silent
      const fixed = arrayMatch[0].replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(fixed);
      } catch {
        // parse fallback — intentionally silent
      }
    }
  }

  // Strategy 3: Find individual {...} objects and collect them
  const objects: unknown[] = [];
  const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match;
  while ((match = objectRegex.exec(cleaned)) !== null) {
    try {
      objects.push(JSON.parse(match[0]));
    } catch {
      // parse fallback — intentionally silent
    }
  }
  if (objects.length > 0) return objects;

  return null;
}

/** Try multiple strategies to extract a JSON object from LLM output */
function extractJsonObject(content: string): Record<string, unknown> | null {
  const cleaned = cleanLLMOutput(content);

  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // parse fallback — intentionally silent
  }

  // Strategy 2: Find {...} in content
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // parse fallback — intentionally silent
      const fixed = objectMatch[0].replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(fixed);
      } catch {
        // parse fallback — intentionally silent
      }
    }
  }

  return null;
}

/**
 * Record + warn when items were dropped from an otherwise non-empty array.
 * `failures` is optional so existing callers keep their signature.
 */
function recordDrops(
  stage: "threat-generation" | "mitigation-generation",
  dropped: Array<{ index: number; error: string }>,
  total: number,
  failures: ParseFailure[] | undefined,
): void {
  if (dropped.length === 0) return;
  logger.warn(
    { stage, dropped: dropped.length, total },
    "Malformed items dropped from AI response",
  );
  if (failures) {
    for (const d of dropped) failures.push({ stage, ...d });
  }
}

/** Parse threats from AI response content. */
export function parseThreatsFromResponse(
  content: string,
  failures?: ParseFailure[],
): AISuggestedThreat[] {
  try {
    const arr = extractJsonArray(content);
    if (!arr || arr.length === 0) {
      logger.warn(
        { contentLength: content.length, preview: content.slice(0, 200) },
        "No threats parsed from AI response",
      );
      return [];
    }
    const results: AISuggestedThreat[] = [];
    const dropped: Array<{ index: number; error: string }> = [];
    arr.forEach((item, index) => {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).name === "string"
      ) {
        results.push(item as AISuggestedThreat);
      } else {
        dropped.push({ index, error: "threat item missing string `name`" });
      }
    });
    recordDrops("threat-generation", dropped, arr.length, failures);
    return results;
  } catch {
    logger.error("Failed to parse threats from AI response");
    return [];
  }
}

/**
 * The legacy prompt shows component NAMES (no raw ids), so the model
 * answers `targetComponent: "<name>"`. Resolve that back to a component id
 * (case-insensitive, trimmed) so `targetComponentId` and the
 * `[component:ID]` citation tags still work downstream.
 *   - unknown name   -> no target
 *   - ambiguous name -> first match + warning
 * A model-supplied `targetComponentId` is kept only when no name was given.
 * `[component:<name>]` tags in the description are rewritten to the id.
 */
export function resolveComponentNames<
  T extends {
    description?: string;
    targetComponentId?: string | null;
    targetComponent?: string;
  },
>(
  threats: T[],
  components: Pick<ComponentContext, "id" | "name">[],
): Array<T & { targetComponentId?: string | null; description?: string }> {
  const byName = new Map<string, string[]>();
  for (const c of components) {
    const key = (c.name ?? "").trim().toLowerCase();
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), c.id]);
  }
  const knownIds = new Set(components.map((c) => c.id));
  const lookup = (raw: string): string | undefined => {
    const ids = byName.get(raw.trim().toLowerCase());
    if (!ids) return undefined;
    if (ids.length > 1) {
      logger.warn(
        { name: raw, matches: ids.length },
        "Ambiguous component name in AI response; using first match",
      );
    }
    return ids[0];
  };

  return threats.map((t) => {
    const out = { ...t };
    if (typeof t.targetComponent === "string" && t.targetComponent.trim()) {
      out.targetComponentId = lookup(t.targetComponent) ?? undefined;
    }
    if (typeof t.description === "string") {
      out.description = t.description.replace(
        /\[component:([^\]]+)\]/gi,
        (m, ref: string) => {
          const r = ref.trim();
          if (knownIds.has(r)) return m;
          const id = lookup(r);
          return id ? `[component:${id}]` : m;
        },
      );
    }
    return out;
  });
}

/** Parse mitigations from AI response content. */
export function parseMitigationsFromResponse(
  content: string,
  failures?: ParseFailure[],
): AISuggestedMitigation[] {
  try {
    const arr = extractJsonArray(content);
    if (!arr || arr.length === 0) {
      logger.warn("No mitigations parsed from AI response");
      return [];
    }
    // Strip entries that lack a real description — qwen sometimes emits an
    // orphan `{text, category}` block (misplacing the suggestedRequirement
    // shape at the top level) which would otherwise pollute the UI list.
    const kept: AISuggestedMitigation[] = [];
    const dropped: Array<{ index: number; error: string }> = [];
    (arr as Array<Record<string, unknown> | null>).forEach((m, index) => {
      if (
        m &&
        typeof m.description === "string" &&
        m.description.trim().length > 0
      ) {
        kept.push(m as unknown as AISuggestedMitigation);
      } else {
        dropped.push({
          index,
          error: "mitigation item missing non-empty `description`",
        });
      }
    });
    recordDrops("mitigation-generation", dropped, arr.length, failures);
    return kept;
  } catch {
    logger.error("Failed to parse mitigations from AI response");
    return [];
  }
}

/** Parse severity calculation from AI response. */
export function parseSeverityFromResponse(content: string): {
  severity: string;
  reasoning: string;
  scores: { likelihood: number; impact: number; exploitability: number };
} {
  try {
    const obj = extractJsonObject(content);
    if (obj) return obj as ReturnType<typeof parseSeverityFromResponse>;
    return {
      severity: "MEDIUM",
      reasoning: "Unable to calculate - defaulting to MEDIUM",
      scores: { likelihood: 0.5, impact: 0.5, exploitability: 0.5 },
    };
  } catch {
    return {
      severity: "MEDIUM",
      reasoning: "Calculation failed - defaulting to MEDIUM",
      scores: { likelihood: 0.5, impact: 0.5, exploitability: 0.5 },
    };
  }
}

// Re-export for use by expert-analysis.ts
export { extractJsonArray, extractJsonObject };
