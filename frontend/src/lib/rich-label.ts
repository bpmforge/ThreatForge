/**
 * Rich-text node labels.
 *
 * `richLabel` is a constrained Markdown subset stored as a plain string:
 *   **bold**, *italic*, "- " bullet lines, "1. " numbered lines, one paragraph per line.
 * It is parsed to a small typed AST and rendered as React elements, so no HTML
 * is ever parsed or injected — anything else (tags, links, images) stays literal text.
 */

export const RICH_LABEL_MAX_LENGTH = 2000;

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type RichBlock =
  | { kind: "p"; runs: InlineRun[] }
  | { kind: "ul" | "ol"; items: InlineRun[][] };

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Normalize untrusted input: strip control chars, unify newlines, cap length. */
export function normalizeRichLabel(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const s = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .slice(0, RICH_LABEL_MAX_LENGTH);
  return s.trim() === "" ? undefined : s;
}

const INLINE_RE = /\\([\\*])|\*\*(?=\S)([\s\S]*?\S)\*\*|\*(?=\S)([^*]*?\S)\*/g;

/** Parse inline bold/italic. Unmatched markers remain literal. */
export function parseInline(src: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let last = 0;
  const push = (r: InlineRun) => {
    if (r.text) runs.push(r);
  };
  for (const m of src.matchAll(INLINE_RE)) {
    push({ text: src.slice(last, m.index) });
    if (m[1] !== undefined) {
      push({ text: m[1] });
    } else if (m[2] !== undefined) {
      for (const r of parseInline(m[2])) push({ ...r, bold: true });
    } else if (m[3] !== undefined) {
      push({ text: m[3], italic: true });
    }
    last = (m.index ?? 0) + m[0].length;
  }
  push({ text: src.slice(last) });
  return runs;
}

const UL_RE = /^\s*[-•]\s+(.*)$/;
const OL_RE = /^\s*\d{1,3}[.)]\s+(.*)$/;

export function parseRichLabel(src: string | undefined): RichBlock[] {
  const text = normalizeRichLabel(src);
  if (!text) return [];
  const blocks: RichBlock[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const ul = UL_RE.exec(line);
    const ol = ul ? null : OL_RE.exec(line);
    const list = ul ? "ul" : ol ? "ol" : null;
    if (list) {
      const item = parseInline((ul ?? ol)![1]!);
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === list) prev.items.push(item);
      else blocks.push({ kind: list, items: [item] });
    } else {
      blocks.push({ kind: "p", runs: parseInline(line.trim()) });
    }
  }
  return blocks;
}

const runsToText = (runs: InlineRun[]) => runs.map((r) => r.text).join("");

/** Plain-text projection (used as the `label` fallback and for a11y). */
export function richLabelToPlainText(src: string | undefined): string {
  return parseRichLabel(src)
    .flatMap((b) =>
      b.kind === "p" ? [runsToText(b.runs)] : b.items.map(runsToText),
    )
    .join(" ")
    .trim();
}
