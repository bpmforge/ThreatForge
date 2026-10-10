/**
 * Mitigation Analyzer
 *
 * Runs AFTER threat identification, dedup and the confidence floor as a
 * separate focused pass. For each threat, generates a variable number of
 * mitigations from different control categories (count follows
 * defense-in-depth logic, not a fixed range) with testable criteria.
 *
 * threats are sent in batches of MITIGATION_BATCH_SIZE per component
 * instead of one call per threat. The batch is capped because MTPLX's
 * non-streaming completions must finish inside undici's 300s headers timeout
 * (~3,000 completion tokens at ~13 tok/s).
 */
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import { extractJsonArray } from "../response-parsers.js";
import { buildMitigationBatchPrompt } from "./micro-prompt-builder.js";
import type { AICallFn, MicroThreat, ParseFailure } from "./types.js";
import {
  safeParseArray,
  MitigationArrayZ,
} from "../schemas/llm-response-schemas.js";
import { stripCitationTags } from "../../citation/citation-grammar.js";
import logger from "../../../utils/logger.js";

// Seed 12 mitigation replies: p50 ~2,800 / p95 ~4,000 chars (~800-1,150
// tokens) per threat. Three per call keeps nearly every reply under the
// recorder's 3,000-token cap; five would overflow on most calls.
export const MITIGATION_BATCH_SIZE = 3;

type Requirement = { reqId: string; text: string; category?: string | null };

/**
 * Generate mitigations for all threats on a component, MITIGATION_BATCH_SIZE
 * threats per LLM call. Threats the reply leaves out are retried once, one
 * call each (a reply cut off at max_tokens loses the whole batch, and the
 * same batch would be cut off again); a threat that still gets nothing keeps
 * its existing mitigations.
 */
export async function generateMitigationsForComponent(
  aiCall: AICallFn,
  component: ComponentContext,
  threats: MicroThreat[],
  onProgress?: (detail: string) => void,
  requirements?: Requirement[],
  parseFailures?: ParseFailure[],
): Promise<MicroThreat[]> {
  const generated = new Map<number, MicroThreat["mitigations"]>();

  for (let start = 0; start < threats.length; start += MITIGATION_BATCH_SIZE) {
    const indexes = threats
      .slice(start, start + MITIGATION_BATCH_SIZE)
      .map((_, i) => start + i);
    onProgress?.(
      `${component.name} → mitigations for threats ${start + 1}-${start + indexes.length} of ${threats.length}`,
    );

    const first = await mitigateBatch(
      aiCall,
      component,
      indexes.map((i) => threats[i]),
      requirements,
      parseFailures,
    );
    indexes.forEach((ti, bi) => {
      const m = first.get(bi);
      if (m) generated.set(ti, m);
    });

    for (const i of indexes.filter((ti) => !generated.has(ti))) {
      const retry = await mitigateBatch(
        aiCall,
        component,
        [threats[i]],
        requirements,
        parseFailures,
      );
      const m = retry.get(0);
      if (m) generated.set(i, m);
    }
  }

  return threats.map((threat, i) => {
    const mitigations = generated.get(i);
    // If the LLM failed or returned nothing, keep any existing mitigations
    if (!mitigations) return threat;
    return {
      ...threat,
      mitigations,
      // Keep legacy mitigation field from the first result
      mitigation: {
        description: mitigations[0].description,
        effort: mitigations[0].effort || "MEDIUM",
        effectiveness: mitigations[0].effectiveness,
      },
    };
  });
}

/**
 * One LLM call for a batch. Returns the non-empty mitigation lists keyed by
 * the threat's 0-based position in `batch`.
 */
