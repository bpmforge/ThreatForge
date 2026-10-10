/**
 * Paraphrase-resistant normalization for threat names.
 *
 * The LLM emits semantically-identical threats with different wordings:
 *   "Missing authentication on gRPC endpoints"
 *   "gRPC endpoints lack authentication"
 *   "Unauthenticated gRPC endpoint"
 *
 * Strict string-equality dedup misses these, so the same threat gets
 * written N times across pipeline retries. This normalizer folds common
 * paraphrases into a stable canonical form, then sorts tokens so word
 * order doesn't matter.
 *
 * Used by:
 *   - persistAIThreats() — dedup key before insert
 *   - threats.normalizedName column — DB unique constraint
 *
 * Word order is ignored EXCEPT around "by": "Spoofing of A by B" (A is
 * the victim, B the actor) must not collide with "Spoofing of B by A". Text
 * before and after the first " by " is sorted independently and joined with
 * " | ". Names without "by" keep their previous key, so only rows whose name
 * contains "by" change.
 *
 * When this algorithm changes, the normalizedName column on surviving
 * (human-reviewed) rows must be backfilled. See migrations/add-threat-dedup.
 * Backfill note: rows already persisted with a "by" name hold the old sorted
 * key. They simply stop matching the new key, so a re-run may insert one
 * duplicate PENDING row for them (never a delete or a constraint failure);
 * a one-off `UPDATE threats SET normalizedName = ...` is optional cleanup.
 */

/** Synonym rewrites applied in order. Each pass transforms the lowercased name. */
const SYNONYM_REWRITES: Array<[RegExp, string]> = [
  // ---------------------------------------------------------------------------
  // Negations → canonical "missing X" form
  // ---------------------------------------------------------------------------
  [/\bunauthenticated\b/g, "missing auth"],
  [/\bunauthorized\b/g, "missing authz"],
  [/\bunencrypted\b/g, "missing encryption"],
  [/\bunvalidated\b/g, "missing validation"],
  [/\bunsigned\b/g, "missing signing"],
  [/\bunprotected\b/g, "missing protection"],
  [/\bunrestricted\b/g, "missing restriction"],
  [/\black of\b/g, "missing"],
  [/\blacks\b/g, "missing"],
  [/\blacking\b/g, "missing"],
  [/\black\b/g, "missing"],
  [/\babsent\b/g, "missing"],
  [/\binsufficient\b/g, "missing"],
  [/\binadequate\b/g, "missing"],
  [/\bno\b(?!\w)/g, "missing"],
  [
    /\bnot\s+(encrypted|authenticated|validated|signed|authorized|protected)\b/g,
    "missing $1",
  ],

  // ---------------------------------------------------------------------------
  // Terminology canonicalization
  // ---------------------------------------------------------------------------
  [/\bauthentication\b/g, "auth"],
  [/\bauthenticated\b/g, "auth"],
  [/\bauthn\b/g, "auth"],
  [/\bauthorization\b/g, "authz"],
  [/\bauthorized\b/g, "authz"],
  [/\bencrypted\b/g, "encryption"],
  [/\bvalidated\b/g, "validation"],
  [/\bsigned\b/g, "signing"],
  [/\bprotected\b/g, "protection"],
  [/\brole[- ]?based\s+access\s+control\b/g, "rbac"],
  [/\bmutual\s+tls\b/g, "mtls"],
  [/\baccess\s+control\b/g, "authz"],

  // ---------------------------------------------------------------------------
  // Consequence / connecting verbs — drop to collapse "X enables Y" & "X Y"
  // ---------------------------------------------------------------------------
  [
    /\b(enables?|allows?|risks?|leads?\s+to|results?\s+in|causes?|exposes?|vulnerable\s+to|susceptible\s+to)\b/g,
    " ",
  ],

  // ---------------------------------------------------------------------------
  // Simple plural stemming (only common security-vocab plurals — safe)
  // ---------------------------------------------------------------------------
  [/\bendpoints\b/g, "endpoint"],
  [/\bservices\b/g, "service"],
  [/\brequests\b/g, "request"],
  [/\bresponses\b/g, "response"],
  [/\bchannels\b/g, "channel"],
  [/\busers\b/g, "user"],
  [/\btokens\b/g, "token"],
  [/\bcredentials\b/g, "credential"],
  [/\bassignments\b/g, "assignment"],
  [/\bdecisions\b/g, "decision"],
  [/\bchanges\b/g, "change"],
  [/\bcalls\b/g, "call"],
  [/\bpermissions\b/g, "permission"],
  [/\broles\b/g, "role"],
  [/\bmessages\b/g, "message"],
  [/\bchecks\b/g, "check"],
  [/\bsessions\b/g, "session"],
  [/\bcertificates\b/g, "certificate"],
  [/\bheaders\b/g, "header"],
];

