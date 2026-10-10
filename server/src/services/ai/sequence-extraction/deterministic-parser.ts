/**
 * Deterministic sequence-diagram extractor.
 *
 * Finds Mermaid / PlantUML sequence diagrams inside document text and
 * parses them into the canvas's SequenceDiagram shape — no LLM.
 *
 * Supported sources:
 *   - Fenced code blocks: ```mermaid ... ``` / ```plantuml ... ``` / ```puml ... ```
 *   - PlantUML @startuml ... @enduml (with or without fences)
 *   - Unlabelled fenced blocks whose first non-empty line is `sequenceDiagram`
 *
 * Intentionally narrow: we only parse message arrows and participant
 * declarations. Activations, notes, alt/else/loop/par blocks are ignored
 * (they don't produce SequenceMessage rows). This keeps the parser
 * predictable and safe to run on untrusted document content.
 */

import type {
  ExtractedSequenceDiagram,
  ExtractedSequenceMessage,
  ExtractedSequenceParticipant,
} from "./types.js";

// ---------------------------------------------------------------------------
// Block detection
// ---------------------------------------------------------------------------

interface DetectedBlock {
  format: "mermaid" | "plantuml";
  body: string;
}

/**
 * Find all Mermaid / PlantUML sequence-diagram blocks in a document.
 * Returns them in document order. Blocks that aren't recognizable as
 * sequence diagrams (e.g., mermaid classDiagram) are skipped.
 */
export function detectSequenceBlocks(documentText: string): DetectedBlock[] {
  const blocks: Array<DetectedBlock & { index: number }> = [];

  // 1. Fenced code blocks with explicit language tag.
  const fenceRe = /```(mermaid|plantuml|puml)\s*\n([\s\S]*?)\n```/gi;
  for (const m of documentText.matchAll(fenceRe)) {
    const lang = m[1].toLowerCase();
    const body = m[2];
    const format: "mermaid" | "plantuml" =
      lang === "mermaid" ? "mermaid" : "plantuml";
    if (format === "mermaid" && !isMermaidSequence(body)) continue;
    if (format === "plantuml" && !isPlantumlSequence(body)) continue;
    blocks.push({ format, body, index: m.index ?? 0 });
  }

  // 2. Bare ```...``` fences starting with `sequenceDiagram` (Mermaid, no lang tag).
  const bareFenceRe = /```\s*\n([\s\S]*?)\n```/g;
  for (const m of documentText.matchAll(bareFenceRe)) {
    const body = m[1];
    // Skip blocks we already matched with explicit tag.
    if (overlapsExistingBlock(blocks, m.index ?? 0, m[0].length)) continue;
    if (isMermaidSequence(body)) {
      blocks.push({ format: "mermaid", body, index: m.index ?? 0 });
    }
  }

  // 3. PlantUML @startuml ... @enduml outside fences.
  const pumlRe = /@startuml[\s\S]*?@enduml/g;
  for (const m of documentText.matchAll(pumlRe)) {
    if (overlapsExistingBlock(blocks, m.index ?? 0, m[0].length)) continue;
    if (isPlantumlSequence(m[0])) {
      blocks.push({ format: "plantuml", body: m[0], index: m.index ?? 0 });
    }
  }

  return blocks
    .sort((a, b) => a.index - b.index)
    .map(({ format, body }) => ({ format, body }));
}

function overlapsExistingBlock(
  blocks: Array<{ index: number; body: string }>,
  start: number,
  length: number,
): boolean {
  const end = start + length;
  for (const b of blocks) {
    const bEnd = b.index + b.body.length + 10; // slack for fence chars
    if (start < bEnd && end > b.index) return true;
  }
  return false;
}

function isMermaidSequence(body: string): boolean {
  return /(^|\n)\s*sequenceDiagram\b/i.test(body);
}

function isPlantumlSequence(body: string): boolean {
  // Heuristic: presence of an arrow and at least one participant-like token.
  // Explicitly reject class/component/usecase diagrams.
  if (/\b(class|usecase|component|object|activity)\s+\w+/i.test(body))
    return false;
  return (
    /[-=]{1,2}[>x)]\s*\w/.test(body) || /\b(participant|actor)\b/i.test(body)
  );
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

/**
 * Parse every sequence block found in a document. Returns an empty array
 * when no recognizable diagrams are present.
 */
export function parseDeterministicSequences(
  documentText: string,
): ExtractedSequenceDiagram[] {
  const blocks = detectSequenceBlocks(documentText);
  const diagrams: ExtractedSequenceDiagram[] = [];
  let autoIndex = 1;

  for (const block of blocks) {
    const parsed =
      block.format === "mermaid"
        ? parseMermaidBlock(block.body)
        : parsePlantUMLBlock(block.body);

    if (parsed.messages.length === 0) continue;

    diagrams.push({
      name: parsed.name || `Imported Sequence ${autoIndex++}`,
      description: parsed.description,
      format: block.format,
      participants: parsed.participants,
      messages: parsed.messages,
      sourceQuote: block.body.trim(),
    });
  }

  return diagrams;
}

