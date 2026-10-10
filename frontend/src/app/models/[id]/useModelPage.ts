"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCanvasStore } from "@/stores/canvas";
import {
  useDiagramStore,
  useActiveTabType,
  useActiveSequenceDiagramId,
  useActiveDfdId,
} from "@/stores/diagram-store";
import { useUIStore, type RightPanelType } from "@/stores/ui-store";
import { useExpertAnalysis } from "@/features/ai";
import { useThreatModel, useThreatModels } from "@/features/dashboard";
import { useSequenceDiagrams } from "@/features/sequence-diagrams";
import { useDFDs } from "@/features/dfd";
import { getDocument } from "@/features/documents/services/api";
import { extractArchitecture, generateModel } from "@/features/document-import";
import { useAutoSuggestions } from "@/features/threat-assist/hooks/useAutoSuggestions";
import { useAutoSave, type SaveStatus } from "@/features/auto-save";
import { toast } from "sonner";
import type { ComponentType } from "@/types/canvas";

export function useModelPage(modelId: string) {
  const router = useRouter();

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileLeftDrawerOpen, setMobileLeftDrawerOpen] = useState(false);
  const [mobileRightDrawerOpen, setMobileRightDrawerOpen] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [gapAnalysisOpen, setGapAnalysisOpen] = useState(false);
  const [triggerImport, setTriggerImport] = useState<(() => void) | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<{
    savedAt: string;
  } | null>(null);
  const pendingBackupRef = useRef<{
    nodes: unknown[];
    edges: unknown[];
  } | null>(null);

  const activeRightPanel = useUIStore((s) => s.activeRightPanel);
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);
  const leftPanelCollapsed = useUIStore((s) => s.leftPanelCollapsed);
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const threatCatalogOpen = useUIStore((s) => s.threatCatalogOpen);
  const threatCatalogComponentId = useUIStore(
    (s) => s.threatCatalogComponentId,
  );
  const closeThreatCatalog = useUIStore((s) => s.closeThreatCatalog);
  const guidedWizardSignal = useUIStore((s) => s.guidedWizardOpen);
  const closeGuidedWizard = useUIStore((s) => s.closeGuidedWizard);
  const importRequested = useUIStore((s) => s.importRequested);
  const clearImportRequest = useUIStore((s) => s.clearImportRequest);

  const { data: model, isLoading, error, refetch } = useThreatModel(modelId);
  const { data: sequenceDiagrams } = useSequenceDiagrams(modelId);
  const { data: dfds } = useDFDs(modelId);
  const { result: expertResult } = useExpertAnalysis(modelId);
  const { data: allModels } = useThreatModels();

  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const addComponent = useCanvasStore((s) => s.addComponent);
  // Only the count and the catalog node's data — subscribing to the whole
  // nodes array re-rendered the entire model page on every drag frame.
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const catalogComponentData = useCanvasStore((s) =>
    threatCatalogComponentId
      ? s.nodes.find((n) => n.id === threatCatalogComponentId)?.data
      : undefined,
  );
  const initializeTabs = useDiagramStore((s) => s.initializeTabs);
  const resetDiagramStore = useDiagramStore((s) => s.reset);
  const activeTabType = useActiveTabType();
  const activeSequenceDiagramId = useActiveSequenceDiagramId();
  const activeDfdId = useActiveDfdId();

  const catalogComponent = catalogComponentData
    ? { data: catalogComponentData }
    : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (sequenceDiagrams || dfds) {
      initializeTabs(sequenceDiagrams || [], dfds || []);
    }
  }, [sequenceDiagrams, dfds, initializeTabs]);

  useEffect(() => () => resetDiagramStore(), [resetDiagramStore]);

  useEffect(() => {
    if (model?.canvasState) {
      const { nodes: n, edges: e } = model.canvasState;
      if (Array.isArray(n) && Array.isArray(e)) {
        loadCanvas(
          n as Parameters<typeof loadCanvas>[0],
          e as Parameters<typeof loadCanvas>[1],
        );
      }
    }
  }, [model, loadCanvas]);

  const hasShownWizardRef = useRef(false);
  useEffect(() => {
    // Decide from the SERVER's canvas, not the store: the store is empty for
    // a moment before the collab sync lands, which opened the wizard over
    // fully populated models.
    const rawState = model?.canvasState as unknown;
    const parsedState =
      typeof rawState === "string"
        ? (() => {
            try {
              return JSON.parse(rawState) as { nodes?: unknown[] };
            } catch {
              return undefined;
            }
          })()
        : (rawState as { nodes?: unknown[] } | undefined);
    const serverNodes = parsedState?.nodes?.length ?? 0;
    if (
      hasShownWizardRef.current ||
      isLoading ||
      !model ||
      nodeCount > 0 ||
      serverNodes > 0
    )
      return;
    const key = `wizard-dismissed-${modelId}`;
    if (typeof localStorage !== "undefined" && !localStorage.getItem(key)) {
      hasShownWizardRef.current = true;
      setWizardOpen(true);
    }
  }, [isLoading, model, modelId, nodeCount]);

  // Canvas empty-state → open the Guided Wizard. The wizard's open state is
  // local to this hook, so the canvas (which only reaches the ui-store) raises a
  // momentary store signal that we consume here and immediately clear.
  useEffect(() => {
    if (guidedWizardSignal) {
      setWizardOpen(true);
      closeGuidedWizard();
    }
  }, [guidedWizardSignal, closeGuidedWizard]);

  // Canvas empty-state → trigger document import. triggerImport is registered by
  // the Toolbar; wait until it exists before consuming the request so an early
  // click isn't dropped.
  useEffect(() => {
    if (importRequested && triggerImport) {
      triggerImport();
      clearImportRequest();
    }
  }, [importRequested, triggerImport, clearImportRequest]);

  const prevNodeCountRef = useRef(0);
  const { triggerSuggestions } = useAutoSuggestions({
    enabled: true,
    useAI: true,
    modelId,
  });
  useEffect(() => {
    if (nodeCount > prevNodeCountRef.current && prevNodeCountRef.current > 0) {
      const { nodes } = useCanvasStore.getState();
      const newNode = nodes[nodes.length - 1];
      if (newNode?.data?.type && newNode?.data?.label) {
        triggerSuggestions(
          newNode.id,
          newNode.data.type as ComponentType,
          newNode.data.label as string,
        );
        toast.info("Analyzing new component for threats...", {
          duration: 2000,
        });
      }
    }
    prevNodeCountRef.current = nodeCount;
  }, [nodeCount, triggerSuggestions]);

  const { restoreFromLocalStorage, clearLocalStorageBackup } = useAutoSave({
    modelId,
    modelName: model?.name ?? "Untitled",
    onStatusChange: setSaveStatus,
    enabled: !!modelId,
  });

  const hasCheckedBackupRef = useRef(false);
  useEffect(() => {
    if (hasCheckedBackupRef.current) return;
    hasCheckedBackupRef.current = true;
    const backup = restoreFromLocalStorage();
    if (backup && backup.nodes.length > 0 && backup.modelId === modelId) {
      const savedAt = new Date(backup.savedAt).toLocaleString();
      pendingBackupRef.current = { nodes: backup.nodes, edges: backup.edges };
      setTimeout(() => setRestoreConfirm({ savedAt }), 0);
    }
  }, [modelId, restoreFromLocalStorage]);

  const handleWizardComplete = useCallback(
    (components: { name: string; type: string }[]) => {
      localStorage.setItem(`wizard-dismissed-${modelId}`, "1");
      setWizardOpen(false);
      components.forEach((c, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        addComponent(
          c.type as ComponentType,
          { x: 160 + col * 220, y: 80 + row * 160 },
          c.name,
        );
      });
      useCanvasStore.setState({ isDirty: true });
    },
    [modelId, addComponent],
  );

  const handleModelChange = useCallback(
    (id: string | null, _name: string) => {
      if (id && id !== modelId) router.push(`/models/${id}`);
    },
    [modelId, router],
  );

  const handleReExtract = useCallback(
    async (docId: string) => {
      if (!modelId) return;
      toast.info("Re-extracting components from document...", {
        duration: 10000,
      });
      try {
        const doc = await getDocument(modelId, docId);
        if (!doc?.content?.trim()) {
          toast.error("Document has no content to extract from");
          return;
        }
        const result = await extractArchitecture(doc.content, {
          documentType: "auto",
        });
        const { components, dataFlows } = result.extraction;
        if (components.length === 0) {
          toast.info("No components found in document");
          return;
        }
        const model_ = generateModel(result.extraction, {
          type: "hierarchical",
          spacing: { x: 250, y: 150 },
        });
        loadCanvas(
          model_.nodes as unknown as Parameters<typeof loadCanvas>[0],
          model_.edges as unknown as Parameters<typeof loadCanvas>[1],
        );
        useCanvasStore.setState({ isDirty: true });
        toast.success(
          `Rebuilt: ${components.length} components, ${dataFlows.length} connections`,
        );
      } catch (err) {
        toast.error(
          `Extraction failed: ${getErrorMessage(err, "Unknown error")}`,
        );
      }
    },
    [modelId, loadCanvas],
  );

  const handleRestoreConfirm = useCallback(() => {
    if (pendingBackupRef.current) {
      loadCanvas(
        pendingBackupRef.current.nodes as Parameters<typeof loadCanvas>[0],
        pendingBackupRef.current.edges as Parameters<typeof loadCanvas>[1],
      );
      pendingBackupRef.current = null;
    }
    clearLocalStorageBackup();
    setRestoreConfirm(null);
  }, [loadCanvas, clearLocalStorageBackup]);

  const handleRestoreCancel = useCallback(() => {
    pendingBackupRef.current = null;
    clearLocalStorageBackup();
    setRestoreConfirm(null);
  }, [clearLocalStorageBackup]);

  const handleImportReady = useCallback(
    (fn: () => void) => setTriggerImport(() => fn),
    [],
  );

  return {
    model,
    isLoading,
    error,
    refetch,
    allModels,
    expertResult,
    activeTabType,
    activeSequenceDiagramId,
    activeDfdId,
    catalogComponent,
    saveStatus,
    setSaveStatus,
    mounted,
    wizardOpen,
    setWizardOpen,
    mobileLeftDrawerOpen,
    setMobileLeftDrawerOpen,
    mobileRightDrawerOpen,
    setMobileRightDrawerOpen,
    viewingDocId,
    setViewingDocId,
    gapAnalysisOpen,
    setGapAnalysisOpen,
    triggerImport,
    restoreConfirm,
    activeRightPanel,
    setActiveRightPanel: setActiveRightPanel as (p: RightPanelType) => void,
    leftPanelCollapsed,
    rightPanelCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
    threatCatalogOpen,
    threatCatalogComponentId,
    closeThreatCatalog,
    handleWizardComplete,
    handleModelChange,
    handleReExtract,
    handleRestoreConfirm,
    handleRestoreCancel,
    handleImportReady,
  };
}
