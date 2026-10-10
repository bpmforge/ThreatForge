/**
 * Preview verifier — runs the citation cross-check WITHOUT persisting any
 * Citation rows. Used by the suggest-threats path where suggestions are
 * returned to the frontend before the user accepts them (and thus before a
 * Threat row exists to attach a Citation to).
 *
 * When a suggestion is later accepted and persisted as a Threat, the
 * regular verifyClaims() runs and writes the Citation rows for real.
 */
import type { PrismaClient } from "@prisma/client";
import type { VerificationStatus } from "@prisma/client";
import type { AIProviderClient } from "../../types/ai.js";
import type { ParsedClaim, ParsedCitation } from "./citation-grammar.js";
import { detectSections } from "./document-section-detector.js";
import { checkReference } from "./reference-resolver.js";
import {
  buildCrossCheckPrompt,
  parseCrossCheckResult,
} from "./prompts/cross-check.js";
import logger from "../../utils/logger.js";

interface PreviewedCitation {
  type: "DOCUMENT" | "REFERENCE" | "COMPONENT" | "REQUIREMENT" | "NONE";
  documentName?: string;
  sectionAnchor?: string;
  pageNumber?: number;
  referenceKind?: string;
  referenceId?: string;
  componentNodeId?: string;
  requirementId?: string;
  status: VerificationStatus;
  confidence?: number;
  rationale: string;
}

export interface PreviewResult {
  /** Worst-case rollup across this claim's citations. */
  status: VerificationStatus;
  citations: PreviewedCitation[];
}

interface DocLite {
  id: string;
  name: string;
  content: string;
}

const DEFAULT_THRESHOLD = 0.7;

export async function previewVerifyClaims(
  prisma: PrismaClient,
  aiClient: AIProviderClient,
  threatModelId: string,
  claims: ParsedClaim[],
  opts: { confidenceThreshold?: number } = {},
): Promise<PreviewResult[]> {
  const threshold = opts.confidenceThreshold ?? DEFAULT_THRESHOLD;
  const docs = await loadDocs(prisma, threatModelId);
  // Build section index per doc once for the whole batch.
  const sectionIndex = new Map(
    docs.map((d) => [d.id, detectSections(d.content)]),
  );

  // Load canvas components for COMPONENT-citation resolution. Accept
  // either React Flow nodeId or the Prisma DB id — the LLM's prompt
  // currently shows DB ids (buildThreatAnalysisPrompt passes c.id),
  // while the canvas layer uses nodeIds. A citation of either form is
  // a valid grounding against the same component row.
  const components = await prisma.component.findMany({
    where: { threatModelId },
    select: { id: true, nodeId: true },
  });
  const knownNodes = new Set<string>();
  for (const c of components) {
    if (c.id) knownNodes.add(c.id);
    if (c.nodeId) knownNodes.add(c.nodeId);
  }

  // Load requirements for REQUIREMENT-citation resolution. Cheap, no LLM.
  const requirements = await prisma.requirement.findMany({
    where: { threatModelId, supersededAt: null },
    select: { reqId: true },
  });
  const knownReqIds = new Set(requirements.map((r) => r.reqId));

  const results: PreviewResult[] = [];
  for (const claim of claims) {
    results.push(
      await previewOne(
        aiClient,
        claim,
        docs,
        sectionIndex,
        knownNodes,
        knownReqIds,
        threshold,
      ),
    );
  }
  return results;
}

async function previewOne(
  aiClient: AIProviderClient,
  parsed: ParsedClaim,
  docs: DocLite[],
  sectionIndex: Map<string, ReturnType<typeof detectSections>>,
  knownNodes: Set<string>,
  knownReqIds: Set<string>,
  threshold: number,
): Promise<PreviewResult> {
  if (parsed.kind === "NOT_FOUND") {
    return {
      status: "EXEMPT",
      citations: [
        {
          type: "NONE",
          status: "EXEMPT",
          rationale: "LLM flagged as not found in source",
        },
      ],
    };
  }

  if (parsed.kind === "NONE" || parsed.citations.length === 0) {
    return {
      status: "UNVERIFIED",
      citations: [
        {
          type: "NONE",
          status: "UNVERIFIED",
          rationale: "no citation provided",
        },
      ],
    };
  }

  const previewed: PreviewedCitation[] = [];
  let worst: VerificationStatus = "VERIFIED";

  for (const citation of parsed.citations) {
    const result = await previewOneCitation(
      aiClient,
      parsed.claim,
      citation,
      docs,
      sectionIndex,
      knownNodes,
      knownReqIds,
      threshold,
    );
    previewed.push(result);
    worst = degrade(worst, result.status);
  }

  return { status: worst, citations: previewed };
}

