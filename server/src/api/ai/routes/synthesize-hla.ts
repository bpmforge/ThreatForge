/**
 * POST /api/threat-models/:modelId/ai/synthesize-hla
 *
 * HLA Synthesis with Defended Cross-Doc Reconciliation.
 *
 * Loads all current documents for the threat model, runs per-doc extraction
 * (or uses the existing multi-doc extract endpoint's output if provided),
 * then passes through the HLA synthesizer which adds:
 *   - Cross-doc reconciliation defense (fuzzy-merged components verified)
 *   - Top-N component Challenge-Defend (unverifiable → INFERRED, not dropped)
 *   - verificationStatus / sourceQuote propagation for canvas badges
 *
 * Returns the defended HLA blob ready for canvas-build (generateModel).
 */
import { loadSynthesisInputs } from "./synthesize.js";
import type { FastifyPluginAsync } from "fastify";
import { runExtractionAgent } from "../../../services/ai/extraction-agent.js";
import { synthesizeHLA } from "../../../services/ai/hla-synthesizer.js";
import { sendSuccess, sendBadRequest } from "../helpers.js";
import { aiGuarded } from "../guards.js";

const MODEL_EDIT = aiGuarded({ model: "edit" });

export const synthesizeHLARoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai/synthesize-hla",
    MODEL_EDIT,
    async (request, reply) => {
      const inputs = await loadSynthesisInputs(
        request,
        reply,
        "synthesizing HLA",
      );
      if (!inputs) return reply;
      const { documents, client } = inputs;

      // Per-doc extraction (best-effort — failures don't block)
      const extractions: Array<{
        extraction: Awaited<ReturnType<typeof runExtractionAgent>>;
        documentName: string;
      }> = [];

      for (const doc of documents) {
        try {
          const extraction = await runExtractionAgent(client, doc.content, {
            documentType: mapDocType(doc.type),
          });
          extractions.push({ extraction, documentName: doc.name });
        } catch (err) {
          request.log.warn(
            { err, docId: doc.id, docName: doc.name },
            "synthesize-hla: per-doc extraction failed, skipping",
          );
        }
      }

      if (extractions.length === 0) {
        return sendBadRequest(
          reply,
          "Extraction failed for all documents. Check AI configuration.",
        );
      }

      // HLA synthesis with defense
      const sourceDocs = documents.map((d) => ({
        name: d.name,
        content: d.content,
      }));

      const result = synthesizeHLA(extractions, sourceDocs);

      return sendSuccess(reply, {
        documentsUsed: documents.map((d) => ({ id: d.id, name: d.name })),
        merged: result.merged,
        reconciliations: result.reconciliations,
        defendedComponents: result.defendedComponents,
        retractedComponents: result.retractedComponents,
        stats: result.stats,
      });
    },
  );
};

function mapDocType(type: string): string {
  const map: Record<string, string> = {
    PDF: "auto",
    DOCX: "auto",
    MARKDOWN: "architecture",
    OPENAPI: "openapi",
    TERRAFORM: "terraform",
    DOCKER_COMPOSE: "auto",
    YAML: "auto",
    TEXT: "auto",
    SOURCE_CODE: "auto",
  };
  return map[type] ?? "auto";
}
