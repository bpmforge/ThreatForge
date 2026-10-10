/**
 * Export actions hook - handles export operations.
 */
import { useState, useCallback } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { useCanvasStore } from "@/stores/canvas";
import {
  exportToJSON,
  exportToYAML,
  exportToPNG,
  exportToSVG,
  exportToPDF,
  fetchModelBranding,
  exportToMermaid,
  exportToDrawio,
  exportThreatModelAsCode,
} from "@/features/export";
import type { ExportThreat } from "@/features/export";
import { apiGet, apiGetBlob } from "@/lib/api-client";

/** API response type for paginated threats */
interface ThreatsResponse {
  data: ExportThreat[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function useExportActions(modelId: string | null, modelName: string) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const [exporting, setExporting] = useState(false);

  const fetchThreats = useCallback(async (): Promise<ExportThreat[]> => {
    if (!modelId) return [];
    try {
      const response = await apiGet<ThreatsResponse>(
        `/api/threat-models/${modelId}/threats`,
      );
      return response.data;
    } catch {
      toast.warning("Could not fetch threats for export");
      return [];
    }
  }, [modelId]);

  const getCanvasElement = useCallback((): HTMLElement | null => {
    return document.querySelector(".react-flow__viewport") as HTMLElement;
  }, []);

  const handleExportJSON = useCallback(async () => {
    setExporting(true);
    try {
      const threats = await fetchThreats();
      exportToJSON(modelId, modelName, nodes, edges, threats);
    } finally {
      setExporting(false);
    }
  }, [modelId, modelName, nodes, edges, fetchThreats]);

  const handleExportYAML = useCallback(async () => {
    setExporting(true);
    try {
      const threats = await fetchThreats();
      exportToYAML(modelId, modelName, nodes, edges, threats);
    } finally {
      setExporting(false);
    }
  }, [modelId, modelName, nodes, edges, fetchThreats]);

  const handleExportPNG = useCallback(async () => {
    const element = getCanvasElement();
    if (!element) return;
    setExporting(true);
    try {
      await exportToPNG(element, modelName);
    } finally {
      setExporting(false);
    }
  }, [modelName, getCanvasElement]);

  const handleExportSVG = useCallback(async () => {
    const element = getCanvasElement();
    if (!element) return;
    setExporting(true);
    try {
      await exportToSVG(element, modelName);
    } finally {
      setExporting(false);
    }
  }, [modelName, getCanvasElement]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const threats = await fetchThreats();
      let diagramDataUrl: string | undefined;
      const element = getCanvasElement();
      if (element) {
        try {
          diagramDataUrl = await toPng(element, {
            backgroundColor: "#f9fafb",
            pixelRatio: 2,
            filter: (node) => {
              const excludeClasses = [
                "react-flow__controls",
                "react-flow__minimap",
                "react-flow__panel",
              ];
              return !(
                node instanceof Element &&
                excludeClasses.some((cls) => node.classList.contains(cls))
              );
            },
          });
        } catch {
          // best-effort — intentionally silent, PDF exports without embedded diagram
          console.warn("Could not capture diagram image");
        }
      }
      const branding = await fetchModelBranding(modelId);
      exportToPDF(modelName, nodes, edges, threats, diagramDataUrl, branding);
    } finally {
      setExporting(false);
    }
  }, [modelId, modelName, nodes, edges, fetchThreats, getCanvasElement]);

  const handleExportMermaid = useCallback(() => {
    setExporting(true);
    try {
      exportToMermaid(modelName, nodes, edges);
    } finally {
      setExporting(false);
    }
  }, [modelName, nodes, edges]);

  const handleExportDrawio = useCallback(() => {
    setExporting(true);
    try {
      exportToDrawio(modelName, nodes, edges);
    } finally {
      setExporting(false);
    }
  }, [modelName, nodes, edges]);

  const handleExportThreatModelCode = useCallback(async () => {
    setExporting(true);
    try {
      const threats = await fetchThreats();
      exportThreatModelAsCode(modelId, modelName, nodes, edges, threats);
    } finally {
      setExporting(false);
    }
  }, [modelId, modelName, nodes, edges, fetchThreats]);

  const handleExportDocx = useCallback(async () => {
    if (!modelId) {
      toast.error("Save the model before downloading a Word report");
      return;
    }
    setExporting(true);
    try {
      const blob = await apiGetBlob(
        `/api/threat-models/${modelId}/report.docx`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${modelName.replace(/[^a-z0-9]/gi, "-")}-report.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word report downloaded");
    } catch {
      toast.error("Failed to export Word report");
    } finally {
      setExporting(false);
    }
  }, [modelId, modelName]);

  return {
    exporting,
    handleExportJSON,
    handleExportYAML,
    handleExportPNG,
    handleExportSVG,
    handleExportPDF,
    handleExportMermaid,
    handleExportDrawio,
    handleExportThreatModelCode,
    handleExportDocx,
  };
}
