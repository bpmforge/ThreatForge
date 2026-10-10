/**
 * Multi-Step Architecture Extractor
 *
 * Runs 4 sequential focused LLM calls where each step's output feeds the next.
 * Each step has a confidence + challenge-defend loop: if confidence is below
 * threshold the LLM is challenged ("what did you miss?") and new items are
 * merged in — the same pattern used in the micro-analysis pipeline.
 */

import logger from "../../../utils/logger.js";
import { coerceComponentTypeOrCustom } from "../component-types.js";
import {
  buildStep1Prompt,
  buildStep1ChallengePrompt,
  buildStep2Prompt,
  buildStep2ChallengePrompt,
  buildStep3Prompt,
  buildStep3ChallengePrompt,
  buildStep4Prompt,
} from "./step-prompts.js";
import type {
  AiCallFn,
  ExtractedComponent,
  ExtractedBoundary,
  ExtractedDataFlow,
  ExtractedSequence,
  ExtractionResult,
  MultiStepOptions,
} from "./types.js";

const DEFAULT_MIN_CONFIDENCE = 0.72;
const DEFAULT_MAX_LOOPS = 2;

// ---------------------------------------------------------------------------
// Gap extraction — mirrors micro-analysis extractGaps()
// ---------------------------------------------------------------------------

function extractGaps(raw: string): string[] {
  const match = raw.match(/GAPS\s*:\s*(\[[\s\S]*?\])/i);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return parsed
      .filter((g: unknown): g is string => typeof g === "string")
      .map((g: string) => g.trim())
      .filter((g: string) => g.length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

function parseField<T>(raw: string, field: string): T[] {
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const jsonMatch =
    stripped.match(/```json\s*([\s\S]*?)\s*```/) ||
    stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  try {
    const src = jsonMatch[1] ?? jsonMatch[0];
    const obj = JSON.parse(src.replace(/,\s*([}\]])/g, "$1"));
    return Array.isArray(obj[field]) ? obj[field] : [];
  } catch {
    return [];
  }
}

function parseConfidence(raw: string): number {
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const jsonMatch =
    stripped.match(/```json\s*([\s\S]*?)\s*```/) ||
    stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return 1.0;
  try {
    const src = jsonMatch[1] ?? jsonMatch[0];
    const obj = JSON.parse(src.replace(/,\s*([}\]])/g, "$1"));
    return typeof obj.confidence === "number" ? obj.confidence : 1.0;
  } catch {
    return 1.0;
  }
}

function avgConfidence(items: Array<{ confidence: number }>): number {
  if (items.length === 0) return 1.0;
  return items.reduce((s, i) => s + (i.confidence ?? 0.8), 0) / items.length;
}

// ---------------------------------------------------------------------------
// Step 1 — Component Discovery with challenge-defend loop
// ---------------------------------------------------------------------------

async function discoverComponents(
  docText: string,
  aiCall: AiCallFn,
  minConf: number,
  maxLoops: number,
): Promise<{
  components: ExtractedComponent[];
  requirements: ExtractionResult["requirements"];
}> {
  const { system, user } = buildStep1Prompt(docText);
  let raw: string;
  try {
    raw = await aiCall(system, user);
  } catch (err) {
    logger.warn({ err }, "[extraction] step1 LLM call failed");
    return { components: [], requirements: [] };
  }

  let components = parseField<ExtractedComponent>(raw, "components");
  const requirements = parseField<ExtractionResult["requirements"][number]>(
    raw,
    "requirements",
  );
  const gaps = extractGaps(raw);
  const conf = avgConfidence(components);

  logger.debug(
    { count: components.length, conf, gaps: gaps.length },
    "[extraction] step1 initial",
  );

  // Challenge-defend loop
  if (conf < minConf && components.length > 0 && maxLoops > 1) {
    logger.debug("[extraction] step1 confidence low — running challenge");
    const challenge = buildStep1ChallengePrompt(docText, components, gaps);
    try {
      const challengeRaw = await aiCall(challenge.system, challenge.user);
      const additional = parseField<ExtractedComponent>(
        challengeRaw,
        "additionalComponents",
      );
      const existingIds = new Set(components.map((c) => c.id));
      for (const c of additional) {
        if (!existingIds.has(c.id)) {
          components.push(c);
          existingIds.add(c.id);
        }
      }
      logger.debug(
        { added: additional.length },
        "[extraction] step1 challenge added components",
      );
    } catch (err) {
      logger.warn(
        { err },
        "[extraction] step1 challenge failed — keeping initial",
      );
    }
  }

  // Coerce vendor/camelCase/unknown type strings to canonical ComponentType.
  // Keeps downstream code free of per-extractor normalization logic.
  components = components.map((c) => ({
    ...c,
    type: coerceComponentTypeOrCustom(c.type),
  }));

  return { components, requirements };
}

