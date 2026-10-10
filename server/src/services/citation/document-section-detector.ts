/**
 * Document section detector (heuristic).
 *
 * Runs over the plain text returned by pdf-parse / mammoth / TXT readers
 * and produces an array of detected sections. Each section gets a stable
 * anchor used as the citation target.
 *
 * Patterns (in order; first match wins per line):
 *   1. Numbered:        "3.2 Authentication"          → anchor "3.2"
 *   2. Lettered:        "Appendix A: Glossary"        → anchor "appendix-a"
 *   3. Markdown:        "## Authentication"           → anchor "authentication"
 *   4. ALL-CAPS phrase: "SYSTEM OVERVIEW"             → anchor "system-overview"
 *      (≥2 ALL-CAPS words OR ALL-CAPS line followed by blank line + body)
 *
 * Sections are non-overlapping and cover the whole document; each section's
 * range is from its heading line to the line before the next heading.
 */

export interface DetectedSection {
  anchor: string;
  header: string;
  pageNumber?: number;
  startOffset: number;
  endOffset: number;
}

const NUMBERED_HEADING = /^(\d+(?:\.\d+)*)\s+(.{2,100})$/;
const LETTERED_APPENDIX = /^Appendix\s+([A-Z])(?:[:\s]+(.{2,100}))?$/i;
const MARKDOWN_HEADING = /^#{1,6}\s+(.{2,100})$/;
const ALLCAPS_TWO_PLUS_WORDS = /^([A-Z][A-Z0-9]*(?:\s+[A-Z][A-Z0-9]*){1,9})$/;
// A single ALL-CAPS word counts as a heading only if followed by a blank line.
const ALLCAPS_SINGLE = /^([A-Z][A-Z0-9]{2,})$/;

interface RawHeading {
  anchor: string;
  header: string;
  startOffset: number;
}

export function detectSections(text: string): DetectedSection[] {
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const headings: RawHeading[] = [];
  let cursor = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineStart = cursor;
    cursor += line.length + 1; // +1 for the newline that split removed

    if (trimmed.length === 0 || trimmed.length > 120) continue;

    const heading = matchHeading(trimmed, lines, i);
    if (heading) {
      headings.push({ ...heading, startOffset: lineStart });
    }
  }

  if (headings.length === 0) return [];

  // Build sections from heading start to next heading start (or EOF)
  const sections: DetectedSection[] = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const next = headings[i + 1];
    sections.push({
      anchor: h.anchor,
      header: h.header,
      startOffset: h.startOffset,
      endOffset: next ? next.startOffset - 1 : text.length,
    });
  }

  return dedupAnchors(sections);
}

function matchHeading(
  trimmed: string,
  lines: string[],
  index: number,
): { anchor: string; header: string } | null {
  let m = trimmed.match(NUMBERED_HEADING);
  if (m) return { anchor: m[1], header: trimmed };

  m = trimmed.match(LETTERED_APPENDIX);
  if (m) {
    const letter = m[1].toLowerCase();
    return { anchor: `appendix-${letter}`, header: trimmed };
  }

  m = trimmed.match(MARKDOWN_HEADING);
  if (m) return { anchor: slugify(m[1]), header: m[1] };

  m = trimmed.match(ALLCAPS_TWO_PLUS_WORDS);
  if (m) return { anchor: slugify(trimmed), header: trimmed };

  // Single ALL-CAPS word: only if followed by blank line + non-empty body
  m = trimmed.match(ALLCAPS_SINGLE);
  if (m) {
    const next = lines[index + 1]?.trim() ?? "";
    const after = lines[index + 2]?.trim() ?? "";
    if (next === "" && after.length > 0 && !ALLCAPS_SINGLE.test(after)) {
      return { anchor: slugify(trimmed), header: trimmed };
    }
  }

  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/** If two headings produce the same anchor, suffix later ones with "-N". */
function dedupAnchors(sections: DetectedSection[]): DetectedSection[] {
  const seen = new Map<string, number>();
  return sections.map((s) => {
    const count = seen.get(s.anchor) ?? 0;
    seen.set(s.anchor, count + 1);
    if (count === 0) return s;
    return { ...s, anchor: `${s.anchor}-${count + 1}` };
  });
}

/** Look up a section by its anchor. Linear scan is fine — section counts are small. */
export function findSection(
  sections: DetectedSection[],
  anchor: string,
): DetectedSection | undefined {
  return sections.find((s) => s.anchor === anchor);
}

/** Slice the cited section's text from the document content. */
export function getSectionText(text: string, section: DetectedSection): string {
  return text.slice(section.startOffset, section.endOffset);
}
