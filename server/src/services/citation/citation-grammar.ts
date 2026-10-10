/**
 * Citation grammar — the inline tag format the LLM must emit alongside each
 * claim, and the structured form the verifier consumes.
 *
 * Grammar (LLM-facing):
 *
 *   Per [doc:srs.pdf §3.2]: <claim>          // DERIVED
 *   Inferred from [doc:srs.pdf §3.2]: <claim> // INFERRED
 *   [ref:CWE-89] <claim>                     // REFERENCE
 *   [component:web-frontend] <claim>         // COMPONENT
 *   Not found: <claim>                       // NOT_FOUND
 *
 * The verifier strips the prefix + tag, classifies kind/type, and stores the
 * bare claim text. See citation-parser.ts for the consumer.
 */
import type { CitationKind, CitationType } from "@prisma/client";

export interface ParsedCitation {
  type: CitationType;
  documentName?: string; // resolved to documentId by the verifier
  sectionAnchor?: string;
  pageNumber?: number;
  referenceKind?: string; // "CWE", "OWASP", etc.
  referenceId?: string;
  componentNodeId?: string;
  /** Requirement reqId as emitted by the LLM, e.g. "FR-12", "REQ-3.2.1". */
  requirementId?: string;
}

export interface ParsedClaim {
  /** Bare claim text with citation tags + kind prefix removed. */
  claim: string;
  kind: CitationKind;
  citations: ParsedCitation[];
  /** Original tagged text — preserved for audit and debugging. */
  raw: string;
}

/** Regex literals exported so parser + tests share the same grammar. */
export const CITATION_PATTERNS = {
  /** [doc:filename §anchor] or [doc:filename p.N] */
  document: /\[doc:([^\s\]]+)\s+(?:§([^\]]+)|p\.(\d+))\]/gi,
  /** [ref:KIND-ID] — KIND is alphanumeric+underscore, ID is anything until ] */
  reference: /\[ref:([A-Z0-9_]+)[-/:]?([^\]]*)\]/gi,
  /** [component:nodeId] */
  component: /\[component:([^\]]+)\]/gi,
  /** [req:REQ-ID] — matches an imported-requirement reqId verbatim */
  requirement: /\[req:([^\]]+)\]/gi,
} as const;

/** Strip all citation tags from a claim, returning the bare text. */
export function stripCitationTags(text: string): string {
  return (
    text
      .replace(CITATION_PATTERNS.document, "")
      .replace(CITATION_PATTERNS.reference, "")
      .replace(CITATION_PATTERNS.component, "")
      .replace(CITATION_PATTERNS.requirement, "")
      .replace(/^\s*(Per|Inferred from|Not found)\s*:?\s*/i, "")
      // After tag strip, the prefix's residual ":" may be stranded. Eat it.
      .replace(/^\s*:\s*/, "")
      .trim()
  );
}