// ---------------------------------------------------------------------------
// Mermaid parser
// ---------------------------------------------------------------------------

/**
 * Mermaid arrow grammar (sequenceDiagram):
 *   A->B:   open solid
 *   A->>B:  solid with arrowhead
 *   A-->B:  dashed
 *   A-->>B: dashed return
 *   A-xB:   lost message (sync)
 *   A-)B:   async open
 *   A--)B:  async dashed
 *   A--xB:  lost async
 */
const MERMAID_ARROW_RE =
  /^\s*([A-Za-z0-9_"][A-Za-z0-9 _"'.\\/-]*?)\s*(-{1,2}[>x)]{1,2})\s*([A-Za-z0-9_"][A-Za-z0-9 _"'.\\/-]*?)\s*:\s*(.+)$/;

const MERMAID_PARTICIPANT_RE =
  /^\s*(?:participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+?))?\s*$/i;

export interface ParsedBlock {
  name?: string;
  description?: string;
  participants: ExtractedSequenceParticipant[];
  messages: ExtractedSequenceMessage[];
}

export function parseMermaidBlock(body: string): ParsedBlock {
  const lines = body.split(/\r?\n/);
  const participants = new Map<string, ExtractedSequenceParticipant>();
  const messages: ExtractedSequenceMessage[] = [];
  let name: string | undefined;
  let description: string | undefined;
  let participantOrder = 0;
  let messageOrder = 0;

  const recordParticipant = (label: string) => {
    const key = stripQuotes(label).trim();
    if (!key) return key;
    if (!participants.has(key)) {
      participants.set(key, { label: key, order: participantOrder++ });
    }
    return key;
  };

  for (const rawLine of lines) {
    const line = stripMermaidComment(rawLine).trim();
    if (!line) continue;

    // `title ...` directive (non-standard but seen in extensions)
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      name = titleMatch[1].trim();
      continue;
    }

    // Skip control-flow tokens that aren't messages. Word boundaries
    // matter — without them "par" swallows "participant".
    if (
      /^(?:sequenceDiagram|autonumber|activate|deactivate|alt|else|end|loop|par|and|rect|opt|break|critical|Note)\b/i.test(
        line,
      )
    )
      continue;

    // Participant declaration
    const pMatch = MERMAID_PARTICIPANT_RE.exec(line);
    if (pMatch) {
      const alias = pMatch[1];
      const displayLabel = pMatch[2] ? stripQuotes(pMatch[2]).trim() : alias;
      if (!participants.has(alias)) {
        participants.set(alias, {
          label: displayLabel,
          order: participantOrder++,
        });
      } else {
        // Update label if we had only a placeholder
        const existing = participants.get(alias);
        if (existing && existing.label === alias && displayLabel !== alias) {
          existing.label = displayLabel;
        }
      }
      continue;
    }

    // Message arrow
    const aMatch = MERMAID_ARROW_RE.exec(line);
    if (!aMatch) continue;

    const fromRaw = aMatch[1];
    const arrow = aMatch[2];
    const toRaw = aMatch[3];
    const label = aMatch[4].trim();

    const from = recordParticipant(fromRaw);
    const to = recordParticipant(toRaw);
    if (!from || !to) continue;

    const classified = classifyMermaidArrow(arrow);

    messages.push({
      from,
      to,
      label,
      order: messageOrder++,
      messageType: classified.messageType,
      isReturn: classified.isReturn,
      protocol: null,
      authentication: null,
      notes: null,
      sourceQuote: rawLine.trim(),
    });
  }

  return {
    name,
    description,
    participants: [...participants.values()].sort((a, b) => a.order - b.order),
    messages,
  };
}

function stripMermaidComment(line: string): string {
  return line.replace(/%%.*$/, "");
}

function classifyMermaidArrow(arrow: string): {
  messageType: "SYNC" | "ASYNC" | "RETURN";
  isReturn: boolean;
} {
  const isDashed = arrow.startsWith("--");
  const tip = arrow.replace(/^-+/, "");
  const asyncTip = tip === ")" || tip === "x";
  const isReturn = isDashed && !asyncTip;
  if (asyncTip) return { messageType: "ASYNC", isReturn: false };
  if (isReturn) return { messageType: "RETURN", isReturn: true };
  return { messageType: "SYNC", isReturn: false };
}

// ---------------------------------------------------------------------------
// PlantUML parser
// ---------------------------------------------------------------------------

