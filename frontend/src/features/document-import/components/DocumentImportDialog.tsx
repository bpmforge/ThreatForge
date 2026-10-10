"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentImportForm } from "./DocumentImportForm";
import {
  ImportProgressView,
  DiagramProgressView,
  DiagramResultsView,
  DocumentPreviewView,
} from "./DocumentImportProgressViews";
import { useDocumentImportDialog } from "../hooks/useDocumentImportDialog";
import type { ImportedDocument, ExtractedArchitecture } from "../types";

interface DocumentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentImported: (document: ImportedDocument) => void;
  onExtractArchitecture?: (document: ImportedDocument) => void;
  onDiagramExtracted?: (
    extraction: ExtractedArchitecture,
    diagramType: string,
  ) => void;
}

export function DocumentImportDialog({
  open,
  onOpenChange,
  onDocumentImported,
  onExtractArchitecture,
  onDiagramExtracted,
}: DocumentImportDialogProps): React.ReactElement {
  const {
    activeTab,
    setActiveTab,
    importedDocument,
    progress,
    isImporting,
    diagramExtraction,
    diagramType,
    isDiagramExtracting,
    diagramError,
    diagramProgress,
    visionSupport,
    isProcessing,
    importFile,
    importUrl,
    importText,
    extractDiagram,
    handleClose,
    handleExtract,
    handleStartOver,
  } = useDocumentImportDialog({
    onDocumentImported,
    onExtractArchitecture,
    onDiagramExtracted,
    onOpenChange,
  });

  const showImportForm =
    !importedDocument && !diagramExtraction && progress.stage !== "complete";
  const showProgress = isImporting;
  const showDiagramProgress = isDiagramExtracting;
  const showPreview = importedDocument && !isImporting;
  const showDiagramResults = diagramExtraction && !isDiagramExtracting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Architecture Document</DialogTitle>
          <DialogDescription>
            Provide your architecture documentation and AI will extract
            components, connections, and security requirements to build your
            threat model diagram.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {showImportForm && (
            <DocumentImportForm
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onFileSelect={importFile}
              onExtractDiagram={extractDiagram}
              onUrlSubmit={importUrl}
              onTextSubmit={importText}
              isProcessing={isProcessing}
              visionSupported={visionSupport?.supportsVision ?? true}
              supportedProviders={visionSupport?.supportedProviders}
            />
          )}

          {showProgress && <ImportProgressView progress={progress} />}

          {showDiagramProgress && (
            <DiagramProgressView
              diagramProgress={diagramProgress}
              diagramError={diagramError}
            />
          )}

          {showDiagramResults && diagramExtraction && (
            <DiagramResultsView
              extraction={diagramExtraction}
              diagramType={diagramType}
              onStartOver={handleStartOver}
            />
          )}

          {showPreview && importedDocument && (
            <DocumentPreviewView
              document={importedDocument}
              onStartOver={handleStartOver}
              onExtract={handleExtract}
              hasExtractArchitecture={!!onExtractArchitecture}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
