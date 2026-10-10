/**
 * Category Analyzer
 *
 * Runs a single STRIDE/PASTA/Kill Chain category analysis for one component.
 * Uses a confidence loop: if the LLM isn't confident, it loops with
 * "what did you miss?" + unused reference templates.
 */
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import { extractJsonArray, extractJsonObject } from "../response-parsers.js";
import {
  buildCategoryPrompt,
  buildConfidenceLoopPrompt,
  buildCitationLoopPrompt,
  buildMinimalPrompt,
  extractGaps,
} from "./micro-prompt-builder.js";
import type {
  AICallFn,
  CategoryReferenceData,
  MicroThreat,
  ParseFailure,
} from "./types.js";
import {
  safeParseArray,
  ThreatArrayZ,
} from "../schemas/llm-response-schemas.js";
import { parseClaim } from "../../citation/citation-parser.js";
import { stripCitationTags } from "../../citation/citation-grammar.js";
import { checkReference } from "../../citation/reference-resolver.js";
import { withRetry } from "./with-retry.js";
import {
  ProviderRetriesExhaustedError,
  isPromptTooLargeError,
} from "../provider-errors.js";
import logger from "../../../utils/logger.js";

/**
 * Analyze a single component for a single threat category.
 * Returns 0-3 threats per call, loops if confidence is low.
 */
