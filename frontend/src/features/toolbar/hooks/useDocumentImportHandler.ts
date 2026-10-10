"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useCanvasStore,
  type CanvasNode,
  type CanvasEdge,
} from "@/stores/canvas";
import {
  type ImportedDocument,
  extractArchitecture,
  generateModel,
  buildMergePlan,
  applyMergePlan,
  canvasHasComponents,
  summarizeExistingComponents,
  type GeneratedNode,
  type GeneratedEdge,
} from "@/features/document-import";
import { createVersion } from "@/features/version-history/services/api";
import { requirementsApi } from "@/features/requirements";
import { createDocument } from "@/features/documents/services/api";

const FORMAT_TO_TYPE: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  md: "MARKDOWN",
  markdown: "MARKDOWN",
  tf: "TERRAFORM",
  terraform: "TERRAFORM",
  "docker-compose": "DOCKER_COMPOSE",
  yaml: "YAML",
  yml: "YAML",
  txt: "TEXT",
  html: "TEXT",
};

export function useDocumentImportHandler(currentModelId: string | null) {
  const addNodes = useCanvasStore((s) => s.addNodes);
  const addEdges = useCanvasStore((s) => s.addEdges);
  const setExtractedRequirements = useCanvasStore(
    (s) => s.setExtractedRequirements,
  );

  const [showMergeReview, setShowMergeReview] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<{
    plan: ReturnType<typeof buildMergePlan>;
    extraction: Parameters<typeof generateModel>[0];
  } | null>(null);

  function persistRequirements(
    requirements: NonNullable<
      Parameters<typeof generateModel>[0]["requirements"]
    >,
  ) {
    setExtractedRequirements(requirements);
    if (currentModelId) {
      requirementsApi
        .bulkCreate(currentModelId, {
          requirements: requirements.map((r) => ({
            reqId: r.reqId,
            text: r.text,
            category: r.category,
            docId: r.docId,
          })),
          source: "DOCUMENT",
        })
        .catch(() => {});
    }
  }

  function applyModel(extraction: Parameters<typeof generateModel>[0]) {
    const model = generateModel(extraction, {
      type: "hierarchical",
      spacing: { x: 250, y: 150 },
    });
    addNodes(model.nodes as unknown as CanvasNode[]);
    addEdges(model.edges as unknown as CanvasEdge[]);
    return model;
  }

  const handleDocumentImported = (doc: ImportedDocument) => {
    const text = doc.extractedText || doc.rawContent || "";

    if (currentModelId && text.trim()) {
      createDocument(currentModelId, {
        name: doc.metadata.title || doc.filename || "Untitled Document",
        type: FORMAT_TO_TYPE[doc.format || "txt"] || "TEXT",
        content: text,
        sizeBytes: text.length,
        pageCount: doc.metadata.pageCount,
      }).catch(() => {});
    }

    if (!text.trim()) {
      toast.success(`Imported: ${doc.metadata.title || "Document"}`);
      return;
    }

    toast.info(
      "Extracting architecture from document — this may take a minute...",
      { duration: 10000 },
    );

    const existingNodes = useCanvasStore.getState()
      .nodes as unknown as GeneratedNode[];
    const existingEdges = useCanvasStore.getState()
      .edges as unknown as GeneratedEdge[];
    const hasExisting = canvasHasComponents({
      nodes: existingNodes,
      edges: existingEdges,
    });

    if (hasExisting && currentModelId) {
      const docTitle = doc.metadata.title || "document";
      createVersion(currentModelId, {
        name: `Pre-import: ${docTitle}`,
        changesSummary: `Auto-saved before importing ${docTitle}`,
      }).catch(() => {});
    }

    extractArchitecture(text, {
      documentType: "auto",
      existingComponentsSummary: hasExisting
        ? summarizeExistingComponents(existingNodes)
        : undefined,
    })
      .then((result) => {
        const { components, dataFlows } = result.extraction;
        if (components.length === 0) {
          toast.warning("No components found in document");
          return;
        }

        if (hasExisting) {
          const plan = buildMergePlan(result.extraction, {
            nodes: existingNodes,
            edges: existingEdges,
          });
          if (plan.stats.updatedComponents > 0 || plan.stats.skippedFlows > 0) {
            setPendingMerge({ plan, extraction: result.extraction });
            setShowMergeReview(true);
            toast.info(
              `Found ${plan.stats.updatedComponents} existing components. Review merge before adding.`,
            );
            return;
          }
        }

        if (result.extraction.requirements?.length) {
          persistRequirements(result.extraction.requirements);
        }

        try {
          const model = applyModel(result.extraction);
          toast.success(
            `Added ${components.length} components and ${dataFlows.length} connections`,
          );
          void model;
        } catch (e) {
          console.error("Model generation failed:", e);
          toast.error("Failed to generate diagram from extracted architecture");
        }
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to extract architecture from document",
          { duration: 6000 },
        );
      });
  };

  const handleMergeConfirm = (
    updatedPlan: ReturnType<typeof buildMergePlan>,
  ) => {
    if (!pendingMerge) return;
    try {
      const merged = applyMergePlan(pendingMerge.extraction, updatedPlan);
      if (pendingMerge.extraction.requirements?.length) {
        persistRequirements(pendingMerge.extraction.requirements);
      }
      const model = applyModel(merged);
      toast.success(
        `Added ${merged.components.length} new components and ${merged.dataFlows.length} connections`,
      );
      void model;
    } catch (e) {
      console.error("Merge failed:", e);
      toast.error("Failed to merge extracted architecture");
    }
    setPendingMerge(null);
    setShowMergeReview(false);
  };

  const handleMergeCancel = () => {
    setPendingMerge(null);
    setShowMergeReview(false);
  };

  return {
    showMergeReview,
    setShowMergeReview,
    pendingMerge,
    handleDocumentImported,
    handleMergeConfirm,
    handleMergeCancel,
  };
}