/**
 * PlantUML sequence grammar (subset we care about):
 *   A -> B : msg      sync
 *   A --> B : msg     dashed (typically a return)
 *   A ->> B : msg     async
 *   A -->> B : msg    dashed async
 *   A <- B : msg      right-to-left (swap sender/receiver)
 * Participant declarations:
 *   participant X
 *   participant "Long Name" as X
 *   actor / boundary / control / entity / database / collections / queue  X
 */
const PLANTUML_ARROW_RE =
  /^\s*("[^"]+"|[A-Za-z0-9_]+)\s*(<-{1,2}|-{1,2}>{1,2}|-{1,2}>>|<<-{1,2})\s*("[^"]+"|[A-Za-z0-9_]+)\s*:\s*(.+)$/;

const PLANTUML_PARTICIPANT_RE =
  /^\s*(?:participant|actor|boundary|control|entity|database|collections|queue)\s+(?:("[^"]+")\s+as\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+)(?:\s+as\s+(.+?))?)\s*$/i;

export function parsePlantUMLBlock(body: string): ParsedBlock {
  const lines = body.split(/\r?\n/);
  const participants = new Map<string, ExtractedSequenceParticipant>();
  const aliasToLabel = new Map<string, string>();
  const messages: ExtractedSequenceMessage[] = [];
  let name: string | undefined;
  let participantOrder = 0;
  let messageOrder = 0;

  const recordParticipant = (raw: string) => {
    const alias = stripQuotes(raw).trim();
    const label = aliasToLabel.get(alias) ?? alias;
    if (!alias) return alias;
    if (!participants.has(label)) {
      participants.set(label, { label, order: participantOrder++ });
    }
    return label;
  };

  for (const rawLine of lines) {
    const line = stripPlantumlComment(rawLine).trim();
    if (!line) continue;

    if (/^@(startuml|enduml)\b/i.test(line)) continue;

    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      name = titleMatch[1].replace(/\\n/g, " ").trim();
      continue;
    }

    // Skip non-message tokens
    if (
      /^(?:autonumber|activate|deactivate|alt|else|end|loop|par|group|opt|break|critical|note|skinparam|hide|box|ref)\b/i.test(
        line,
      )
    )
      continue;

    const pMatch = PLANTUML_PARTICIPANT_RE.exec(line);
    if (pMatch) {
      // Case 1: participant "Long Name" as Alias
      if (pMatch[1] && pMatch[2]) {
        const display = stripQuotes(pMatch[1]).trim();
        const alias = pMatch[2];
        aliasToLabel.set(alias, display);
        if (!participants.has(display)) {
          participants.set(display, {
            label: display,
            order: participantOrder++,
          });
        }
        continue;
      }
      // Case 2: participant Alias [as DisplayName]
      const alias = pMatch[3];
      const display = pMatch[4] ? stripQuotes(pMatch[4]).trim() : alias;
      if (alias) {
        aliasToLabel.set(alias, display);
        if (!participants.has(display)) {
          participants.set(display, {
            label: display,
            order: participantOrder++,
          });
        }
      }
      continue;
    }

    const aMatch = PLANTUML_ARROW_RE.exec(line);
    if (!aMatch) continue;

    let fromRaw = aMatch[1];
    const arrow = aMatch[2];
    let toRaw = aMatch[3];
    const label = aMatch[4].trim();

    // Reverse-direction arrows (<-): swap so "from" always sends
    if (arrow.startsWith("<")) {
      [fromRaw, toRaw] = [toRaw, fromRaw];
    }

    const from = recordParticipant(fromRaw);
    const to = recordParticipant(toRaw);
    if (!from || !to) continue;

    const classified = classifyPlantumlArrow(arrow);

    messages.push({
      from,
      to,
      label,
      order: messageOrder++,
      messageType: classified.messageType,
      isReturn: classified.isReturn,
      protocol: null,
      authentication: null,
      notes: null,
      sourceQuote: rawLine.trim(),
    });
  }

  return {
    name,
    participants: [...participants.values()].sort((a, b) => a.order - b.order),
    messages,
  };
}

function stripPlantumlComment(line: string): string {
  // PlantUML comments start with `'` at the beginning of a line.
  if (/^\s*'/.test(line)) return "";
  return line;
}

function classifyPlantumlArrow(arrow: string): {
  messageType: "SYNC" | "ASYNC" | "RETURN";
  isReturn: boolean;
} {
  const normalized = arrow.replace(/^</, "").replace(/>$/, "");
  const isDashed = normalized.startsWith("--");
  const isAsync = arrow.endsWith(">>") || arrow.startsWith("<<");
  if (isAsync) return { messageType: "ASYNC", isReturn: false };
  if (isDashed) return { messageType: "RETURN", isReturn: true };
  return { messageType: "SYNC", isReturn: false };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function stripQuotes(s: string): string {
  return s.replace(/^"(.*)"$/, "$1");
}
