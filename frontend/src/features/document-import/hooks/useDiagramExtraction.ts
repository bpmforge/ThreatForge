/**
 * Diagram Extraction Hook
 *
 * Manages the state and logic for extracting architectural components
 * from diagram images using Vision AI.
 */
import { useState, useCallback, useEffect } from "react";
import type { ExtractedArchitecture, ExtractedComponent } from "../types";
import {
  checkVisionSupport,
  extractDiagramFromFile,
  type VisionSupportStatus,
  type DiagramExtractionResult,
} from "../services/diagram-extractor";

interface UseDiagramExtractionReturn {
  extraction: ExtractedArchitecture | null;
  diagramType: string | null;
  isExtracting: boolean;
  error: Error | null;
  progress: { stage: string; percent: number };
  visionSupport: VisionSupportStatus | null;
  /** Extract architecture from an image file */
  extractFromFile: (file: File) => Promise<void>;
  updateComponent: (id: string, updates: Partial<ExtractedComponent>) => void;
  toggleComponentSelection: (id: string) => void;
  toggleFlowSelection: (id: string) => void;
  reset: () => void;
}

export function useDiagramExtraction(): UseDiagramExtractionReturn {
  const [extraction, setExtraction] = useState<ExtractedArchitecture | null>(
    null,
  );
  const [diagramType, setDiagramType] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState({ stage: "idle", percent: 0 });
  const [visionSupport, setVisionSupport] =
    useState<VisionSupportStatus | null>(null);

  // Check vision support on mount
  useEffect(() => {
    checkVisionSupport().then(setVisionSupport);
  }, []);

  const extractFromFile = useCallback(async (file: File) => {
    setIsExtracting(true);
    setError(null);
    setProgress({ stage: "validating", percent: 10 });

    try {
      // Check if vision is supported
      const support = await checkVisionSupport();
      if (!support.supportsVision) {
        throw new Error(
          support.reason ||
            `Vision AI not available. Supported providers: ${support.supportedProviders?.join(", ") || "Claude, OpenAI, Gemini"}`,
        );
      }

      setProgress({ stage: "uploading", percent: 30 });

      // Extract diagram
      setProgress({ stage: "extracting", percent: 50 });
      const result: DiagramExtractionResult =
        await extractDiagramFromFile(file);

      // Check for warnings/errors in extraction
      if (
        result.extraction.warnings.length > 0 &&
        result.extraction.components.length === 0
      ) {
        throw new Error(result.extraction.warnings[0]);
      }

      setExtraction(result.extraction);
      setDiagramType(result.diagramType);
      setProgress({ stage: "complete", percent: 100 });
    } catch (err) {
      setError(err as Error);
      setProgress({ stage: "error", percent: 0 });
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const updateComponent = useCallback(
    (id: string, updates: Partial<ExtractedComponent>) => {
      setExtraction((prev) => {
        if (!prev) return null;

        const updatedComponents = prev.components.map((comp) =>
          comp.id === id ? { ...comp, ...updates } : comp,
        );

        return { ...prev, components: updatedComponents };
      });
    },
    [],
  );

  const toggleComponentSelection = useCallback((id: string) => {
    setExtraction((prev) => {
      if (!prev) return null;

      const updatedComponents = prev.components.map((comp) =>
        comp.id === id ? { ...comp, selected: !comp.selected } : comp,
      );

      return { ...prev, components: updatedComponents };
    });
  }, []);

  const toggleFlowSelection = useCallback((id: string) => {
    setExtraction((prev) => {
      if (!prev) return null;

      const updatedFlows = prev.dataFlows.map((flow) =>
        flow.id === id ? { ...flow, selected: !flow.selected } : flow,
      );

      return { ...prev, dataFlows: updatedFlows };
    });
  }, []);

  const reset = useCallback(() => {
    setExtraction(null);
    setDiagramType(null);
    setIsExtracting(false);
    setError(null);
    setProgress({ stage: "idle", percent: 0 });
  }, []);

  return {
    extraction,
    diagramType,
    isExtracting,
    error,
    progress,
    visionSupport,
    extractFromFile,
    updateComponent,
    toggleComponentSelection,
    toggleFlowSelection,
    reset,
  };
}