// ---------------------------------------------------------------------------
// Step 2 — Trust Zone Assignment with challenge-defend loop
// ---------------------------------------------------------------------------

async function assignBoundaries(
  docText: string,
  components: ExtractedComponent[],
  aiCall: AiCallFn,
  minConf: number,
  maxLoops: number,
): Promise<ExtractedBoundary[]> {
  const { system, user } = buildStep2Prompt(docText, components);
  let raw: string;
  try {
    raw = await aiCall(system, user);
  } catch (err) {
    logger.warn({ err }, "[extraction] step2 LLM call failed");
    return [];
  }

  let boundaries = parseField<ExtractedBoundary>(raw, "boundaries");
  const gaps = extractGaps(raw);
  const conf = parseConfidence(raw);

  logger.debug(
    { count: boundaries.length, conf, gaps: gaps.length },
    "[extraction] step2 initial",
  );

  // Challenge: fix unassigned components or bad trust levels
  const unassigned = components.filter(
    (c) => !boundaries.some((b) => b.componentIds?.includes(c.id)),
  );

  if ((conf < minConf || unassigned.length > 0) && maxLoops > 1) {
    logger.debug(
      { unassigned: unassigned.length },
      "[extraction] step2 running challenge",
    );
    const challenge = buildStep2ChallengePrompt(components, boundaries, gaps);
    try {
      const challengeRaw = await aiCall(challenge.system, challenge.user);
      const revised = parseField<ExtractedBoundary>(challengeRaw, "boundaries");
      if (revised.length > 0) boundaries = revised;
    } catch (err) {
      logger.warn({ err }, "[extraction] step2 challenge failed");
    }
  }

  // Fallback: assign any still-unassigned components to INTERNAL
  const assignedIds = new Set(boundaries.flatMap((b) => b.componentIds ?? []));
  const stillMissing = components.filter((c) => !assignedIds.has(c.id));
  if (stillMissing.length > 0) {
    let internal = boundaries.find((b) => b.trustLevel === "INTERNAL");
    if (!internal) {
      internal = {
        id: "boundary-internal",
        name: "Internal Services",
        type: "trust",
        trustLevel: "INTERNAL",
        componentIds: [],
        confidence: 0.5,
      };
      boundaries.push(internal);
    }
    internal.componentIds = [
      ...(internal.componentIds ?? []),
      ...stillMissing.map((c) => c.id),
    ];
  }

  return boundaries;
}

// ---------------------------------------------------------------------------
// Step 3 — Data Flow Mapping with gap-fill loop
// ---------------------------------------------------------------------------

