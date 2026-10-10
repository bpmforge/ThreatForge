"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { DiagramSource } from "../types";
import { useDiagramImport } from "../hooks/useDiagramImport";
import { DiagramImportForm } from "./DiagramImportForm";
import { DiagramImportResultView } from "./DiagramImportResultView";

type ImportTarget = "architecture" | "dfd";

interface DiagramImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (nodes: unknown[], edges: unknown[]) => void;
  onDFDImportComplete?: (nodes: unknown[], edges: unknown[]) => void;
  defaultTarget?: ImportTarget;
}

export function DiagramImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  onDFDImportComplete,
  defaultTarget = "architecture",
}: DiagramImportDialogProps) {
  const [selectedSource, setSelectedSource] = useState<DiagramSource | null>(
    null,
  );
  const [pasteContent, setPasteContent] = useState("");
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [importTarget, setImportTarget] = useState<ImportTarget>(defaultTarget);

  const {
    importDiagram,
    canvasResult,
    dfdResult,
    loading,
    error,
    clearResult,
  } = useDiagramImport();

  const activeResult = importTarget === "dfd" ? dfdResult : canvasResult;

  const handleFileSelect = useCallback(
    async (file: File) => {
      await importDiagram(file);
    },
    [importDiagram],
  );

  const handlePasteImport = useCallback(async () => {
    if (!pasteContent.trim()) return;
    await importDiagram(selectedSource || "mermaid", pasteContent, {
      autoDetect: !selectedSource,
    });
  }, [importDiagram, pasteContent, selectedSource]);

  const handleConfirmImport = useCallback(() => {
    if (!activeResult) return;
    if (importTarget === "dfd" && onDFDImportComplete) {
      onDFDImportComplete(activeResult.nodes, activeResult.edges);
    } else {
      onImportComplete(activeResult.nodes, activeResult.edges);
    }
    onOpenChange(false);
    clearResult();
    setSelectedSource(null);
    setPasteContent("");
    setImportTarget(defaultTarget);
  }, [
    activeResult,
    importTarget,
    onImportComplete,
    onDFDImportComplete,
    onOpenChange,
    clearResult,
    defaultTarget,
  ]);

  const handleClose = () => {
    onOpenChange(false);
    clearResult();
    setSelectedSource(null);
    setPasteContent("");
    setImportTarget(defaultTarget);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Architecture Diagram</DialogTitle>
          <DialogDescription>
            Import diagrams from Draw.io, Mermaid, or Lucidchart and convert
            them to threat model components.
          </DialogDescription>
        </DialogHeader>

        {!activeResult ? (
          <DiagramImportForm
            importMode={importMode}
            onImportModeChange={setImportMode}
            selectedSource={selectedSource}
            onSourceSelect={setSelectedSource}
            pasteContent={pasteContent}
            onPasteContentChange={setPasteContent}
            loading={loading}
            onFileSelect={handleFileSelect}
            onPasteImport={handlePasteImport}
          />
        ) : (
          <DiagramImportResultView
            result={activeResult}
            importTarget={importTarget}
            onImportTargetChange={setImportTarget}
            showDFDOption={!!onDFDImportComplete}
            onClearResult={clearResult}
            onConfirm={handleConfirmImport}
          />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
