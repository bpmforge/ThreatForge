"use client";

import { useState, useCallback } from "react";
import type { Threat } from "../types";
import type { ThreatRiskScores } from "../types/risk-frameworks";
import type { StrideCategory, Severity } from "@/types/canvas";

interface UseEditThreatFormProps {
  threat: Threat;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    status: string;
    category?: string | null;
    riskScores?: ThreatRiskScores;
    assigneeId?: string | null;
    likelihood?: number | null;
  }) => void;
}

export function useEditThreatForm({
  threat,
  onOpenChange,
  onSubmit,
}: UseEditThreatFormProps) {
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [descriptionOverride, setDescriptionOverride] = useState<string | null>(
    null,
  );
  const [strideCategoriesOverride, setStrideCategoriesOverride] = useState<
    StrideCategory[] | null
  >(null);
  const [severityOverride, setSeverityOverride] = useState<Severity | null>(
    null,
  );
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [riskScoresOverride, setRiskScoresOverride] =
    useState<ThreatRiskScores | null>(null);
  const [assigneeIdOverride, setAssigneeIdOverride] = useState<
    string | null | undefined
  >(undefined);
  const [likelihoodOverride, setLikelihoodOverride] = useState<
    number | null | undefined
  >(undefined);
  const [activeTab, setActiveTab] = useState("details");

  // Derived values
  const name = nameOverride ?? threat.name;
  const description = descriptionOverride ?? (threat.description || "");
  const strideCategories = strideCategoriesOverride ?? threat.strideCategories;
  const severity = severityOverride ?? threat.severity;
  const status = statusOverride ?? threat.status;
  const category = categoryOverride ?? (threat.category || "");
  const riskScores = riskScoresOverride ?? threat.riskScores;
  const assigneeId =
    assigneeIdOverride !== undefined
      ? assigneeIdOverride
      : (threat.assigneeId ?? null);
  const likelihood =
    likelihoodOverride !== undefined
      ? likelihoodOverride
      : (threat.likelihood ?? null);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setNameOverride(null);
        setDescriptionOverride(null);
        setStrideCategoriesOverride(null);
        setSeverityOverride(null);
        setStatusOverride(null);
        setCategoryOverride(null);
        setRiskScoresOverride(null);
        setAssigneeIdOverride(undefined);
        setLikelihoodOverride(undefined);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  const toggleStrideCategory = (cat: StrideCategory) => {
    const current = strideCategoriesOverride ?? threat.strideCategories;
    setStrideCategoriesOverride(
      current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat],
    );
  };

  const handleSubmit = () => {
    onSubmit({
      name,
      description: description || undefined,
      strideCategories,
      severity,
      status,
      category: category || null,
      riskScores,
      assigneeId: assigneeIdOverride !== undefined ? assigneeId : undefined,
      likelihood: likelihoodOverride !== undefined ? likelihood : undefined,
    });
    handleOpenChange(false);
  };

  const hasChanges =
    name !== threat.name ||
    description !== (threat.description || "") ||
    JSON.stringify(strideCategories.sort()) !==
      JSON.stringify([...threat.strideCategories].sort()) ||
    severity !== threat.severity ||
    status !== threat.status ||
    category !== (threat.category || "") ||
    JSON.stringify(riskScores) !== JSON.stringify(threat.riskScores) ||
    assigneeIdOverride !== undefined;

  return {
    name,
    description,
    strideCategories,
    severity,
    status,
    category,
    riskScores,
    assigneeId,
    likelihood,
    activeTab,
    setActiveTab,
    hasChanges,
    setNameOverride,
    setDescriptionOverride,
    setSeverityOverride,
    setStatusOverride,
    setCategoryOverride,
    setRiskScoresOverride,
    setAssigneeIdOverride,
    setLikelihoodOverride,
    toggleStrideCategory,
    handleOpenChange,
    handleSubmit,
  };
}
