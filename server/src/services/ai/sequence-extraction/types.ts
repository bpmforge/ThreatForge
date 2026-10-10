/**
 * Sequence-extraction types.
 *
 * The shape mirrors Prisma's SequenceDiagram / SequenceParticipant /
 * SequenceMessage so importers can pass these through with minimal
 * reshaping.
 */

export interface ExtractedSequenceParticipant {
  label: string;
  order: number;
}

export interface ExtractedSequenceMessage {
  from: string;
  to: string;
  label: string;
  order: number;
  messageType: "SYNC" | "ASYNC" | "RETURN";
  isReturn: boolean;
  protocol?: string | null;
  authentication?: string | null;
  notes?: string | null;
  /** Verbatim line from the source block — traceability for the verifier. */
  sourceQuote: string;
}

export interface ExtractedSequenceDiagram {
  name: string;
  description?: string;
  format: "mermaid" | "plantuml" | "prose";
  participants: ExtractedSequenceParticipant[];
  messages: ExtractedSequenceMessage[];
  /** The raw source block this diagram was parsed from. */
  sourceQuote: string;
}

// ---------------------------------------------------------------------------
// Diagram Planner types
// ---------------------------------------------------------------------------

export interface PlannedDiagramCitation {
  /** Source document name (e.g. "SAD.pdf") */
  docName: string;
  /** Verbatim excerpt from the source document */
  quote: string;
}

/** A single diagram the planner believes should exist, before extraction. */
export interface PlannedDiagram {
  /** Short, unique name (e.g. "Telemetry Ingestion Flow") */
  name: string;
  /** Why this diagram is needed — references actors and purpose */
  justification: string;
  /** Citations backing the justification — must pass substring-match validation */
  citations: PlannedDiagramCitation[];
  /** LLM-emitted confidence 0-1 */
  confidence: number;
  /** Set by the defend pass — RETAINED | RETRACTED */
  defenseStatus?: "RETAINED" | "RETRACTED";
  /** Which citations failed substring-match (populated on RETRACTED) */
  failedCitations?: PlannedDiagramCitation[];
}
