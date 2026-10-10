/**
 * Cross-check prompt — sent to the org's configured LLM provider to verify
 * whether a cited source supports a claim.
 *
 * Output contract: strict JSON with a verbatim quote from the source. Callers
 * pass the source text to the parser so a fabricated "quote" (one that doesn't
 * actually appear in the source) downgrades `supports` to false. Keeps the
 * prompt small to minimize cost and latency.
 */

import { normalizeForQuoteCheck } from "../../../utils/text-normalize.js";

export interface CrossCheckInput {
  sourceLabel: string; // e.g. "srs.pdf §3.2"
  sourceText: string; // verbatim section text
  claim: string;
}

export interface CrossCheckResult {
  supports: boolean;
  confidence: number; // 0.0 - 1.0
  rationale: string;
  /** Verbatim sentence from the source that supports the claim, or "" if none. */
  quote: string;
}

const MAX_SOURCE_CHARS = 8_000;

export function buildCrossCheckPrompt(input: CrossCheckInput): string {
  const truncated =
    input.sourceText.length > MAX_SOURCE_CHARS
      ? `${input.sourceText.slice(0, MAX_SOURCE_CHARS)}\n\n[... truncated ...]`
      : input.sourceText;

  return `You are verifying whether a source passage supports a claim. Be strict:
- Only answer "supports": true if the passage contains a sentence that directly evidences the claim.
- Inference, paraphrase, or "related context" counts as NOT supported.
- "quote" MUST be a verbatim sentence from the source — copy it character-for-character. If nothing in the source supports the claim, leave "quote" as an empty string and set supports=false.
- Do not invent or rephrase. The quote is validated against the source text; a fabricated quote will downgrade the result to not-supported automatically.

Source (${input.sourceLabel}):
"""
${truncated}
"""

Claim:
"""
${input.claim}
"""

Reply with JSON only, no prose:
{"supports": <bool>, "confidence": <0.0-1.0>, "quote": "<verbatim sentence from source or empty>", "rationale": "<one sentence>"}`;
}

/**
 * Parse the cross-check response. Defensive — falls back to UNVERIFIED on
 * bad output. When `sourceText` is supplied, the `quote` field is validated:
 * if supports=true but the quote isn't a whitespace-tolerant substring of
 * the source, the result is downgraded to supports=false.
 */
export function parseCrossCheckResult(
  content: string,
  sourceText?: string,
): CrossCheckResult {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      supports: false,
      confidence: 0,
      rationale: "verifier returned no parseable JSON",
      quote: "",
    };
  }

  let parsed: Partial<CrossCheckResult>;
  try {
    parsed = JSON.parse(match[0]) as Partial<CrossCheckResult>;
  } catch {
    return {
      supports: false,
      confidence: 0,
      rationale: "verifier returned malformed JSON",
      quote: "",
    };
  }

  const result: CrossCheckResult = {
    supports: Boolean(parsed.supports),
    confidence: clamp01(
      typeof parsed.confidence === "number" ? parsed.confidence : 0,
    ),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    quote: typeof parsed.quote === "string" ? parsed.quote : "",
  };

  if (sourceText !== undefined) {
    return validateQuote(result, sourceText);
  }
  return result;
}

/**
 * Downgrade supports=true → false when the claimed quote does not appear
 * in the source text (whitespace-tolerant, case-insensitive). This catches
 * the "model paraphrases then labels it a direct quote" failure mode — the
 * Manifest Honesty Check applied to citation verification.
 *
 * Exported so callers that parsed without a source text (tests, debug paths)
 * can validate later.
 */
export function validateQuote(
  result: CrossCheckResult,
  sourceText: string,
): CrossCheckResult {
  if (!result.supports) return result;

  const normalizedQuote = normalize(result.quote);
  if (normalizedQuote.length < 8) {
    return {
      ...result,
      supports: false,
      confidence: 0,
      rationale: result.rationale
        ? `${result.rationale} (quote too short to validate)`
        : "quote too short to validate",
    };
  }

  const normalizedSource = normalize(sourceText);
  if (normalizedSource.includes(normalizedQuote)) return result;

  return {
    ...result,
    supports: false,
    confidence: 0,
    rationale: result.rationale
      ? `${result.rationale} (quote not found in source — fabricated or paraphrased)`
      : "quote not found in source — fabricated or paraphrased",
  };
}

function normalize(s: string): string {
  // Shared markdown/smart-quote/PDF-aware normalizer.
  return normalizeForQuoteCheck(s);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