async function previewOneCitation(
  aiClient: AIProviderClient,
  claimText: string,
  citation: ParsedCitation,
  docs: DocLite[],
  sectionIndex: Map<string, ReturnType<typeof detectSections>>,
  knownNodes: Set<string>,
  knownReqIds: Set<string>,
  threshold: number,
): Promise<PreviewedCitation> {
  if (citation.type === "DOCUMENT") {
    return previewDocument(
      aiClient,
      claimText,
      citation,
      docs,
      sectionIndex,
      threshold,
    );
  }
  if (citation.type === "REFERENCE") {
    const check = checkReference(citation.referenceKind, citation.referenceId);
    return {
      type: "REFERENCE",
      referenceKind: citation.referenceKind,
      referenceId: citation.referenceId,
      status: check.resolved ? "VERIFIED" : "PHANTOM",
      confidence: check.inCuratedSet ? 1.0 : check.resolved ? 0.6 : 0,
      rationale: check.rationale,
    };
  }

  if (citation.type === "REQUIREMENT") {
    if (!citation.requirementId) {
      return {
        type: "REQUIREMENT",
        status: "PHANTOM",
        rationale: "no requirement id supplied",
      };
    }
    const exists = knownReqIds.has(citation.requirementId);
    return {
      type: "REQUIREMENT",
      requirementId: citation.requirementId,
      status: exists ? "VERIFIED" : "PHANTOM",
      confidence: exists ? 1.0 : 0,
      rationale: exists
        ? `requirement ${citation.requirementId} resolved in this threat model`
        : `requirement "${citation.requirementId}" not found in this threat model`,
    };
  }

  // COMPONENT — resolve nodeId against current canvas
  if (!citation.componentNodeId) {
    return {
      type: "COMPONENT",
      status: "PHANTOM",
      rationale: "no component id supplied",
    };
  }
  const exists = knownNodes.has(citation.componentNodeId);
  return {
    type: "COMPONENT",
    componentNodeId: citation.componentNodeId,
    status: exists ? "VERIFIED" : "PHANTOM",
    confidence: exists ? 1.0 : 0,
    rationale: exists
      ? "component nodeId resolved on current canvas"
      : `component nodeId "${citation.componentNodeId}" not found on canvas`,
  };
}

async function previewDocument(
  aiClient: AIProviderClient,
  claimText: string,
  citation: ParsedCitation,
  docs: DocLite[],
  sectionIndex: Map<string, ReturnType<typeof detectSections>>,
  threshold: number,
): Promise<PreviewedCitation> {
  const doc = matchDoc(docs, citation.documentName);
  if (!doc) {
    return {
      type: "DOCUMENT",
      documentName: citation.documentName,
      status: "PHANTOM",
      rationale: `document "${citation.documentName}" not found in this threat model`,
    };
  }

  const sections = sectionIndex.get(doc.id) ?? [];
  let sourceText = doc.content;
  let sourceLabel = doc.name;

  if (citation.sectionAnchor) {
    const section = sections.find((s) => s.anchor === citation.sectionAnchor);
    if (!section) {
      return {
        type: "DOCUMENT",
        documentName: doc.name,
        sectionAnchor: citation.sectionAnchor,
        status: "PHANTOM",
        rationale: `section "${citation.sectionAnchor}" not found in ${doc.name}`,
      };
    }
    sourceText = doc.content.slice(section.startOffset, section.endOffset);
    sourceLabel = `${doc.name} §${section.anchor}`;
  } else if (citation.pageNumber !== undefined) {
    sourceLabel = `${doc.name} p.${citation.pageNumber}`;
  }

  let result;
  try {
    const response = await aiClient.complete({
      messages: [
        {
          role: "user",
          content: buildCrossCheckPrompt({
            sourceLabel,
            sourceText,
            claim: claimText,
          }),
        },
      ],
      temperature: 0,
    });
    result = parseCrossCheckResult(response.content, sourceText);
  } catch (err) {
    logger.warn(
      { err, sourceLabel },
      "preview cross-check provider error — marking unverified",
    );
    result = {
      supports: false,
      confidence: 0,
      rationale: "verifier provider error",
      quote: "",
    };
  }

  const status: VerificationStatus =
    result.supports && result.confidence >= threshold
      ? "VERIFIED"
      : "UNVERIFIED";

  return {
    type: "DOCUMENT",
    documentName: doc.name,
    sectionAnchor: citation.sectionAnchor,
    pageNumber: citation.pageNumber,
    status,
    confidence: result.confidence,
    rationale: result.rationale,
  };
}

async function loadDocs(
  prisma: PrismaClient,
  threatModelId: string,
): Promise<DocLite[]> {
  return prisma.document.findMany({
    where: { threatModelId },
    select: { id: true, name: true, content: true },
  });
}

function matchDoc(docs: DocLite[], name?: string): DocLite | undefined {
  if (!name) return undefined;
  const target = name.toLowerCase();
  return (
    docs.find((d) => d.name.toLowerCase() === target) ??
    docs.find((d) => d.name.toLowerCase().endsWith(target))
  );
}

function degrade(
  current: VerificationStatus,
  next: VerificationStatus,
): VerificationStatus {
  const rank: Record<VerificationStatus, number> = {
    PHANTOM: 4,
    UNVERIFIED: 3,
    PENDING: 2,
    EXEMPT: 1,
    VERIFIED: 0,
  };
  return rank[next] > rank[current] ? next : current;
}
