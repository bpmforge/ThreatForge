"use client";

/**
 * useContextMenuHandlers — all action callbacks for the canvas context menu.
 *
 * Extracted from CanvasContextMenu so the orchestrator only manages
 * context detection and routing, not handler definitions.
 */

import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { useUIStore } from "@/stores/ui-store";
import { useCanvasWithHistory } from "@/hooks/useCanvasWithHistory";
import { useBoundaryActions } from "@/hooks/useBoundaryActions";
import { useFormatPainter } from "@/hooks/useFormatPainter";
import { useBulkOperations } from "@/features/bulk-operations";
import { useSelectSameType } from "@/hooks/useSelectSameType";
import { useReactFlow } from "@xyflow/react";
import { apiPost } from "@/lib/api-client";
import type { ComponentType } from "@/types/canvas";

type MenuContext =
  | { type: "canvas"; position: { x: number; y: number } }
  | { type: "node"; nodeId: string; nodeType: "component" | "boundary" }
  | { type: "edge"; edgeId: string; position: { x: number; y: number } }
  | null;

export function useContextMenuHandlers(
  menuContext: MenuContext,
  modelId: string | undefined,
) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const {
    addComponent,
    addBoundary,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  } = useCanvasWithHistory();

  const {
    createBoundaryFromSelection,
    ungroupBoundary,
    canCreateFromSelection,
  } = useBoundaryActions();

  const setSelection = useCanvasStore((s) => s.setSelection);
  const toggleNodeLock = useCanvasStore((s) => s.toggleNodeLock);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const reverseEdge = useCanvasStore((s) => s.reverseEdge);
  const addLegend = useCanvasStore((s) => s.addLegend);
  const addSwimlane = useCanvasStore((s) => s.addSwimlane);

  const { activate: activatePainter, pasteStyle } = useFormatPainter();
  const { matchSize, canMatchSize } = useBulkOperations();
  const { selectSameType } = useSelectSameType();

  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);
  const requestAddThreat = useUIStore((s) => s.requestAddThreat);
  const requestAISuggestions = useUIStore((s) => s.requestAISuggestions);
  const openThreatCatalog = useUIStore((s) => s.openThreatCatalog);

  // ── Canvas ───────────────────────────────────────────────────────────────

  const handleAddComponent = useCallback(
    (type: ComponentType) => {
      if (menuContext?.type !== "canvas") return;
      addComponent(type, screenToFlowPosition(menuContext.position));
    },
    [menuContext, screenToFlowPosition, addComponent],
  );

  const handleAddBoundary = useCallback(() => {
    if (menuContext?.type !== "canvas") return;
    addBoundary(screenToFlowPosition(menuContext.position));
  }, [menuContext, screenToFlowPosition, addBoundary]);

  const handleInsertLegend = useCallback(() => {
    if (menuContext?.type !== "canvas") return;
    addLegend(screenToFlowPosition(menuContext.position));
  }, [menuContext, screenToFlowPosition, addLegend]);

  const handleInsertSwimlane = useCallback(() => {
    if (menuContext?.type !== "canvas") return;
    addSwimlane(screenToFlowPosition(menuContext.position));
  }, [menuContext, screenToFlowPosition, addSwimlane]);

  const handleSelectAll = useCallback(() => {
    setSelection(
      nodes.map((n) => n.id),
      edges.map((e) => e.id),
    );
  }, [nodes, edges, setSelection]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  // ── Node ─────────────────────────────────────────────────────────────────

  const handleEditProperties = useCallback(() => {
    setActiveRightPanel("properties");
  }, [setActiveRightPanel]);

  const handleAddThreat = useCallback(() => {
    if (menuContext?.type === "node") {
      requestAddThreat(menuContext.nodeId);
    } else if (menuContext?.type === "edge") {
      setActiveRightPanel("threats");
    }
  }, [menuContext, requestAddThreat, setActiveRightPanel]);

  const handleSuggestThreats = useCallback(() => {
    requestAISuggestions();
  }, [requestAISuggestions]);

  const handleAnalyzeJustThisComponent = useCallback(() => {
    if (menuContext?.type !== "node" || !modelId) return;
    apiPost(`/api/threat-models/${modelId}/ai/micro-analysis`, {
      componentNodeIds: [menuContext.nodeId],
      force: true,
    }).catch(() => {});
    requestAISuggestions();
  }, [menuContext, modelId, requestAISuggestions]);

  const handleBrowseCatalog = useCallback(() => {
    if (menuContext?.type === "node") openThreatCatalog(menuContext.nodeId);
    else openThreatCatalog();
  }, [menuContext, openThreatCatalog]);

  const handleBringToFront = useCallback(() => {
    if (menuContext?.type === "node") bringToFront(menuContext.nodeId);
  }, [menuContext, bringToFront]);

  const handleSendToBack = useCallback(() => {
    if (menuContext?.type === "node") sendToBack(menuContext.nodeId);
  }, [menuContext, sendToBack]);

  const handleBringForward = useCallback(() => {
    if (menuContext?.type === "node") bringForward(menuContext.nodeId);
  }, [menuContext, bringForward]);

  const handleSendBackward = useCallback(() => {
    if (menuContext?.type === "node") sendBackward(menuContext.nodeId);
  }, [menuContext, sendBackward]);

  const handleToggleLock = useCallback(() => {
    if (menuContext?.type === "node") toggleNodeLock(menuContext.nodeId);
  }, [menuContext, toggleNodeLock]);

  const handleCopyStyle = useCallback(() => {
    if (menuContext?.type === "node") activatePainter(menuContext.nodeId);
  }, [menuContext, activatePainter]);

  const handlePasteStyle = useCallback(() => {
    if (menuContext?.type === "node") pasteStyle(menuContext.nodeId);
  }, [menuContext, pasteStyle]);

  const handleMatchSize = useCallback(
    (mode: "width" | "height" | "both") => {
      if (menuContext?.type !== "node") return;
      if (!selectedNodeIds.includes(menuContext.nodeId)) {
        setSelection([menuContext.nodeId, ...selectedNodeIds], []);
      }
      matchSize(menuContext.nodeId, mode);
    },
    [menuContext, matchSize, selectedNodeIds, setSelection],
  );

  const handleSelectSameType = useCallback(() => {
    if (menuContext?.type === "node") selectSameType(menuContext.nodeId);
  }, [menuContext, selectSameType]);

  const handleUngroupBoundary = useCallback(() => {
    if (menuContext?.type === "node" && menuContext.nodeType === "boundary") {
      ungroupBoundary(menuContext.nodeId);
    }
  }, [menuContext, ungroupBoundary]);

  // ── Edge ─────────────────────────────────────────────────────────────────

  // The bend (manual waypoint) nearest the right-click, if it is close
  // enough to have been "the one under the pointer" — draw.io's "Remove
  // Waypoint". Dragging a bend back into line also removes it; this is the
  // explicit gesture for people who prefer menus.
  const REMOVE_BEND_RADIUS = 40;
  const nearestBend = useMemo(() => {
    if (menuContext?.type !== "edge") return null;
    const edge = edges.find((e) => e.id === menuContext.edgeId);
    const wps = edge?.data?.waypoints ?? null;
    if (!wps || wps.length === 0) return null;
    const p = screenToFlowPosition(menuContext.position);
    let best: { index: number; d: number } | null = null;
    for (let index = 0; index < wps.length; index++) {
      const d = Math.hypot(wps[index].x - p.x, wps[index].y - p.y);
      if (d <= REMOVE_BEND_RADIUS && (best === null || d < best.d)) {
        best = { index, d };
      }
    }
    return best;
  }, [menuContext, edges, screenToFlowPosition]);
  const canRemoveBend = nearestBend !== null;

  const handleRemoveBend = useCallback(() => {
    if (menuContext?.type !== "edge" || !nearestBend) return;
    const edge = edges.find((e) => e.id === menuContext.edgeId);
    const wps = edge?.data?.waypoints ?? [];
    const next = wps.filter((_, i) => i !== nearestBend.index);
    // No bends left → back to automatic routing.
    updateEdgeData(menuContext.edgeId, {
      waypoints: next.length ? next : null,
    });
  }, [menuContext, nearestBend, edges, updateEdgeData]);

  const handleResetLine = useCallback(() => {
    if (menuContext?.type === "edge") {
      updateEdgeData(menuContext.edgeId, { waypoints: null });
    }
  }, [menuContext, updateEdgeData]);

  const handleReverseEdge = useCallback(() => {
    if (menuContext?.type === "edge") reverseEdge(menuContext.edgeId);
  }, [menuContext, reverseEdge]);

  return {
    // canvas
    handleAddComponent,
    handleAddBoundary,
    handleInsertSwimlane,
    handleInsertLegend,
    handleSelectAll,
    handleFitView,
    canCreateFromSelection,
    createBoundaryFromSelection,
    // node
    handleEditProperties,
    handleAddThreat,
    handleSuggestThreats,
    handleAnalyzeJustThisComponent,
    handleBrowseCatalog,
    duplicateSelected,
    handleUngroupBoundary,
    handleSelectSameType,
    deleteSelected,
    handleToggleLock,
    handleCopyStyle,
    handlePasteStyle,
    handleMatchSize,
    canMatchSize,
    handleBringToFront,
    handleSendToBack,
    handleBringForward,
    handleSendBackward,
    nodes,
    // edge
    handleResetLine,
    handleRemoveBend,
    canRemoveBend,
    handleReverseEdge,
  };
}