async function mapDataFlows(
  docText: string,
  components: ExtractedComponent[],
  boundaries: ExtractedBoundary[],
  aiCall: AiCallFn,
  minConf: number,
  maxLoops: number,
): Promise<ExtractedDataFlow[]> {
  const { system, user } = buildStep3Prompt(docText, components, boundaries);
  let raw: string;
  try {
    raw = await aiCall(system, user);
  } catch (err) {
    logger.warn({ err }, "[extraction] step3 LLM call failed");
    return [];
  }

  const compIds = new Set(components.map((c) => c.id));
  const flows = parseField<ExtractedDataFlow>(raw, "dataFlows").filter(
    (f) => compIds.has(f.sourceId) && compIds.has(f.targetId),
  );
  const gaps = extractGaps(raw);
  const conf = parseConfidence(raw);

  logger.debug(
    { count: flows.length, conf, gaps: gaps.length },
    "[extraction] step3 initial",
  );

  // Gap-fill loop when confidence is low or LLM flagged missing flows
  if ((conf < minConf || gaps.length > 0) && maxLoops > 1) {
    logger.debug("[extraction] step3 running gap-fill challenge");
    const challenge = buildStep3ChallengePrompt(components, flows, gaps);
    try {
      const challengeRaw = await aiCall(challenge.system, challenge.user);
      const additional = parseField<ExtractedDataFlow>(
        challengeRaw,
        "additionalFlows",
      ).filter((f) => compIds.has(f.sourceId) && compIds.has(f.targetId));
      const existingPairs = new Set(
        flows.map((f) => `${f.sourceId}→${f.targetId}`),
      );
      for (const f of additional) {
        if (!existingPairs.has(`${f.sourceId}→${f.targetId}`)) {
          flows.push(f);
          existingPairs.add(`${f.sourceId}→${f.targetId}`);
        }
      }
      logger.debug(
        { added: additional.length },
        "[extraction] step3 challenge added flows",
      );
    } catch (err) {
      logger.warn({ err }, "[extraction] step3 gap-fill failed");
    }
  }

  return flows;
}

// ---------------------------------------------------------------------------
// Step 4 — Sequence Identification (single pass, no loop needed)
// ---------------------------------------------------------------------------

async function identifySequences(
  docText: string,
  components: ExtractedComponent[],
  flows: ExtractedDataFlow[],
  aiCall: AiCallFn,
): Promise<ExtractedSequence[]> {
  const { system, user } = buildStep4Prompt(docText, components, flows);
  let raw: string;
  try {
    raw = await aiCall(system, user);
  } catch (err) {
    logger.warn({ err }, "[extraction] step4 LLM call failed");
    return [];
  }

  const compIds = new Set(components.map((c) => c.id));
  const sequences = parseField<ExtractedSequence>(raw, "sequences").filter(
    (seq) =>
      Array.isArray(seq.steps) &&
      seq.steps.every((s) => compIds.has(s.from) && compIds.has(s.to)),
  );

  logger.debug({ count: sequences.length }, "[extraction] step4 sequences");
  return sequences;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runMultiStepExtraction(
  documentText: string,
  aiCall: AiCallFn,
  options?: MultiStepOptions,
): Promise<ExtractionResult> {
  const minConf = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const maxLoops = options?.maxLoops ?? DEFAULT_MAX_LOOPS;
  const progress = options?.onProgress ?? (() => {});

  progress(1, 4, "Discovering components");
  const { components, requirements } = await discoverComponents(
    documentText,
    aiCall,
    minConf,
    maxLoops,
  );

  progress(2, 4, "Assigning trust zones");
  const boundaries = await assignBoundaries(
    documentText,
    components,
    aiCall,
    minConf,
    maxLoops,
  );

  progress(3, 4, "Mapping data flows");
  const dataFlows = await mapDataFlows(
    documentText,
    components,
    boundaries,
    aiCall,
    minConf,
    maxLoops,
  );

  progress(4, 4, "Identifying sequences");
  const sequences = await identifySequences(
    documentText,
    components,
    dataFlows,
    aiCall,
  );

  // Derive technologies + dataTypes from components
  const technologies = [
    ...new Set(
      components.flatMap((c) => (c.technology ? [c.technology as string] : [])),
    ),
  ];
  const dataTypes = [
    ...new Set(
      components.flatMap((c) =>
        Array.isArray(c.dataHandled) ? (c.dataHandled as string[]) : [],
      ),
    ),
  ];

  const overallConf = components.length > 0 ? avgConfidence(components) : 0;

  logger.info(
    {
      components: components.length,
      boundaries: boundaries.length,
      dataFlows: dataFlows.length,
      sequences: sequences.length,
      confidence: overallConf,
    },
    "[extraction] multi-step complete",
  );

  return {
    components,
    dataFlows,
    boundaries,
    sequences,
    requirements,
    technologies,
    dataTypes,
    confidence: overallConf,
    warnings: [],
  };
}
