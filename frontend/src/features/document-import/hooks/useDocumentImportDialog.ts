"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDocumentImport } from "./useDocumentImport";
import { useDiagramExtraction } from "./useDiagramExtraction";
import type { ImportedDocument, ExtractedArchitecture } from "../types";

interface UseDocumentImportDialogProps {
  onDocumentImported: (document: ImportedDocument) => void;
  onExtractArchitecture?: (document: ImportedDocument) => void;
  onDiagramExtracted?: (
    extraction: ExtractedArchitecture,
    diagramType: string,
  ) => void;
  onOpenChange: (open: boolean) => void;
}

export type ImportTab = "file" | "url" | "paste" | "diagram";

export function useDocumentImportDialog({
  onDocumentImported,
  onExtractArchitecture,
  onDiagramExtracted,
  onOpenChange,
}: UseDocumentImportDialogProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("file");

  const {
    importedDocument,
    progress,
    error,
    importFile,
    importUrl,
    importText,
    reset,
    isImporting,
  } = useDocumentImport({ onSuccess: onDocumentImported });

  const {
    extraction: diagramExtraction,
    diagramType,
    isExtracting: isDiagramExtracting,
    error: diagramError,
    progress: diagramProgress,
    visionSupport,
    extractFromFile: extractDiagram,
    reset: resetDiagram,
  } = useDiagramExtraction();

  const onDiagramExtractedRef = useRef(onDiagramExtracted);
  onDiagramExtractedRef.current = onDiagramExtracted;

  useEffect(() => {
    if (diagramExtraction && diagramType && onDiagramExtractedRef.current) {
      onDiagramExtractedRef.current(diagramExtraction, diagramType);
    }
  }, [diagramExtraction, diagramType]);

  const handleClose = useCallback(() => {
    if (!isImporting && !isDiagramExtracting) {
      reset();
      resetDiagram();
      onOpenChange(false);
    }
  }, [isImporting, isDiagramExtracting, reset, resetDiagram, onOpenChange]);

  const handleExtract = useCallback(() => {
    if (importedDocument && onExtractArchitecture) {
      onExtractArchitecture(importedDocument);
      handleClose();
    }
  }, [importedDocument, onExtractArchitecture, handleClose]);

  const handleStartOver = useCallback(() => {
    reset();
    resetDiagram();
  }, [reset, resetDiagram]);

  return {
    activeTab,
    setActiveTab,
    importedDocument,
    progress,
    error,
    importFile,
    importUrl,
    importText,
    isImporting,
    diagramExtraction,
    diagramType,
    isDiagramExtracting,
    diagramError,
    diagramProgress,
    visionSupport,
    extractDiagram,
    handleClose,
    handleExtract,
    handleStartOver,
    isProcessing: isImporting || isDiagramExtracting,
    onExtractArchitecture,
  };
}
