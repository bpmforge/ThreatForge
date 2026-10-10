/**
 * PDF export service.
 */
import type { Node, Edge } from "@xyflow/react";
import type { ExportThreat } from "../types";
import { generatePDFHTML } from "./pdf-template";
import type { ReportBranding } from "./pdf/branding";
import { toast } from "sonner";

/** Generate PDF report with diagram and threat summary */
export function exportToPDF(
  modelName: string,
  nodes: Node[],
  edges: Edge[],
  threats: ExportThreat[],
  diagramDataUrl?: string,
  branding?: ReportBranding,
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Unable to open PDF", {
      description: "Please allow popups in your browser to export PDF.",
    });
    return;
  }

  const html = generatePDFHTML(
    modelName,
    nodes,
    edges,
    threats,
    diagramDataUrl,
    branding,
  );
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}
