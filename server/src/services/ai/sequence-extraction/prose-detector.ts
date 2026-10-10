/**
 * Prose-sequence detection.
 *
 * Real SRS / SAD / SDS documents rarely embed Mermaid blocks. They describe
 * sequences as numbered prose under headings like "Software Process Workflow"
 * or "Sequence of Operations." This module finds those sections deterministically
 * — no LLM — and hands the raw step list off to the prose extractor for
 * structured parsing.
 *
 * Detection contract:
 *   - Match a Markdown heading whose text contains a sequence keyword
 *     (workflow / process flow / sequence / data flow / operations / interaction)
 *     AND lacks a "negative" keyword (algorithm / calculation / computation —
 *     these are processing recipes, not inter-component flows)
 *   - The body must contain ≥ 2 consecutive ordered-list items
 *
 * The detector is intentionally conservative. False negatives (missed real
 * sequences) get caught by user review. False positives (algorithm steps
 * sent through the LLM extractor) waste tokens AND pollute the canvas with
 * non-sequences — much worse.
 */

interface ProseSequenceStep {
  /** 1-based step number as written in the document. */
  number: number;
  /** The step's text, with the leading "1." numbering stripped. */
  text: string;
  /** The verbatim line from the document for downstream quote validation. */
  sourceQuote: string;
}

export interface DetectedProseSequence {
  /** Heading text WITHOUT the leading `#` markers and without leading section number. */
  heading: string;
  /** 1-6, the markdown heading level. */
  headingLevel: number;
  /** Steps in document order. */
  steps: ProseSequenceStep[];
  /** Source-block quote covering heading + steps — for traceability. */
  sourceQuote: string;
}

/** Keywords that flag a heading as a likely inter-component sequence. */
const POSITIVE_HEADING_PATTERNS = [
  /\bworkflow\b/i,
  /\bprocess\s*flow\b/i,
  /\bsequence\b/i,
  /\bdata\s*flow\b/i,
  /\binteraction\b/i,
];

/** Keywords that VETO an otherwise-positive heading. */
const NEGATIVE_HEADING_PATTERNS = [
  /\balgorithm\b/i,
  /\bcalculation\b/i,
  /\bcomputation\b/i,
  /\bheuristic\b/i,
  /\brounding\b/i,
  /\b(?:test|testing)\s+(?:procedure|protocol)\b/i,
];

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const ORDERED_ITEM_RE = /^(\s{0,3})(\d+)\.\s+(.+)$/;
const HEADING_NUMBER_PREFIX_RE = /^\d+(?:\.\d+)*\.?\s+/;

/**
 * Walk a document's lines, returning every block that looks like an
 * inter-component prose sequence. Order preserved.
 */
export function detectProseSequences(
  documentText: string,
): DetectedProseSequence[] {
  const lines = documentText.split(/\r?\n/);
  const out: DetectedProseSequence[] = [];

  let i = 0;
  while (i < lines.length) {
    const headingMatch = HEADING_RE.exec(lines[i]);
    if (!headingMatch) {
      i++;
      continue;
    }

    const level = headingMatch[1].length;
    const rawHeading = headingMatch[2];
    const heading = rawHeading.replace(HEADING_NUMBER_PREFIX_RE, "").trim();

    if (!isSequenceHeading(heading) && !isSequenceHeading(rawHeading)) {
      i++;
      continue;
    }

    // Walk forward collecting every numbered list item until we hit
    // another heading of the same or lower level.
    const headingLineIndex = i;
    const steps: ProseSequenceStep[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const nextHeading = HEADING_RE.exec(lines[j]);
      if (nextHeading && nextHeading[1].length <= level) break;

      const item = ORDERED_ITEM_RE.exec(lines[j]);
      if (item) {
        steps.push({
          number: Number.parseInt(item[2], 10),
          text: item[3].trim(),
          sourceQuote: lines[j].trim(),
        });
      }
      j++;
    }

    if (steps.length >= 2 && stepsLookLikeOneList(steps)) {
      const blockText = lines.slice(headingLineIndex, j).join("\n").trim();
      out.push({
        heading,
        headingLevel: level,
        steps,
        sourceQuote: blockText,
      });
    }

    i = j;
  }

  return out;
}

/**
 * Heading qualifies as a sequence header iff it matches ≥1 positive pattern
 * AND zero negative patterns. The negative check is what keeps SDS algorithm
 * sections out of the prose extractor.
 */
export function isSequenceHeading(heading: string): boolean {
  for (const neg of NEGATIVE_HEADING_PATTERNS) {
    if (neg.test(heading)) return false;
  }
  for (const pos of POSITIVE_HEADING_PATTERNS) {
    if (pos.test(heading)) return true;
  }
  return false;
}

/**
 * Collected items must form a single contiguous list — not two unrelated
 * lists separated by another section. Heuristic: numbers should be roughly
 * monotonic from 1, with no gaps larger than 2 (allowing one missing step
 * for sub-bullet rendering quirks).
 */
function stepsLookLikeOneList(steps: ProseSequenceStep[]): boolean {
  if (steps.length === 0) return false;
  if (steps[0].number > 2) return false;
  for (let k = 1; k < steps.length; k++) {
    const delta = steps[k].number - steps[k - 1].number;
    if (delta < 0 || delta > 2) return false;
  }
  return true;
}
