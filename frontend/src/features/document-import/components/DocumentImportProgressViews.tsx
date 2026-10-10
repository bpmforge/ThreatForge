"use client";

import { Image, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportProgress } from "./ImportProgress";
import { ParsedPreview } from "./ParsedPreview";
import type {
  ImportedDocument,
  ExtractedArchitecture,
  ImportProgress as ImportProgressData,
} from "../types";

interface ImportProgressViewProps {
  progress: ImportProgressData;
}

export function ImportProgressView({ progress }: ImportProgressViewProps) {
  return (
    <div className="py-8">
      <ImportProgress progress={progress} />
    </div>
  );
}

interface DiagramProgressViewProps {
  diagramProgress: {
    stage: string;
    percent: number;
  };
  diagramError?: Error | null;
}

export function DiagramProgressView({
  diagramProgress,
  diagramError,
}: DiagramProgressViewProps) {
  const transformedProgress = {
    stage: diagramProgress.stage as
      | "idle"
      | "uploading"
      | "parsing"
      | "extracting"
      | "complete"
      | "error",
    progress: diagramProgress.percent,
    message:
      diagramProgress.stage === "validating"
        ? "Validating image..."
        : diagramProgress.stage === "uploading"
          ? "Preparing image..."
          : diagramProgress.stage === "extracting"
            ? "Analyzing diagram with Vision AI..."
            : "Processing...",
    error: diagramError?.message,
  };

  return (
    <div className="py-8">
      <ImportProgress progress={transformedProgress} />
    </div>
  );
}

interface DiagramResultsViewProps {
  extraction: ExtractedArchitecture;
  diagramType: string | null;
  onStartOver: () => void;
}

export function DiagramResultsView({
  extraction,
  diagramType,
  onStartOver,
}: DiagramResultsViewProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Image className="h-5 w-5 text-primary" />
          <span className="font-medium">Diagram Analysis Complete</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Detected {diagramType || "architecture"} diagram with{" "}
          {extraction.components.length} components and{" "}
          {extraction.dataFlows.length} data flows.
        </p>
        {extraction.warnings.length > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            {extraction.warnings[0]}
          </p>
        )}
      </div>

      <Button variant="outline" onClick={onStartOver} className="w-full">
        Analyze Different Diagram
      </Button>
    </div>
  );
}

interface DocumentPreviewViewProps {
  document: ImportedDocument;
  onStartOver: () => void;
  onExtract?: () => void;
  hasExtractArchitecture?: boolean;
}

export function DocumentPreviewView({
  document,
  onStartOver,
  onExtract,
  hasExtractArchitecture,
}: DocumentPreviewViewProps) {
  return (
    <div className="space-y-4">
      <ParsedPreview document={document} />

      <div className="flex gap-3">
        <Button variant="outline" onClick={onStartOver} className="flex-1">
          Import Different Document
        </Button>

        {hasExtractArchitecture && (
          <Button onClick={onExtract} className="flex-1">
            <Sparkles className="h-4 w-4 mr-2" />
            Extract Architecture
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
