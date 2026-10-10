/**
 * Prose-sequence LLM extractor.
 *
 * Takes a `DetectedProseSequence` (heading + numbered steps), asks the LLM
 * to identify the actor/component for each step and structure the result
 * into a SequenceDiagram. Every emitted message MUST carry a `sourceQuote`
 * that is verbatim one of the input step lines — the validator drops
 * fabricated/paraphrased messages.
 *
 * Why an LLM here rather than deterministic extraction alone:
 *   - Real demo SAD §3.2 is prose ("Sensor device transmits payload"),
 *     not Mermaid arrows. Pattern-based actor extraction is too fragile —
 *     passive voice ("Payload placed on raw-telemetry topic") needs context
 *     to resolve who placed it.
 *   - The LLM sees only the workflow section, not the whole document, so
 *     prompt cost is bounded.
 *   - Verbatim-quote validation gives the same trust guarantee as deterministic extraction.
 */

import logger from "../../../utils/logger.js";
import type { AIProviderClient } from "../../../types/ai.js";
import { normalizeForQuoteCheck } from "../../../utils/text-normalize.js";
import type { DetectedProseSequence } from "./prose-detector.js";
import type {
  ExtractedSequenceDiagram,
  ExtractedSequenceMessage,
  ExtractedSequenceParticipant,
} from "./types.js";

const SYSTEM_PROMPT = `You convert a numbered prose workflow into a structured sequence diagram for security threat modeling.

Rules:
- Identify the actor/component for each step. The actor is usually the subject of the sentence ("Sensor device transmits payload" → actor: "Sensor device").
- For passive-voice steps ("Payload placed on raw-telemetry topic"), infer the actor from preceding context.
- The "to" of one message is often the actor of the next step (data flowing through a chain).
- Skip steps that describe pure within-component processing (e.g. "Compute the average") rather than inter-component messages.
- A SequenceMessage MUST have a clear from-component and to-component. If you cannot identify both, omit the step rather than invent a target.
- "sourceQuote" on every message MUST be the verbatim numbered line from the input — copy it character-for-character including the leading number. Fabricated quotes will be dropped automatically.

Return ONLY a JSON object, no prose, no code fences:
{
  "name": "Diagram title (concise — base on the heading)",
  "participants": [
    {"label": "Component A", "order": 0},
    {"label": "Component B", "order": 1}
  ],
  "messages": [
    {
      "from": "Component A",
      "to": "Component B",
      "label": "Action description",
      "order": 0,
      "messageType": "SYNC",
      "isReturn": false,
      "sourceQuote": "1. The verbatim numbered line from the input"
    }
  ]
}

messageType: SYNC for normal request, ASYNC for fire-and-forget (publishing to a topic, sending event), RETURN for replies.
isReturn: true only when the message is explicitly a response to a prior message in the same flow.
Use exact participant labels in message from/to fields.`;

interface ParsedProseLLMOutput {
  name?: string;
  participants?: Array<{ label?: string; order?: number }>;
  messages?: Array<{
    from?: string;
    to?: string;
    label?: string;
    order?: number;
    messageType?: string;
    isReturn?: boolean;
    sourceQuote?: string;
  }>;
}

/**
 * Extract a structured sequence diagram from a detected prose section.
 * Returns null when the LLM failed (network error, malformed JSON) or
 * when the output had no validatable messages — callers can fall through
 * to the next detected section without inflating the canvas with garbage.
 */
