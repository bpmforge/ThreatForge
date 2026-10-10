/**
 * Quote-comparison normalization.
 *
 * Used by every place that compares an LLM-emitted "quote" against the
 * source text it was supposedly drawn from (citation cross-check, extraction
 * source-quote validation, Pass-2 phantom-missing purge).
 *
 * Real-world source text is messy:
 *   - Markdown formatting around component names (`PostgreSQL`, **bold**)
 *   - Smart quotes / curly apostrophes inserted by editors and PDFs
 *   - Soft hyphens (U+00AD) and non-breaking spaces from word processors
 *   - Hyphenated line breaks ("encryp-\ntion") in PDF extraction
 *
 * Strict substring-match against raw text false-negatives on all of these.
 * Apply the same normalization to BOTH sides (the quote AND the source text)
 * before checking — keeps verbatim semantics while tolerating cosmetic noise.
 */

const SOFT_HYPHEN = "\u00ad";
const NBSP = "\u00a0";

/**
 * Smart-quote and apostrophe variants → straight ASCII equivalents.
 * Covers Microsoft Word, PDF extractors, and macOS smart-substitution output.
 */
const SMART_QUOTE_MAP: Record<string, string> = {
  "\u2018": "'", // left single
  "\u2019": "'", // right single / curly apostrophe
  "\u201A": "'", // single low-9
  "\u201B": "'", // single high-reversed-9
  "\u201C": '"', // left double
  "\u201D": '"', // right double
  "\u201E": '"', // double low-9
  "\u201F": '"', // double high-reversed-9
  "\u2032": "'", // prime
  "\u2033": '"', // double prime
};

/**
 * Markdown formatting tokens we strip before substring-matching. We do NOT
 * strip list markers (`-`, `*` at start of line — already collapsed to whitespace
 * by the formatting pass) or link syntax (rare in component-name quotes).
 */
const MARKDOWN_STRIP_RE = /[*_`]+|^#+\s*/gm;

/**
 * Reconstruct hyphenated line breaks: "encryp-\ntion" or "encryp- \ntion"
 * → "encryption". Common in PDF text extraction.
 */
function rejoinHyphenatedLineBreaks(s: string): string {
  return s.replace(/-\s*\n\s*/g, "");
}

/**
 * Fold every smart-quote/apostrophe variant to ASCII.
 */
function foldSmartQuotes(s: string): string {
  let out = s;
  for (const [from, to] of Object.entries(SMART_QUOTE_MAP)) {
    out = out.split(from).join(to);
  }
  return out;
}

/**
 * Canonical normalization for verbatim-quote comparison. Apply to BOTH the
 * candidate quote AND the source text before substring-checking.
 *
 * Ordering matters:
 *   1. Reconstruct hyphenated line breaks (must run before whitespace collapse)
 *   2. Drop soft hyphens (invisible chars hide inside otherwise-matching text)
 *   3. Replace NBSP with regular space (so whitespace collapse normalizes them)
 *   4. Fold smart quotes (so " becomes " on both sides)
 *   5. Strip markdown emphasis / code / heading tokens
 *   6. Lowercase
 *   7. Collapse whitespace
 *   8. Trim
 */
export function normalizeForQuoteCheck(s: string): string {
  let out = s;
  out = rejoinHyphenatedLineBreaks(out);
  out = out.split(SOFT_HYPHEN).join("");
  out = out.split(NBSP).join(" ");
  out = foldSmartQuotes(out);
  out = out.replace(MARKDOWN_STRIP_RE, "");
  out = out.toLowerCase();
  out = out.replace(/\s+/g, " ");
  return out.trim();
}
