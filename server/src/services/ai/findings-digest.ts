/**
 * compact digests of prior findings for the reviewer / verification
 * passes, instead of replaying whole transcripts and threat JSON.
 *
 * One line per finding keeps what those passes key on and judge: the EXACT
 * title (verification matches threats by title, case-insensitively), the
 * component, category and severity, a trimmed description, and the citation
 * tags (the REVIEWER's challenge-defend round checks them). Lines are added
 * until the token budget is spent; the rest is summarised by an explicit
 * truncation marker so the model knows the list is partial.
 *
 * Token counts are estimated at 4 characters per token (a rough estimate that
 * avoids loading a tokenizer).
 */

const DIGEST_MAX_TOKENS = 3000;
const NARRATIVE_MAX_TOKENS = 600;
const CHARS_PER_TOKEN = 4;
const DESCRIPTION_MAX_CHARS = 160;
const CITATION_TAG = /\[(?:doc|req|ref|cwe|owasp|code)[^\]]*\]/gi;

export interface DigestFinding {
  title: string;
  component?: string;
  category?: string;
  severity?: string;
  description?: string;
  /** Extra text scanned for citation tags (e.g. evidence, references). */
  citationSource?: string;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function trimTo(text: string, maxChars: number): string {
  const flat = oneLine(text);
  return flat.length <= maxChars ? flat : `${flat.slice(0, maxChars - 1)}…`;
}

function citationTags(...sources: Array<string | undefined>): string[] {
  const tags = new Set<string>();
  for (const s of sources) {
    for (const m of (s ?? "").matchAll(CITATION_TAG)) tags.add(m[0]);
  }
  return [...tags];
}

export function formatDigestLine(f: DigestFinding, index: number): string {
  const fields = [
    `"${oneLine(f.title)}"`,
    f.component,
    f.category,
    f.severity,
  ].filter((x): x is string => Boolean(x && x.trim()));
  const desc = f.description
    ? ` — ${trimTo(f.description, DESCRIPTION_MAX_CHARS)}`
    : "";
  const tags = citationTags(f.description, f.citationSource);
  const cites = tags.length ? ` ${tags.join(" ")}` : "";
  return `${index + 1}. ${fields.join(" | ")}${desc}${cites}`;
}

/**
 * Digest of findings under `maxTokens`. Every included line is complete; if the
 * budget runs out, a final marker states how many findings were omitted.
 */
export function buildFindingsDigest(
  findings: DigestFinding[],
  maxTokens: number = DIGEST_MAX_TOKENS,
): string {
  const lines: string[] = [];
  let used = 0;
  for (let i = 0; i < findings.length; i++) {
    const line = formatDigestLine(findings[i], i);
    const cost = estimateTokens(line) + 1;
    // Reserve room for the truncation marker.
    if (used + cost > maxTokens - 20) {
      const omitted = findings.length - i;
      lines.push(
        `[… ${omitted} more finding${omitted === 1 ? "" : "s"} omitted to stay under ${maxTokens} tokens]`,
      );
      break;
    }
    lines.push(line);
    used += cost;
  }
  return lines.join("\n");
}

/**
 * Cap a free-text pass output (architecture understanding, flow analysis) for
 * a later pass that also has the architecture context itself.
 */
export function capNarrative(
  text: string,
  maxTokens: number = NARRATIVE_MAX_TOKENS,
): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf("\n", maxChars);
  const head = text.slice(0, cut > maxChars / 2 ? cut : maxChars);
  return `${head}\n[… truncated to ${maxTokens} tokens; the architecture context above is complete]`;
}
