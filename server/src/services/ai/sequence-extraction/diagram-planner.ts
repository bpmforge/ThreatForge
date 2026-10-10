/**
 * Cross-doc Diagram Planner with Challenge-Defend
 *
 * Before extraction fires, the LLM enumerates "the N sequence diagrams this
 * product should have" with verbatim doc citations. Each planned diagram
 * passes a Citation-Defend phase: citations that can't be substring-matched
 * against source docs are dropped; plans with zero surviving citations are
 * RETRACTED before extraction fires.
 *
 * Why: per-doc reactive extraction misses cross-doc relationships.
 * SAD describes the flow; SDS details the algorithm; SRS specifies the
 * requirement. A planner that sees all three catches what reading one misses.
 */

import logger from "../../../utils/logger.js";
import type { AIProviderClient } from "../../../types/ai.js";
import { normalizeForQuoteCheck } from "../../../utils/text-normalize.js";
import type { PlannedDiagram, PlannedDiagramCitation } from "./types.js";

// ---------------------------------------------------------------------------
// Universal system prompt (evidence discipline + don't-know
// permission + confidence calibration)
// ---------------------------------------------------------------------------

const PLAN_SYSTEM_PROMPT = `You are a security-focused software architect planning sequence diagrams for a threat model.

EVIDENCE DISCIPLINE: Every planned diagram must be backed by verbatim evidence from the provided documents.
DON'T-KNOW PERMISSION: If you cannot find evidence for a diagram in the documents, omit it entirely.
CONFIDENCE CALIBRATION: confidence >= 0.95 requires 2+ citations; 1.0 with zero citations is invalid.

Your task:
- Read all provided source documents.
- Identify every DISTINCT system workflow or data flow that would be represented as a sequence diagram.
- For each planned diagram, emit verbatim quotes (citations) from the documents that justify its existence.
- Focus on inter-component flows (API calls, message queue publishes, auth handshakes, data ingestion pipelines).
- Skip pure within-component processing (algorithms, calculations, data transformations with no external actor).

Return ONLY a JSON array, no prose, no code fences:
[
  {
    "name": "Short unique diagram name",
    "justification": "Why this flow matters for security threat modeling",
    "citations": [
      {
        "docName": "exact filename of source doc",
        "quote": "verbatim excerpt from the source document"
      }
    ],
    "confidence": 0.9
  }
]

RULES:
- citations[].quote must be a verbatim substring of the named document — no paraphrase.
- Confidence 0.95+ requires ≥2 citations. Confidence 1.0 with 0 citations → set confidence to 0.5 instead.
- Empty arrays beat manufactured citations. Fewer real diagrams beat many phantom diagrams.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SourceDoc {
  name: string;
  content: string;
}

export interface PlanDiagramsResult {
  planned: PlannedDiagram[];
  retained: PlannedDiagram[];
  retracted: PlannedDiagram[];
}

/**
 * Plan sequence diagrams across all provided source documents, then defend
 * each plan's citations against the source text.
 */
export async function planDiagrams(
  client: AIProviderClient,
  docs: SourceDoc[],
): Promise<PlanDiagramsResult> {
  if (docs.length === 0) {
    return { planned: [], retained: [], retracted: [] };
  }

  const userPrompt = buildUserPrompt(docs);

  let raw: string;
  try {
    const response = await client.complete({
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      maxTokens: 45000,
    });
    raw = response.content;
  } catch (err) {
    logger.warn({ err }, "diagram-planner LLM call failed");
    return { planned: [], retained: [], retracted: [] };
  }

  const parsed = parseLLMOutput(raw);
  if (!parsed || parsed.length === 0) {
    logger.warn("diagram-planner: LLM returned no plans or invalid JSON");
    return { planned: [], retained: [], retracted: [] };
  }

  const planned = coercePlans(parsed);
  const { retained, retracted } = defendPlans(planned, docs);

  logger.info(
    {
      total: planned.length,
      retained: retained.length,
      retracted: retracted.length,
    },
    "diagram-planner defend pass complete",
  );

  return { planned, retained, retracted };
}

// ---------------------------------------------------------------------------
// Defend pass
// ---------------------------------------------------------------------------

/**
 * For each plan: every citation must substring-match (normalized) the named
 * source document. Citations that fail are dropped. Plans with zero surviving
 * citations are RETRACTED.
 */
function defendPlans(
  plans: PlannedDiagram[],
  docs: SourceDoc[],
): { retained: PlannedDiagram[]; retracted: PlannedDiagram[] } {
  const docIndex = buildDocIndex(docs);
  const retained: PlannedDiagram[] = [];
  const retracted: PlannedDiagram[] = [];

  for (const plan of plans) {
    const surviving: PlannedDiagramCitation[] = [];
    const failed: PlannedDiagramCitation[] = [];

    for (const citation of plan.citations) {
      const docNorm = docIndex.get(citation.docName.toLowerCase());
      if (!docNorm) {
        // Named a doc that wasn't provided → fail
        failed.push(citation);
        continue;
      }
      const quoteNorm = normalizeForQuoteCheck(citation.quote);
      if (quoteNorm.length < 8) {
        // Too short to be meaningful
        failed.push(citation);
        continue;
      }
      // One-directional: LLM quote must be ⊂ source (not the reverse)
      if (docNorm.includes(quoteNorm)) {
        surviving.push(citation);
      } else {
        logger.debug(
          { planName: plan.name, quote: citation.quote.slice(0, 60) },
          "diagram-planner citation failed substring-match",
        );
        failed.push(citation);
      }
    }

    if (surviving.length > 0) {
      retained.push({
        ...plan,
        citations: surviving,
        failedCitations: failed.length > 0 ? failed : undefined,
        defenseStatus: "RETAINED",
      });
    } else {
      retracted.push({
        ...plan,
        citations: [],
        failedCitations: failed,
        defenseStatus: "RETRACTED",
      });
    }
  }

  return { retained, retracted };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserPrompt(docs: SourceDoc[]): string {
  const sections = docs.map((d) => `## Document: ${d.name}\n\n${d.content}`);
  return sections.join("\n\n---\n\n");
}