async function mitigateBatch(
  aiCall: AICallFn,
  component: ComponentContext,
  batch: MicroThreat[],
  requirements: Requirement[] | undefined,
  parseFailures: ParseFailure[] | undefined,
): Promise<Map<number, MicroThreat["mitigations"]>> {
  const out = new Map<number, MicroThreat["mitigations"]>();
  const { system, user } = buildMitigationBatchPrompt(
    component,
    batch.map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      cweIds: t.cweIds,
    })),
    requirements,
  );

  let raw: string;
  try {
    raw = await aiCall(system, user, "mitigation");
  } catch (err) {
    logger.warn(
      { err, component: component.name, threats: batch.length },
      "Mitigation generation failed for batch",
    );
    return out;
  }

  const entries = parseBatchReply(raw);
  for (const entry of entries) {
    const n =
      entry && typeof entry === "object"
        ? Number((entry as Record<string, unknown>).threat)
        : NaN;
    const threat = Number.isInteger(n) ? batch[n - 1] : undefined;
    if (!threat) continue;
    const mitigations = parseMitigations(
      (entry as Record<string, unknown>).mitigations,
      threat.name,
      parseFailures,
    );
    if (mitigations.length > 0) out.set(n - 1, mitigations);
  }

  // A one-threat call may be answered with the bare mitigation array.
  if (
    batch.length === 1 &&
    out.size === 0 &&
    !entries.some((e) => e && typeof e === "object" && "threat" in e)
  ) {
    const flat = parseMitigations(entries, batch[0].name, parseFailures);
    if (flat.length > 0) out.set(0, flat);
  }

  if (out.size < batch.length) {
    logger.warn(
      {
        component: component.name,
        threats: batch.length,
        mitigated: out.size,
        rawLen: raw.length,
        rawSnippet: raw.slice(0, 200),
      },
      "Mitigation reply covered only part of the batch",
    );
  }
  return out;
}

const isBatchEntry = (e: unknown) =>
  !!e && typeof e === "object" && "threat" in e;

/**
 * Parse a batch reply. 16 of 57 batch replies in a recorded run were
 * complete JSON missing only the outer `]`; the generic extractor then
 * recovers just the inner mitigation objects, which carry no threat number.
 * Closing the brackets the model left open recovers the whole batch.
 */
function parseBatchReply(raw: string): unknown[] {
  const extracted = extractJsonArray(raw);
  if (extracted?.some(isBatchEntry)) return extracted;
  const closed = closeOpenBrackets(raw);
  if (closed) {
    try {
      const parsed: unknown = JSON.parse(closed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // parse fallback — intentionally silent
    }
  }
  return extracted ?? [];
}

/** From the first `[`, append the closers for any brackets left open. */
function closeOpenBrackets(raw: string): string | null {
  const start = raw.indexOf("[");
  if (start < 0) return null;
  const body = raw.slice(start).trimEnd();
  const closers: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of body) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "[") closers.push("]");
    else if (ch === "{") closers.push("}");
    else if (ch === "]" || ch === "}") {
      if (closers.pop() !== ch) return null;
    }
  }
  if (inString || closers.length === 0) return null;
  return body + closers.reverse().join("");
}

function parseMitigations(
  arr: unknown,
  threatName?: string,
  failures?: ParseFailure[],
): MicroThreat["mitigations"] {
  if (!Array.isArray(arr) || arr.length === 0) return [];

  const outcome = safeParseArray(MitigationArrayZ, arr);
  if (outcome.failed.length > 0) {
    logger.warn(
      { threat: threatName, failed: outcome.failed.length },
      "Discarded malformed mitigations from LLM output",
    );
    if (failures) {
      for (const f of outcome.failed) {
        failures.push({
          stage: "mitigation-generation",
          component: threatName,
          index: f.index,
          error: f.error,
        });
      }
    }
  }

  return outcome.valid.map((m) => ({
    description: stripCitationTags(
      (m.description as string) || "Review and address",
    ),
    controlCategory: (m.controlCategory as string) || "ACCESS_CONTROL",
    testCriteria:
      (m.testCriteria as string) || "Verify this control is in place",
    effort: (m.effort as string) || "MEDIUM",
    effectiveness: String(
      Math.min(parseFloat(String(m.effectiveness ?? "0.5")), 0.85),
    ),
    suggestedRequirement: parseSuggestedRequirement(m.suggestedRequirement),
  }));
}

function parseSuggestedRequirement(
  raw: unknown,
): { text: string; category?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  if (!text) return null;
  const category =
    typeof obj.category === "string" ? obj.category.trim() : undefined;
  return { text, category };
}
