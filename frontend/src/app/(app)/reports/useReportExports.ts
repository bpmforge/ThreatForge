"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useThreatModel } from "@/features/dashboard";
import {
  exportToPDF,
  exportThreatModelAsCode,
  fetchModelBranding,
} from "@/features/export";
import { generateExecutiveSummary } from "@/features/stakeholder-exports";
import type { Node, Edge } from "@xyflow/react";

export function useReportExports(selectedModelId: string) {
  const router = useRouter();
  const [generating, setGenerating] = useState<string | null>(null);
  const { data: modelDetail } = useThreatModel(selectedModelId || undefined);

  const handleGenerateFullReport = async () => {
    if (!modelDetail) {
      toast.error("Select a threat model first");
      return;
    }
    setGenerating("full");
    try {
      exportToPDF(
        modelDetail.name,
        (modelDetail.canvasState?.nodes ?? []) as Node[],
        (modelDetail.canvasState?.edges ?? []) as Edge[],
        [],
        undefined,
        await fetchModelBranding(selectedModelId),
      );
      toast.success("PDF report opened in new tab");
    } catch {
      toast.error("Failed to generate PDF report");
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateExecutiveSummary = () => {
    if (!modelDetail) {
      toast.error("Select a threat model first");
      return;
    }
    setGenerating("executive");
    try {
      const summary = generateExecutiveSummary({
        name: modelDetail.name,
        nodes: (modelDetail.canvasState?.nodes ?? []) as Array<{
          id: string;
          data: { name: string };
        }>,
        threats: [],
      });
      toast.success(
        `Executive summary generated: Overall risk is ${summary.overallRisk}`,
      );
    } catch {
      toast.error("Failed to generate executive summary");
    } finally {
      setGenerating(null);
    }
  };

  const handleComplianceReport = () => router.push("/analytics/compliance");

  const handleExportAsCode = () => {
    if (!modelDetail) {
      toast.error("Select a threat model first");
      return;
    }
    setGenerating("code");
    try {
      exportThreatModelAsCode(
        modelDetail.id,
        modelDetail.name,
        (modelDetail.canvasState?.nodes ?? []) as Node[],
        (modelDetail.canvasState?.edges ?? []) as Edge[],
        [],
      );
      toast.success("threatmodel.yaml downloaded");
    } catch {
      toast.error("Failed to export threat model as code");
    } finally {
      setGenerating(null);
    }
  };

  const handleRiskAssessment = () =>
    selectedModelId
      ? router.push(`/models/${selectedModelId}`)
      : router.push("/dashboard");

  return {
    generating,
    handleGenerateFullReport,
    handleGenerateExecutiveSummary,
    handleComplianceReport,
    handleExportAsCode,
    handleRiskAssessment,
  };
}
