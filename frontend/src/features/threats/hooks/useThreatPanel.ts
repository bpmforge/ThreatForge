"use client";

import { useState, useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useCurrentOrgId } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";
import {
  useThreats,
  useCreateThreat,
  useUpdateThreat,
  useUpdateThreatStatus,
  useDeleteThreat,
  useResetThreatToAi,
  useCreateMitigation,
  useUpdateMitigation,
  useUpdateMitigationStatus,
  useDeleteMitigation,
  useMoveMitigation,
} from "./useThreats";
import type { EvidenceLink, RequirementRef } from "./useMitigations";
import { useJiraIntegration } from "./useJiraIntegration";
import { useThreatFilters } from "./useThreatFilters";
import type { Threat, Mitigation, MitigationStrategy } from "../types";
import type { StrideCategory, Severity, ComponentType } from "@/types/canvas";

export function useThreatPanel(modelId: string | null) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const orgId = useCurrentOrgId();
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);

  // #61 delta view: when toggled on, fetch only threats added/changed since
  // the model's most recent attestation. Toggle state is panel-local —
  // intentionally not persisted; treat each session as a fresh look.
  const [sinceLastSignOff, setSinceLastSignOff] = useState(false);

  const { data, isLoading } = useThreats(modelId, { sinceLastSignOff });
  const threats = Array.isArray(data) ? data : [];

  const pendingSuggestionsCount = threats.filter(
    (t) => t.source === "AI_SUGGESTED" && t.reviewStatus === "PENDING",
  ).length;

  const createThreat = useCreateThreat(modelId);
  const updateThreat = useUpdateThreat(modelId);
  const updateThreatStatus = useUpdateThreatStatus(modelId);
  const deleteThreat = useDeleteThreat(modelId);
  const resetThreatToAi = useResetThreatToAi(modelId);
  const createMitigation = useCreateMitigation(modelId);
  const updateMitigation = useUpdateMitigation(modelId);
  const updateMitigationStatusMutation = useUpdateMitigationStatus(modelId);
  const deleteMitigation = useDeleteMitigation(modelId);
  const moveMitigation = useMoveMitigation(modelId);

  const selectedNode =
    selectedNodeIds.length === 1
      ? nodes.find((n) => n.id === selectedNodeIds[0])
      : null;
  const selectedLabel = selectedNode
    ? (selectedNode.data as { label?: string }).label || "Selected"
    : undefined;
  const selectedComponentType =
    selectedNode?.type === "component"
      ? (selectedNode.data as { type?: ComponentType }).type
      : undefined;

  const jira = useJiraIntegration({ orgId, threats });
  const filters = useThreatFilters({
    threats,
    selectedNode: selectedNode ?? null,
  });

  const [view, setView] = useState<"threats" | "remediation">("threats");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [expandedThreatId, setExpandedThreatId] = useState<string | null>(null);
  const [mitigationThreatId, setMitigationThreatId] = useState<string | null>(
    null,
  );
  const [templateThreat, setTemplateThreat] = useState<Threat | null>(null);
  const [editThreat, setEditThreat] = useState<Threat | null>(null);
  const [refineThreat, setRefineThreat] = useState<Threat | null>(null);
  const [editMitigation, setEditMitigation] = useState<{
    threatId: string;
    mitigation: Mitigation;
  } | null>(null);
  const [movingMitigation, setMovingMitigation] = useState<{
    threatId: string;
    mitigationId: string;
  } | null>(null);

  const isAddingGeneralThreat = filters.filter === "general";
  const componentNodeId = isAddingGeneralThreat
    ? undefined
    : selectedNode?.type === "component"
      ? selectedNode.id
      : undefined;
  const contextLabel = isAddingGeneralThreat
    ? "Model (General)"
    : selectedLabel;

  const getConnectionData = useCallback(
    (connectionEdgeId: string | undefined) => {
      if (!connectionEdgeId) return undefined;
      const edge = edges.find((e) => e.id === connectionEdgeId);
      return edge?.data as import("@/types/canvas").ConnectionData | undefined;
    },
    [edges],
  );

  const handleApplyRefinement = useCallback(
    (
      threatId: string,
      updates: Partial<{
        name: string;
        description: string;
        severity: Severity;
      }>,
    ) => {
      updateThreat.mutate({ threatId, data: updates });
      setRefineThreat(null);
    },
    [updateThreat],
  );

  const handleAddThreat = useCallback(
    async (data: {
      name: string;
      description?: string;
      strideCategories: StrideCategory[];
      severity: Severity;
      category?: string;
    }) => {
      await createThreat.mutateAsync({ ...data, componentNodeId });
      setShowAddDialog(false);
    },
    [createThreat, componentNodeId],
  );

  const handleLibrarySelect = useCallback(
    async (data: {
      name: string;
      description: string;
      strideCategories: StrideCategory[];
      severity: Severity;
    }) => {
      await createThreat.mutateAsync({ ...data, componentNodeId });
      setShowLibraryDialog(false);
    },
    [createThreat, componentNodeId],
  );

  const handleAddMitigation = useCallback(
    async (data: {
      description: string;
      priority: string;
      strategy: MitigationStrategy;
      notes?: string;
    }) => {
      if (!mitigationThreatId) return;
      await createMitigation.mutateAsync({
        threatId: mitigationThreatId,
        data,
      });
      setMitigationThreatId(null);
    },
    [createMitigation, mitigationThreatId],
  );

  const handleEditThreat = useCallback(
    async (data: {
      name: string;
      description?: string;
      strideCategories: StrideCategory[];
      severity: Severity;
      status: string;
      category?: string | null;
      assigneeId?: string | null;
    }) => {
      if (!editThreat) return;
      await updateThreat.mutateAsync({ threatId: editThreat.id, data });
      setEditThreat(null);
    },
    [updateThreat, editThreat],
  );

  const handleEditMitigation = useCallback(
    async (data: {
      description: string;
      status: string;
      priority: string;
      strategy: MitigationStrategy;
      notes?: string | null;
      controlCategory?: string | null;
      testCriteria?: string | null;
      testResult?: string | null;
      evidenceLinks?: EvidenceLink[] | null;
      requirementRefs?: RequirementRef[] | null;
      requirementIds?: string[] | null;
      effectivenessScore?: number | null;
      verified?: boolean;
      obligation?: "REQUIRED" | "RECOMMENDED";
    }) => {
      if (!editMitigation) return;
      await updateMitigation.mutateAsync({
        threatId: editMitigation.threatId,
        mitigationId: editMitigation.mitigation.id,
        data,
      });
      setEditMitigation(null);
    },
    [updateMitigation, editMitigation],
  );

  const openEditMitigation = useCallback(
    (threatId: string, mitigationId: string) => {
      const threat = threats.find((t) => t.id === threatId);
      const mitigation = threat?.mitigations?.find(
        (m) => m.id === mitigationId,
      );
      if (threat && mitigation) setEditMitigation({ threatId, mitigation });
    },
    [threats],
  );

  return {
    threats,
    isLoading,
    orgId,
    filters,
    jira,
    setActiveRightPanel,
    pendingSuggestionsCount,
    contextLabel,
    selectedComponentType,
    isAddingGeneralThreat,
    view,
    setView,
    showAddDialog,
    setShowAddDialog,
    showLibraryDialog,
    setShowLibraryDialog,
    expandedThreatId,
    setExpandedThreatId,
    mitigationThreatId,
    setMitigationThreatId,
    templateThreat,
    setTemplateThreat,
    editThreat,
    setEditThreat,
    refineThreat,
    setRefineThreat,
    editMitigation,
    setEditMitigation,
    movingMitigation,
    setMovingMitigation,
    getConnectionData,
    updateThreatStatus,
    deleteThreat,
    resetThreatToAi,
    updateMitigationStatusMutation,
    deleteMitigation,
    moveMitigation,
    handleApplyRefinement,
    handleAddThreat,
    handleLibrarySelect,
    handleAddMitigation,
    handleEditThreat,
    handleEditMitigation,
    openEditMitigation,
    sinceLastSignOff,
    setSinceLastSignOff,
  };
}
