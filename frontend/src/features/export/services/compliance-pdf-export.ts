/**
 * Compliance audit PDF export service.
 *
 * Fetches compliance gap analysis for a model + framework,
 * then generates a print-ready HTML report via browser print dialog.
 */
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { generateCompliancePDFHTML } from "./compliance-pdf-template";
import type {
  Framework,
  ComplianceAnalysis,
} from "@/features/compliance/types";

async function fetchComplianceAnalysis(
  modelId: string,
  framework: Framework,
): Promise<ComplianceAnalysis> {
  return apiGet<ComplianceAnalysis>(
    `/api/threat-models/${modelId}/compliance?framework=${framework}`,
  );
}

/** Export a compliance audit report as PDF for the given model + framework. */
export async function exportCompliancePDF(
  modelId: string,
  modelName: string,
  orgName: string,
  framework: Framework,
): Promise<void> {
  let analysis: ComplianceAnalysis;
  try {
    analysis = await fetchComplianceAnalysis(modelId, framework);
  } catch {
    toast.error("Failed to load compliance data", {
      description: "Could not fetch compliance analysis. Please try again.",
    });
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Unable to open PDF", {
      description: "Please allow popups in your browser to export PDF.",
    });
    return;
  }

  const html = generateCompliancePDFHTML(
    modelName,
    orgName,
    framework,
    analysis,
  );
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}