export async function analyzeSingleCategory(
  aiCall: AICallFn,
  component: ComponentContext,
  category: string,
  methodology: string,
  refs: CategoryReferenceData,
  options: {
    minConfidence: number;
    maxLoops: number;
    /**
     * Minimum fraction of threats (0-1) that must carry a format-valid
     * citation tag. If the first-pass output falls below this, a
     * citation-focused follow-up prompt re-emits the same threats with
     * proper tags. Defaults to 0.5 (at least half the threats grounded).
     * Set to 0 to disable the citation loop.
     */
    minCitationCoverage?: number;
    /**
     * Injectable backoff sleep for the first-pass provider retry.
     * Tests pass a near-instant no-op; production leaves it unset so
     * with-retry.ts uses its real (linear, seconds-scale) backoff.
     */
    retrySleep?: (ms: number) => Promise<void>;
  },
  sequenceFlows?: Array<{
    from: string;
    to: string;
    label: string;
    protocol?: string;
    authentication?: string;
  }>,
  /** Threats the Verifier refuted on a prior pass for this pair. */
  refutedThreats?: Array<{ name: string; reason?: string }>,
): Promise<{ threats: MicroThreat[]; parseFailures: ParseFailure[] }> {
  const parseFailures: ParseFailure[] = [];

  // --- First pass ---
  const { system, user } = buildCategoryPrompt(
    component,
    category,
    refs,
    sequenceFlows,
    refutedThreats,
  );
  let rawResponse: string;
  try {
    // Bounded retry (3 attempts, linear backoff) on the first-pass
    // call so a transient provider failure (dead-and-reloading local model,
    // dropped connection) self-heals instead of silently returning zero
    // threats. A "400 — prompt too large" is not transient (it has its own
    // minimal-prompt recovery below), so it is excluded from the retry loop
    // and falls straight to that branch on the first failure.
    // A provider that already retried (ProviderRetriesExhaustedError) is not
    // retried again, and no 400 is transient; only a context-length 400 gets
    // the minimal-prompt fallback (a crashed model also arrives as 400).
    rawResponse = await withRetry(() => aiCall(system, user, "category"), {
      sleep: options.retrySleep,
      isRetryable: (err) =>
        !(err instanceof ProviderRetriesExhaustedError) &&
        !(err instanceof Error && /\b400\b/.test(err.message)),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (isPromptTooLargeError(err)) {
      logger.warn(
        { component: component.name, category },
        "Prompt too large, retrying with minimal prompt",
      );
      try {
        const minimal = buildMinimalPrompt(component, category);
        rawResponse = await aiCall(minimal.system, minimal.user, "category");
      } catch (retryErr) {
        const retryMsg =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        logger.warn(
          { retryErr, component: component.name, category },
          "Minimal prompt also failed",
        );
        // A unit whose provider call exhausts retries must record a
        // failure, not return [] silently, which would look
        // like "genuinely no threats" and hide lost recall.
        parseFailures.push({
          stage: "provider-failure",
          component: component.name,
          category,
          index: 0,
          error: `Provider call failed after retries: ${retryMsg}`,
        });
        return { threats: [], parseFailures };
      }
    } else {
      logger.warn(
        { err, component: component.name, category },
        "Category analysis LLM call failed after retries",
      );
      parseFailures.push({
        stage: "provider-failure",
        component: component.name,
        category,
        index: 0,
        error: `Provider call failed after retries: ${errMsg}`,
      });
      return { threats: [], parseFailures };
    }
  }

  // The first-pass reply is a {"threats":[...],"gaps":[...]} object.
  // readCategoryReply falls back to the legacy array + `GAPS:` line shape
  // (minimal-prompt retry, older recordings).
  const reply = readCategoryReply(rawResponse);
  let threats = parseAndNormalize(
    reply.threatsRaw,
    component.id,
    component.name,
    category,
    methodology,
    parseFailures,
  );

  // Pull the self-identified gaps out of the first-pass response so the
  // confidence loop can target them instead of re-scanning from scratch.
  const firstPassGaps = reply.gaps;

  threats = await refineCategoryThreats(
    aiCall,
    component,
    category,
    methodology,
    refs,
    options,
    threats,
    firstPassGaps,
    parseFailures,
  );

  return { threats, parseFailures };
}

/**
 * The per-category work after the first pass — citation re-emit,
 * confidence follow-up, tag stripping. Shared by the single-category path and
 * the chunked path (which runs it once per category of the chunk).
 */
export async function refineCategoryThreats(
  aiCall: AICallFn,
  component: ComponentContext,
  category: string,
  methodology: string,
  refs: CategoryReferenceData,
  options: {
    minConfidence: number;
    maxLoops: number;
    minCitationCoverage?: number;
  },
  firstPassThreats: MicroThreat[],
  firstPassGaps: string[],
  parseFailures: ParseFailure[],
): Promise<MicroThreat[]> {
  let threats = firstPassThreats;

  // --- Citation coverage loop (runs before confidence loop) ---
  const citationCoverage = computeCitationCoverage(threats, component.id);
  const minCitationCoverage = options.minCitationCoverage ?? 0.5;
  if (
    threats.length > 0 &&
    minCitationCoverage > 0 &&
    citationCoverage < minCitationCoverage &&
    options.maxLoops > 1
  ) {
    logger.debug(
      {
        component: component.name,
        category,
        citationCoverage,
      },
      "Citation coverage below threshold, re-emitting with tags",
    );

    const followUp = buildCitationLoopPrompt(
      component,
      category,
      threats,
      refs,
    );
    try {
      const followUpResponse = await aiCall(
        followUp.system,
        followUp.user,
        "category",
      );
      const recited = parseAndNormalize(
        followUpResponse,
        component.id,
        component.name,
        category,
        methodology,
        parseFailures,
      );
      // Merge by identity (name) instead of replacing the set. The
      // re-cite prompt asks the LLM to re-emit the same threats with tags,
      // but it often returns a partial subset — replacing `threats`
      // outright silently dropped whichever ones it left out, before the
      // streaming persist ever saw them. Recited threats (carrying the
      // tag) win for names they cover; every original whose name the
      // re-cite pass didn't return is kept as-is. The result can only grow
      // or hold steady relative to the input, never shrink.
      if (recited.length > 0) {
        threats = mergeRecitedThreats(threats, recited);
      }
    } catch (err) {
      logger.warn(
        { err, component: component.name, category },
        "Citation loop LLM call failed — keeping un-cited threats",
      );
    }
  }

  // --- Confidence loop ---
  const avgConfidence =
    threats.length > 0
      ? threats.reduce((sum, t) => sum + t.confidence, 0) / threats.length
      : 1.0; // Empty = nothing to find = confident

  if (
    avgConfidence < options.minConfidence &&
    threats.length > 0 &&
    options.maxLoops > 1
  ) {
    logger.debug(
      {
        component: component.name,
        category,
        confidence: avgConfidence,
      },
      "Confidence below threshold, running follow-up",
    );

    const followUp = buildConfidenceLoopPrompt(
      component,
      category,
      threats,
      refs,
      firstPassGaps,
    );
    try {
      const followUpResponse = await aiCall(
        followUp.system,
        followUp.user,
        "category",
      );
      const additional = parseAndNormalize(
        followUpResponse,
        component.id,
        component.name,
        category,
        methodology,
        parseFailures,
      );
      // Merge — deduplicate by name
      const existingNames = new Set(threats.map((t) => t.name.toLowerCase()));
      for (const t of additional) {
        if (!existingNames.has(t.name.toLowerCase())) {
          threats.push(t);
          existingNames.add(t.name.toLowerCase());
        }
      }
    } catch (err) {
      logger.warn(
        { err, component: component.name, category },
        "Confidence loop LLM call failed",
      );
    }
  }

  // Strip citation tags from stored descriptions — kept until here so
  // computeCitationCoverage could check them during the citation loop.
  threats = threats.map((t) => ({
    ...t,
    description: stripCitationTags(t.description),
  }));

  return threats;
}

// ---------------------------------------------------------------------------
// Merge re-cited threats back into the original set by identity,
// instead of replacing the set outright. Never shrinks the input.
// ---------------------------------------------------------------------------

/**
 * Merge a citation follow-up response back into the original threat list.
 * Recited threats (name-matched, case-insensitive) replace their original —
 * they carry the citation tag the loop was trying to add. Any original the
 * re-cite pass didn't return is kept unchanged. Any recited threat with a
 * name the first pass never produced is appended. The output length is
 * always >= `original.length`.
 */
function mergeRecitedThreats(
  original: MicroThreat[],
  recited: MicroThreat[],
): MicroThreat[] {
  const recitedByName = new Map(
    recited.map((t) => [t.name.toLowerCase(), t] as const),
  );
  const originalNames = new Set(original.map((t) => t.name.toLowerCase()));

  const merged = original.map(
    (t) => recitedByName.get(t.name.toLowerCase()) ?? t,
  );
  for (const t of recited) {
    if (!originalNames.has(t.name.toLowerCase())) {
      merged.push(t);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Citation coverage — cheap quality check used by the citation loop
// ---------------------------------------------------------------------------

/**
 * Fraction of threats (0-1) that carry at least one format-valid
 * citation. "Format-valid" means:
 *   - REFERENCE tag with a recognised id (CWE/OWASP/etc.), OR
 *   - COMPONENT tag with an id (existence check happens at persist time), OR
 *   - DOCUMENT tag (document lookup happens at persist time), OR
 *   - "Not found:" prefix (explicit absence, counted as grounded)
 *
 * Zero citations or only malformed REFERENCE ids → not counted.
 *
 * Pure synchronous check — no LLM, no DB. Safe to call per first-pass.
 */
export function computeCitationCoverage(
  threats: MicroThreat[],
  _componentId: string,
): number {
  if (threats.length === 0) return 1.0;
  let grounded = 0;
  for (const t of threats) {
    if (hasGroundedCitation(t.description)) grounded++;
  }
  return grounded / threats.length;
}

function hasGroundedCitation(description: string): boolean {
  const parsed = parseClaim(description);
  if (parsed.kind === "NOT_FOUND") return true;
  if (parsed.citations.length === 0) return false;
  for (const c of parsed.citations) {
    if (c.type === "DOCUMENT" || c.type === "COMPONENT") return true;
    if (c.type === "REFERENCE") {
      const check = checkReference(c.referenceKind, c.referenceId);
      if (check.resolved) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Parse + normalize LLM output into MicroThreat[]
// ---------------------------------------------------------------------------

/**
 * Split a first-pass category reply into the threats payload and the
 * self-identified gaps. Accepts the object shape the prompt asks for, and the
 * legacy bare array + trailing `GAPS: [...]` line.
 */
export function readCategoryReply(raw: string): {
  threatsRaw: string;
  gaps: string[];
} {
  const obj = extractJsonObject(raw);
  if (obj && Array.isArray(obj.threats)) {
    const gaps = Array.isArray(obj.gaps)
      ? obj.gaps
          .filter((g): g is string => typeof g === "string")
          .map((g) => g.trim())
          .filter((g) => g.length > 0)
      : [];
    return { threatsRaw: JSON.stringify(obj.threats), gaps };
  }
  return { threatsRaw: raw, gaps: extractGaps(raw) };
}

export function parseAndNormalize(
  raw: string,
  componentId: string,
  componentName: string,
  category: string,
  methodology: string,
  failures?: ParseFailure[],
): MicroThreat[] {
  const arr = extractJsonArray(raw);
  if (!arr || arr.length === 0) return [];

  const outcome = safeParseArray(ThreatArrayZ, arr);
  if (outcome.failed.length > 0) {
    logger.warn(
      {
        component: componentName,
        category,
        failed: outcome.failed.length,
        errors: outcome.failed.slice(0, 3).map((f) => f.error),
      },
      "Discarded malformed threats from LLM output",
    );
    if (failures) {
      for (const f of outcome.failed) {
        failures.push({
          stage: "threat-generation",
          component: componentName,
          category,
          index: f.index,
          error: f.error,
        });
      }
    }
  }

  return outcome.valid.map((t) => {
    const evidence = normalizeEvidence(t.evidence as Record<string, unknown>);
    return {
      name: ((t.name || t.title) as string) || "Untitled",
      description: (t.description as string) || "",
      category,
      severity: normalizeSeverity((t.severity as string) || "MEDIUM"),
      componentId,
      componentName,
      cweIds: normalizeCweIds(t.cweIds, evidence.cwe),
      owaspIds: normalizeOwaspIds(t.owaspIds, evidence.owasp),
      evidence,
      mitigations: normalizeMitigations(t.mitigations, t.mitigation),
      mitigation: normalizeMitigation(t.mitigation as Record<string, unknown>),
      confidence: typeof t.confidence === "number" ? t.confidence : 0.7,
      sourceMethodology: methodology,
    };
  });
}

function normalizeSeverity(s: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const upper = s.toUpperCase();
  if (upper === "CRITICAL") return "CRITICAL";
  if (upper === "HIGH") return "HIGH";
  if (upper === "LOW") return "LOW";
  return "MEDIUM";
}

function normalizeEvidence(
  e?: Record<string, unknown>,
): MicroThreat["evidence"] {
  if (!e) return {};
  return {
    owasp: (e.owasp as string) || undefined,
    cwe: (e.cwe as string) || undefined,
    compliance: (e.compliance as string) || undefined,
    attackPath: (e.attackPath as string) || undefined,
  };
}

function normalizeMitigation(
  m?: Record<string, unknown>,
): MicroThreat["mitigation"] {
  if (!m) {
    return {
      description: "Review and address this threat",
      effort: "MEDIUM",
      effectiveness: "0.5",
    };
  }
  return {
    description: stripCitationTags(
      (m.description as string) || "Review and address",
    ),
    effort: (m.effort as string) || "MEDIUM",
    effectiveness: String(m.effectiveness ?? "0.5"),
  };
}

function normalizeMitigations(
  rawArray: unknown,
  rawSingle: unknown,
): MicroThreat["mitigations"] {
  const result: MicroThreat["mitigations"] = [];

  // Try mitigations array first (new format)
  if (Array.isArray(rawArray)) {
    for (const m of rawArray as Record<string, unknown>[]) {
      result.push({
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
        suggestedRequirement: coerceSuggestedRequirement(
          m.suggestedRequirement,
        ),
      });
    }
  }

  // Fallback: convert single mitigation object to array
  if (result.length === 0 && rawSingle && typeof rawSingle === "object") {
    const m = rawSingle as Record<string, unknown>;
    result.push({
      description: stripCitationTags(
        (m.description as string) || "Review and address",
      ),
      controlCategory: (m.controlCategory as string) || "ACCESS_CONTROL",
      testCriteria:
        (m.testCriteria as string) || "Verify this control is in place",
      effort: (m.effort as string) || "MEDIUM",
      effectiveness: String(m.effectiveness ?? "0.5"),
      suggestedRequirement: coerceSuggestedRequirement(m.suggestedRequirement),
    });
  }

  return result;
}

function coerceSuggestedRequirement(
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

/**
 * Normalize CWE IDs from LLM response.
 * Handles: cweIds array, single evidence.cwe string, or extracts from description.
 */
function normalizeCweIds(raw: unknown, evidenceCwe?: string): string[] {
  const ids = new Set<string>();

  // From explicit cweIds array
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id = String(item).trim();
      if (id.match(/^CWE-\d+$/i)) ids.add(id.toUpperCase());
    }
  }

  // From legacy evidence.cwe single string (may contain multiple: "CWE-287, CWE-384")
  if (evidenceCwe) {
    const matches = evidenceCwe.match(/CWE-\d+/gi);
    if (matches) {
      for (const m of matches) ids.add(m.toUpperCase());
    }
  }

  return [...ids];
}

function normalizeOwaspIds(raw: unknown, evidenceOwasp?: string): string[] {
  const ids = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id = String(item).trim();
      if (id.match(/^A\d{2}:\d{4}$/i)) ids.add(id);
    }
  }
  if (evidenceOwasp) {
    const matches = evidenceOwasp.match(/A\d{2}:\d{4}/gi);
    if (matches) for (const m of matches) ids.add(m);
  }
  return [...ids];
}
