/**
 * Documents API — CRUD routes for imported documents
 *
 * All routes scoped to a threat model. Documents store extracted text content
 * and metadata from imported files (PDF, DOCX, Markdown, Terraform, etc.).
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  getAuthUser,
  canAccessThreatModel,
  authorizeModelAction,
} from "../helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
} from "../../../utils/api-response.js";
import { upsertDocumentVersion } from "../../../services/documents/versioning.js";
import { embedDocumentSections } from "../../../services/citation/embedding-service.js";
import { parseDeterministicSequences } from "../../../services/ai/sequence-extraction/deterministic-parser.js";
import { detectProseSequences } from "../../../services/ai/sequence-extraction/prose-detector.js";
import { extractProseSequence } from "../../../services/ai/sequence-extraction/prose-extractor.js";
import { persistExtractedSequences } from "../../../services/ai/sequence-extraction/persist.js";
import { createAIClient } from "../../../services/ai/client-factory.js";
import type { ExtractedSequenceDiagram } from "../../../services/ai/sequence-extraction/types.js";
import type { AISettings } from "../../../types/settings.js";
import logger from "../../../utils/logger.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

interface CreateDocumentBody {
  name: string;
  type: string;
  content: string;
  sizeBytes?: number;
  pageCount?: number;
  contentTruncated?: boolean;
  extractionSummary?: string;
  extractedComponentCount?: number;
  extractedRequirementCount?: number;
}

export const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = await getPrisma();

  /**
   * GET /api/threat-models/:modelId/documents
   * List all documents for a threat model (metadata only, no content).
   */
  fastify.get<{
    Params: { modelId: string };
    Querystring: { includeHistory?: string };
  }>(
    "/api/threat-models/:modelId/documents",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, modelId);
      if (!hasAccess) return sendNotFound(reply, "Threat model");

      const includeHistory = request.query.includeHistory === "true";
      const documents = await prisma.document.findMany({
        where: {
          threatModelId: modelId,
          ...(includeHistory ? {} : { supersededAt: null }),
        },
        select: {
          id: true,
          name: true,
          type: true,
          sizeBytes: true,
          pageCount: true,
          contentTruncated: true,
          extractedAt: true,
          extractionSummary: true,
          extractedComponentCount: true,
          extractedRequirementCount: true,
          documentFamilyId: true,
          version: true,
          supersededAt: true,
          contentHash: true,
          importedById: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { requirements: true } },
        },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
      });

      return sendSuccess(reply, { documents });
    },
  );

  /**
   * GET /api/threat-models/:modelId/documents/:docId
   * Get a single document with full content.
   */
  fastify.get<{
    Params: { modelId: string; docId: string };
  }>(
    "/api/threat-models/:modelId/documents/:docId",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, docId } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, modelId);
      if (!hasAccess) return sendNotFound(reply, "Threat model");

      const document = await prisma.document.findFirst({
        where: { id: docId, threatModelId: modelId },
        include: {
          requirements: {
            select: {
              id: true,
              reqId: true,
              text: true,
              category: true,
              _count: { select: { mitigations: true } },
            },
            orderBy: { reqId: "asc" },
          },
        },
      });

      if (!document) return sendNotFound(reply, "Document");
      return sendSuccess(reply, { document });
    },
  );

  /**
   * POST /api/threat-models/:modelId/documents
   * Create a new document record with extracted text content.
   */
  fastify.post<{
    Params: { modelId: string };
    Body: CreateDocumentBody;
  }>(
    "/api/threat-models/:modelId/documents",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;
      const body = request.body;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      if (!body.name || !body.content) {
        return sendBadRequest(reply, "Name and content are required");
      }

      const MAX_CONTENT_LENGTH = 500_000;
      const contentTruncated =
        body.contentTruncated || body.content.length > MAX_CONTENT_LENGTH;
      const content = body.content.slice(0, MAX_CONTENT_LENGTH);

      const VALID_DOC_TYPES = new Set([
        "PDF",
        "DOCX",
        "MARKDOWN",
        "TERRAFORM",
        "DOCKER_COMPOSE",
        "OPENAPI",
        "YAML",
        "TEXT",
        "SOURCE_CODE",
      ]);
      const docType = VALID_DOC_TYPES.has(body.type)
        ? (body.type as import("@prisma/client").DocumentType)
        : "TEXT";

      const result = await upsertDocumentVersion(prisma, {
        name: body.name,
        type: docType,
        content,
        contentTruncated,
        sizeBytes: body.sizeBytes ?? content.length,
        pageCount: body.pageCount,
        extractionSummary: body.extractionSummary,
        extractedComponentCount: body.extractedComponentCount ?? 0,
        extractedRequirementCount: body.extractedRequirementCount ?? 0,
        threatModelId: modelId,
        importedById: user.id,
      });

      // Sequence-diagram extraction (deterministic pass plus prose pass).
      // Runs only on new content (created / superseded); "unchanged" means the
      // doc hash matched the current version so sequences are already present.
      // Failures never block the upload — sequence extraction is best-effort.
      let extractedSequences: Awaited<
        ReturnType<typeof persistExtractedSequences>
      > = [];
      const sequenceExtractionEnabled =
        process.env.SEQUENCE_EXTRACTION_ENABLED !== "false";
      const proseExtractionEnabled =
        process.env.PROSE_SEQUENCE_EXTRACTION_ENABLED !== "false";

      if (sequenceExtractionEnabled && result.outcome !== "unchanged") {
        try {
          const diagrams: ExtractedSequenceDiagram[] = [];

          // Pass 1: deterministic Mermaid/PlantUML — cheap, no LLM.
          diagrams.push(...parseDeterministicSequences(content));

          // Pass 2: prose-sequence detection + LLM extraction. Only fires
          // when an AI client is available; demo SAD §3.2 is the canonical
          // case — numbered prose workflow with no fenced diagrams.
          if (proseExtractionEnabled) {
            const proseSections = detectProseSequences(content);
            if (proseSections.length > 0) {
              const aiClient = await getAIClientForModel(prisma, modelId);
              if (aiClient) {
                for (const section of proseSections) {
                  const extracted = await extractProseSequence(
                    aiClient,
                    section,
                  );
                  if (extracted) diagrams.push(extracted);
                }
              } else {
                logger.debug(
                  { threatModelId: modelId },
                  "Prose-sequence sections detected but no AI client configured — skipping",
                );
              }
            }
          }

          if (diagrams.length > 0) {
            extractedSequences = await persistExtractedSequences(
              prisma,
              diagrams,
              { threatModelId: modelId, userId: user.id },
            );
            logger.info(
              {
                threatModelId: modelId,
                documentId: result.document.id,
                detected: diagrams.length,
                persisted: extractedSequences.length,
                linkedParticipants: extractedSequences.reduce(
                  (n, s) => n + s.linkedParticipantCount,
                  0,
                ),
                byFormat: countByFormat(diagrams),
              },
              "Sequence extraction applied",
            );
          }
        } catch (err) {
          logger.warn(
            { err, documentId: result.document.id },
            "Sequence extraction failed — continuing without",
          );
        }
      }

      // Fire-and-forget section embedding — never blocks the upload response.
      // Runs only when the document content changed; unchanged docs already
      // have embeddings from the previous import.
      if (result.outcome !== "unchanged") {
        embedDocumentSections(prisma, result.document.id).catch((err) => {
          logger.warn(
            { err, documentId: result.document.id },
            "embedding generation failed",
          );
        });
      }

      // If the document extracted security requirements, flag mitigations as stale.
      // This tells the AI tab to offer a REFRESH_MITIGATIONS job.
      const requirementCount = body.extractedRequirementCount ?? 0;
      if (requirementCount > 0 && result.outcome !== "unchanged") {
        prisma.threatModel
          .update({
            where: { id: modelId },
            data: { mitigationsStaleAt: new Date() },
          })
          .catch((err) =>
            logger.warn({ err, modelId }, "Failed to set mitigationsStaleAt"),
          );
      }

      return sendCreated(reply, {
        document: result.document,
        outcome: result.outcome,
        version: result.version,
        extractedSequences,
        mitigationsStale:
          requirementCount > 0 && result.outcome !== "unchanged",
      });
    },
  );

  /**
   * DELETE /api/threat-models/:modelId/documents/:docId
   * Delete a document (requirements that reference it keep docId as text).
   */
  fastify.delete<{
    Params: { modelId: string; docId: string };
  }>(
    "/api/threat-models/:modelId/documents/:docId",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, docId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const existing = await prisma.document.findFirst({
        where: { id: docId, threatModelId: modelId },
      });
      if (!existing) return sendNotFound(reply, "Document");

      await prisma.document.delete({ where: { id: docId } });
      return sendNoContent(reply);
    },
  );

  /**
   * GET /api/threat-models/:modelId/documents/gaps
   * Gap analysis: requirements from documents that have no mitigations.
   */
  fastify.get<{
    Params: { modelId: string };
  }>(
    "/api/threat-models/:modelId/documents/gaps",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, modelId);
      if (!hasAccess) return sendNotFound(reply, "Threat model");

      const requirements = await prisma.requirement.findMany({
        where: {
          threatModelId: modelId,
          source: "DOCUMENT",
          supersededAt: null,
        },
        include: {
          _count: { select: { mitigations: true } },
          document: { select: { id: true, name: true, type: true } },
        },
        orderBy: [{ documentId: "asc" }, { reqId: "asc" }],
      });

      const uncovered = requirements.filter((r) => r._count.mitigations === 0);
      const covered = requirements.filter((r) => r._count.mitigations > 0);

      const byDocument = new Map<
        string,
        {
          documentId: string;
          documentName: string;
          documentType: string;
          requirements: typeof uncovered;
        }
      >();

      for (const req of uncovered) {
        const docName = req.document?.name ?? req.docId ?? "Unknown";
        const docId = req.documentId ?? req.docId ?? "unknown";
        if (!byDocument.has(docId)) {
          byDocument.set(docId, {
            documentId: docId,
            documentName: docName,
            documentType: req.document?.type ?? "TEXT",
            requirements: [],
          });
        }
        byDocument.get(docId)!.requirements.push(req);
      }

      return sendSuccess(reply, {
        summary: {
          totalRequirements: requirements.length,
          covered: covered.length,
          uncovered: uncovered.length,
          coveragePct:
            requirements.length > 0
              ? Math.round((covered.length / requirements.length) * 100)
              : 100,
          documentCount: new Set(
            requirements.map((r) => r.documentId ?? r.docId),
          ).size,
        },
        gaps: Array.from(byDocument.values()),
      });
    },
  );
};

/**
 * Resolve an AIProviderClient for the threat model's parent organization.
 * Returns null when no AI provider is configured — prose extraction is
 * best-effort and silently no-ops when AI is unavailable.
 */
async function getAIClientForModel(
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  modelId: string,
) {
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: {
        include: {
          organization: { select: { aiSettings: true } },
        },
      },
    },
  });
  if (!model?.project?.organization?.aiSettings) return null;

  let settings: AISettings;
  try {
    settings = JSON.parse(model.project.organization.aiSettings) as AISettings;
  } catch {
    return null;
  }
  if (!settings.enabled) return null;
  return createAIClient(settings, model.project.organizationId);
}

function countByFormat(
  diagrams: ExtractedSequenceDiagram[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of diagrams) {
    out[d.format] = (out[d.format] ?? 0) + 1;
  }
  return out;
}