/**
 * Build a normalized lookup: lowercase doc name → normalized content.
 * The content is normalized so substring matching is markdown/smart-quote-tolerant.
 */
function buildDocIndex(docs: SourceDoc[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const doc of docs) {
    index.set(doc.name.toLowerCase(), normalizeForQuoteCheck(doc.content));
  }
  return index;
}

interface RawPlan {
  name?: unknown;
  justification?: unknown;
  citations?: unknown;
  confidence?: unknown;
}

function coercePlans(raw: RawPlan[]): PlannedDiagram[] {
  return raw
    .filter(
      (p) => typeof p.name === "string" && typeof p.justification === "string",
    )
    .map((p) => ({
      name: (p.name as string).trim().slice(0, 200),
      justification: (p.justification as string).trim(),
      citations: coerceCitations(p.citations),
      confidence:
        typeof p.confidence === "number"
          ? Math.min(1, Math.max(0, p.confidence))
          : 0.7,
    }));
}

function coerceCitations(raw: unknown): PlannedDiagramCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is { docName: unknown; quote: unknown } =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).docName === "string" &&
        typeof (c as Record<string, unknown>).quote === "string",
    )
    .map((c) => ({
      docName: (c.docName as string).trim(),
      quote: (c.quote as string).trim(),
    }))
    .filter((c) => c.quote.length >= 8);
}

function parseLLMOutput(raw: string): RawPlan[] | null {
  let content = raw.trim();
  // Strip thinking blocks (qwen, deepseek)
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip markdown code fences
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) content = fenceMatch[1].trim();
  // Find the array
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  content = content.slice(start, end + 1);
  // Tolerate trailing commas
  content = content.replace(/,\s*([}\]])/g, "$1");
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as RawPlan[]) : null;
  } catch {
    return null;
  }
}
