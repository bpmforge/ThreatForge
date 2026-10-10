/**
 * Export Sequence Diagrams to Mermaid format.
 */
import type {
  SequenceDiagram,
  SequenceMessageType,
} from "@/features/sequence-diagrams";
import { downloadFile } from "./download";

export interface SequenceMermaidOptions {
  /** Include notes in the diagram */
  includeNotes?: boolean;
  /** Include protocol/auth info as notes */
  includeProtocolInfo?: boolean;
}

const DEFAULT_OPTIONS: SequenceMermaidOptions = {
  includeNotes: true,
  includeProtocolInfo: true,
};

/**
 * Generate Mermaid sequenceDiagram content from a SequenceDiagram.
 */
function generateSequenceMermaid(
  diagram: SequenceDiagram,
  options: SequenceMermaidOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = ["sequenceDiagram"];

  // Sort participants by order
  const sortedParticipants = [...diagram.participants].sort(
    (a, b) => a.order - b.order,
  );

  // Add participants
  for (const p of sortedParticipants) {
    const safeName = sanitizeId(p.id);
    const safeLabel = sanitizeLabel(p.label);
    lines.push(`    participant ${safeName} as ${safeLabel}`);
  }

  lines.push("");

  // Sort messages by order
  const sortedMessages = [...diagram.messages].sort(
    (a, b) => a.order - b.order,
  );

  // Add messages
  for (const msg of sortedMessages) {
    const fromId = sanitizeId(msg.fromId);
    const toId = sanitizeId(msg.toId);
    const label = sanitizeLabel(msg.label);

    // Determine arrow type based on message type
    const arrow = getArrowType(msg);

    lines.push(`    ${fromId}${arrow}${toId}: ${label}`);

    // Add protocol/auth note if enabled
    if (opts.includeProtocolInfo && (msg.protocol || msg.authentication)) {
      const noteItems: string[] = [];
      if (msg.protocol) noteItems.push(msg.protocol);
      if (msg.authentication && msg.authentication !== "NONE") {
        noteItems.push(`Auth: ${msg.authentication}`);
      }
      if (noteItems.length > 0) {
        lines.push(`    Note right of ${toId}: ${noteItems.join(", ")}`);
      }
    }

    // Add custom notes if enabled
    if (opts.includeNotes && msg.notes) {
      lines.push(
        `    Note over ${fromId},${toId}: ${sanitizeLabel(msg.notes)}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Export a sequence diagram to a Mermaid .mmd file.
 */
export function exportSequenceToMermaid(
  diagram: SequenceDiagram,
  options: SequenceMermaidOptions = {},
): void {
  const content = generateSequenceMermaid(diagram, options);
  const filename = `${sanitizeFilename(diagram.name)}-sequence.mmd`;
  downloadFile(content, filename, "text/plain");
}

function getArrowType(msg: SequenceMessageType): string {
  // Mermaid arrow types:
  // ->>  : solid line, arrowhead (sync)
  // -->> : dotted line, arrowhead (async)
  // -x   : solid line, X (destroy)
  // --x  : dotted line, X
  // -)   : solid line, open arrow (async)
  // --)  : dotted line, open arrow

  if (msg.isReturn) {
    return "-->>"; // Return messages are dotted
  }

  switch (msg.messageType) {
    case "ASYNC":
      return "--)";
    case "RETURN":
      return "-->>";
    case "DESTROY":
      return "-x";
    case "SELF":
      return "->>"; // Self calls use same arrow but same source/target
    case "CREATE":
      return "->>+"; // Activate on create
    case "SYNC":
    default:
      return "->>";
  }
}

function sanitizeId(id: string): string {
  // Mermaid IDs must be alphanumeric with underscores
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function sanitizeLabel(label: string): string {
  // Escape special characters in labels
  return label
    .replace(/"/g, "'")
    .replace(/[[\]{}#&;]/g, " ")
    .trim();
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