/**
 * Stopwords stripped from the token stream. Short / high-frequency words
 * that don't carry meaning in a threat name.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "that",
  "this",
  "these",
  "those",
  "its",
  "it",
  "their",
  "there",
  "can",
  "may",
  "might",
  "could",
  "would",
  "should",
  "via",
  "as",
  "due",
  "other",
  "also",
  "any",
  "all",
  "each",
  "such",
  "than",
  "then",
  "when",
  "where",
  "which",
  "who",
  "whom",
]);

/**
 * Normalize a threat name to a canonical token-sorted form.
 *
 * Properties:
 *   - Case-insensitive
 *   - Punctuation-insensitive
 *   - Word-order insensitive (tokens sorted alphabetically)
 *   - Paraphrase-tolerant for common STRIDE negation patterns
 *   - Pure — no I/O, stable output
 *
 * @example
 *   normalizeThreatName("Missing authentication on gRPC endpoints")
 *   → "auth endpoint grpc missing"
 *
 *   normalizeThreatName("gRPC endpoints lack authentication")
 *   → "auth endpoint grpc missing"       // same key
 *
 *   normalizeThreatName("Unauthenticated gRPC endpoint")
 *   → "auth endpoint grpc missing"       // same key
 */
export function normalizeThreatName(name: string): string {
  if (!name) return "";

  // Keep the actor ("by X") distinct from the subject.
  const [subject, ...actor] = name.split(/\bby\b/i);
  if (actor.length > 0 && subject.trim() && actor.join(" ").trim()) {
    return `${normalizeSide(subject)} | ${normalizeSide(actor.join(" "))}`;
  }
  return normalizeSide(name);
}

function normalizeSide(text: string): string {
  // Dedup + sort → word-order invariant canonical form
  return [...new Set(canonicalTokens(text))].sort().join(" ");
}

/**
 * The token stream behind the canonical key: lowercased, synonym-rewritten,
 * stopwords removed, in original order (duplicates kept). Exported so the
 * similarity scorer (services/ai/dedup) folds paraphrases exactly the way the
 * dedup key does instead of keeping a second vocabulary.
 */
export function canonicalTokens(text: string): string[] {
  let s = text.toLowerCase();

  for (const [re, replacement] of SYNONYM_REWRITES) {
    s = s.replace(re, replacement);
  }

  return s
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Build the composite dedup key used by `persistAIThreats` and the DB
 * unique constraint.
 *
 * Threats attach to a component, a connection, or neither (compound).
 * Using a sentinel for compound threats prevents multiple compound
 * threats with the same normalized name from being inserted — without
 * the sentinel, Postgres treats NULLs as distinct and the constraint
 * fails open.
 */
export function buildThreatDedupKey(
  threatModelId: string,
  componentNodeId: string | null | undefined,
  connectionEdgeId: string | null | undefined,
  name: string,
): string {
  const target = componentNodeId || connectionEdgeId || "__compound__";
  return `${threatModelId}::${target}::${normalizeThreatName(name)}`;
}