export async function extractProseSequence(
  client: AIProviderClient,
  section: DetectedProseSequence,
): Promise<ExtractedSequenceDiagram | null> {
  const stepBlock = section.steps.map((s) => s.sourceQuote).join("\n");

  const userPrompt = `## Section: ${section.heading}\n\n## Steps\n${stepBlock}`;

  let raw: string;
  try {
    const response = await client.complete({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      // 45000 is the project-wide default for local-LLM calls (cost is
      // not a concern for local providers; thinking models burn 2-5k
      // tokens reasoning before emitting JSON).
      maxTokens: 45000,
    });
    raw = response.content;
  } catch (err) {
    logger.warn(
      { err, heading: section.heading },
      "prose-sequence LLM call failed",
    );
    return null;
  }

  const parsed = parseLLMOutput(raw);
  if (!parsed) return null;

  // Validate every emitted message's sourceQuote against the original step
  // lines. The substring match uses the same normalization as the rest of
  // the verifier system (markdown / smart-quote / soft-hyphen tolerant).
  //
  // One-directional only: the LLM's quote must be a substring of a real
  // step line. We do NOT accept "step is a substring of the quote" — that
  // would let the LLM prepend truth to fabrication and pass validation
  // (e.g. step "Payload placed on topic." + LLM-emitted "Payload placed on
  // topic. Attacker then receives the payload." would otherwise slip
  // through with an "approved" quote).
  const stepNorms = section.steps.map((s) =>
    normalizeForQuoteCheck(s.sourceQuote),
  );
  const stepIndex = (q: string): number => {
    const n = normalizeForQuoteCheck(q);
    if (n.length < 8) return -1;
    return stepNorms.findIndex((sn) => sn.includes(n));
  };

  const validatedMessages: ExtractedSequenceMessage[] = [];
  let nextOrder = 0;
  for (const m of parsed.messages ?? []) {
    if (
      typeof m.from !== "string" ||
      typeof m.to !== "string" ||
      typeof m.label !== "string" ||
      typeof m.sourceQuote !== "string"
    ) {
      continue;
    }
    const idx = stepIndex(m.sourceQuote);
    if (idx === -1) {
      logger.debug(
        { heading: section.heading, sourceQuote: m.sourceQuote.slice(0, 80) },
        "prose-sequence message dropped — sourceQuote not in input steps",
      );
      continue;
    }

    validatedMessages.push({
      from: m.from.trim(),
      to: m.to.trim(),
      label: m.label.trim(),
      order: typeof m.order === "number" ? m.order : nextOrder++,
      messageType: normalizeMessageType(m.messageType),
      isReturn: Boolean(m.isReturn),
      protocol: null,
      authentication: null,
      notes: null,
      sourceQuote: section.steps[idx].sourceQuote,
    });
  }

  if (validatedMessages.length === 0) return null;

  // Participants — prefer LLM-emitted, but ensure every from/to in the
  // validated messages is represented (the LLM sometimes forgets one).
  const participants = mergeParticipants(
    parsed.participants ?? [],
    validatedMessages,
  );

  return {
    name: (parsed.name?.trim() || section.heading).slice(0, 200),
    description: section.heading,
    format: "prose",
    participants,
    messages: validatedMessages,
    sourceQuote: section.sourceQuote,
  };
}

function normalizeMessageType(
  raw: unknown,
): ExtractedSequenceMessage["messageType"] {
  if (typeof raw !== "string") return "SYNC";
  const upper = raw.toUpperCase();
  if (upper === "ASYNC") return "ASYNC";
  if (upper === "RETURN") return "RETURN";
  return "SYNC";
}

function mergeParticipants(
  llmParticipants: ParsedProseLLMOutput["participants"],
  messages: ExtractedSequenceMessage[],
): ExtractedSequenceParticipant[] {
  const out: ExtractedSequenceParticipant[] = [];
  const seen = new Set<string>();
  let order = 0;

  for (const p of llmParticipants ?? []) {
    const label = typeof p.label === "string" ? p.label.trim() : "";
    if (!label || seen.has(label)) continue;
    out.push({ label, order: order++ });
    seen.add(label);
  }

  // Backfill from messages so we never reference a participant that doesn't
  // exist in the participants array.
  for (const m of messages) {
    for (const ref of [m.from, m.to]) {
      if (!ref || seen.has(ref)) continue;
      out.push({ label: ref, order: order++ });
      seen.add(ref);
    }
  }

  return out;
}

function parseLLMOutput(raw: string): ParsedProseLLMOutput | null {
  let content = raw.trim();
  // Strip thinking blocks (qwen, deepseek)
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip markdown code fences if present
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) content = fenceMatch[1].trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  content = content.slice(start, end + 1);
  // Tolerate trailing commas
  content = content.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(content) as ParsedProseLLMOutput;
  } catch {
    return null;
  }
}
