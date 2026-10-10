/**
 * Citation parser — extracts citation tags from LLM output and returns
 * structured ParsedClaim records the verifier can process.
 *
 * Builds on response-parsers.ts (which handles the JSON envelope around
 * threats/mitigations); this module operates on the per-claim text fields
 * (`description`, `name`, etc.) that may carry inline citation tags.
 */
import { CITATION_PATTERNS, stripCitationTags } from "./citation-grammar.js";
import type { ParsedClaim, ParsedCitation } from "./citation-grammar.js";
import type { CitationKind } from "@prisma/client";

/**
 * Parse a single text field for citation tags + kind prefix.
 * Returns a ParsedClaim with kind, citations, and the bare claim text.
 */
export function parseClaim(text: string): ParsedClaim {
  if (!text) {
    return { claim: "", kind: "NONE", citations: [], raw: "" };
  }

  const raw = text;
  const kind = detectKind(text);
  const citations: ParsedCitation[] = [
    ...parseDocumentCitations(text),
    ...parseReferenceCitations(text),
    ...parseComponentCitations(text),
    ...parseRequirementCitations(text),
  ];
  const claim = stripCitationTags(text);

  return { claim, kind, citations, raw };
}

function detectKind(text: string): CitationKind {
  const trimmed = text.trim();
  if (/^Not found:/i.test(trimmed)) return "NOT_FOUND";
  if (/^Inferred from\b/i.test(trimmed)) return "INFERRED";
  if (/^Per\s/i.test(trimmed)) return "DERIVED";
  // Bare [ref:...] / [component:...] / [doc:...] / [req:...] without prefix → DERIVED
  if (
    CITATION_PATTERNS.document.test(trimmed) ||
    CITATION_PATTERNS.reference.test(trimmed) ||
    CITATION_PATTERNS.component.test(trimmed) ||
    CITATION_PATTERNS.requirement.test(trimmed)
  ) {
    // Reset lastIndex on the global regexes (test() advances it)
    CITATION_PATTERNS.document.lastIndex = 0;
    CITATION_PATTERNS.reference.lastIndex = 0;
    CITATION_PATTERNS.component.lastIndex = 0;
    CITATION_PATTERNS.requirement.lastIndex = 0;
    return "DERIVED";
  }
  return "NONE";
}

function parseDocumentCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  CITATION_PATTERNS.document.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_PATTERNS.document.exec(text)) !== null) {
    const [, filename, sectionAnchor, pageStr] = m;
    out.push({
      type: "DOCUMENT",
      documentName: filename,
      sectionAnchor: sectionAnchor || undefined,
      pageNumber: pageStr ? Number(pageStr) : undefined,
    });
  }
  return out;
}

function parseReferenceCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  CITATION_PATTERNS.reference.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_PATTERNS.reference.exec(text)) !== null) {
    const [, kind, rest] = m;
    out.push({
      type: "REFERENCE",
      referenceKind: kind,
      referenceId: rest ? `${kind}-${rest}` : kind,
    });
  }
  return out;
}

function parseComponentCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  CITATION_PATTERNS.component.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_PATTERNS.component.exec(text)) !== null) {
    out.push({ type: "COMPONENT", componentNodeId: m[1] });
  }
  return out;
}

function parseRequirementCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  CITATION_PATTERNS.requirement.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_PATTERNS.requirement.exec(text)) !== null) {
    out.push({ type: "REQUIREMENT", requirementId: m[1].trim() });
  }
  return out;
}

/**
 * Apply parseClaim to a typed object's text field. Returns the updated
 * object with the bare claim plus a `_parsed` sidecar holding kind +
 * citations. Caller uses the sidecar to write Citation rows.
 */
export function parseClaimField<T extends Record<string, unknown>>(
  obj: T,
  field: keyof T,
): T & { _parsed: ParsedClaim } {
  const text = obj[field];
  if (typeof text !== "string") {
    return {
      ...obj,
      _parsed: { claim: "", kind: "NONE", citations: [], raw: "" },
    };
  }
  const parsed = parseClaim(text);
  return { ...obj, [field]: parsed.claim, _parsed: parsed };
}
