"use client";

/**
 * ThreatModelCanvas - Main React Flow canvas for threat modeling.
 *
 * Accessibility: WCAG 2.1.1 Keyboard, WCAG 2.4.3 Focus Order.
 * Sub-modules: canvas/CanvasToolbar, canvas/useCanvasDragHandlers,
 *              canvas/useCanvasInteractions.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvasStore, type CanvasNode } from "@/stores/canvas";
import { ComponentNode } from "./ComponentNode";
import { BoundaryNode } from "./BoundaryNode";
import { LegendNode } from "./LegendNode";
import { SwimlaneNode } from "./SwimlaneNode";
import { LayersPanel } from "./LayersPanel";
import { BoundaryHighlight } from "./BoundaryHighlight";
import { SecurityEdge } from "./edges";
import { ShiftSnapConnectionLine } from "./edges/ShiftSnapConnectionLine";
import {
  CollaboratorCursors,
  SelectionHighlights,
  type Collaborator,
} from "@/features/collaboration";
import { FloatingActionBar } from "@/features/bulk-operations";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useCanvasKeyboardNav } from "@/hooks/useCanvasKeyboardNav";
import { useArrowNudge } from "@/hooks/useArrowNudge";
import { useFormatPainter } from "@/hooks/useFormatPainter";
import { useEdgeReconnect } from "@/hooks/useEdgeReconnect";
import { useQuickAdd } from "@/hooks/useQuickAdd";
import { QuickAddShapePicker } from "./QuickAddShapePicker";
import { useSelectInverse } from "@/hooks/useSelectInverse";
import { useBoundaryGrouping } from "@/hooks/useBoundaryGrouping";
import { useBoundaryDragFeedback } from "@/hooks/useBoundaryDragFeedback";
import {
  useAlignmentGuides,
  computeSnapOffsets,
} from "@/hooks/useAlignmentGuides";
import { ShortcutsHelpDialog } from "@/components/dialogs/ShortcutsHelpDialog";
import { AlignmentGuides } from "@/components/canvas/AlignmentGuides";
import { ZoomIndicator } from "@/components/canvas/ZoomIndicator";
import { FindInDiagram } from "@/components/canvas/FindInDiagram";
import { OutlinePanel } from "@/components/canvas/OutlinePanel";
import { VisuallyHidden } from "@/components/a11y";
import { CanvasEmptyState } from "@/components/canvas/CanvasEmptyState";
import { useUIStore } from "@/stores/ui-store";
import { useCanvasWithHistory } from "@/hooks/useCanvasWithHistory";
import type { NodeChange } from "@xyflow/react";
import { CanvasToolbar } from "./canvas/CanvasToolbar";
import { useCanvasDragHandlers } from "./canvas/useCanvasDragHandlers";
import { useCanvasInteractions } from "./canvas/useCanvasInteractions";

const nodeTypes = {
  component: ComponentNode,
  boundary: BoundaryNode,
  legend: LegendNode,
  swimlane: SwimlaneNode,
} as const;

const edgeTypes = { security: SecurityEdge } as const;

const defaultEdgeOptions = {
  type: "security",
  animated: false,
  data: { style: { lineStyle: "smoothstep" } },
};

interface ThreatModelCanvasProps {
  isCollaborating?: boolean;
  collaborators?: Collaborator[];
  onCursorMove?: (x: number, y: number) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
  onNodeActivate?: (nodeId: string) => void;
}

export function ThreatModelCanvas({
  isCollaborating = false,
  collaborators = [],
  onCursorMove,
  onSelectionChange: onCollaborationSelectionChange,
  onNodeActivate,
}: ThreatModelCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  const [showHelp, setShowHelp] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const storeOnNodesChange = useCanvasStore((s) => s.onNodesChange);
  const openGuidedWizard = useUIStore((s) => s.openGuidedWizard);
  const requestImport = useUIStore((s) => s.requestImport);
  const pendingPaletteType = useUIStore((s) => s.pendingPaletteType);
  const setPendingPaletteType = useUIStore((s) => s.setPendingPaletteType);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setHoveredNodeId = useCanvasStore((s) => s.setHoveredNodeId);
  const securityOverlay = useCanvasStore((s) => s.securityOverlay);
  const toggleSecurityOverlay = useCanvasStore((s) => s.toggleSecurityOverlay);
  const layers = useCanvasStore((s) => s.layers);
  const nodeLayerMap = useCanvasStore((s) => s.nodeLayerMap);

  const effectiveNodes = useMemo(() => {
    if (layers.length === 0) return nodes;
    return nodes.map((node) => {
      const layerId = nodeLayerMap[node.id];
      if (!layerId) return node;
      const layer = layers.find((l) => l.id === layerId);
      if (!layer) return node;
      return {
        ...node,
        hidden: node.hidden || !layer.visible,
        draggable: layer.locked ? false : node.draggable,
      };
    });
  }, [nodes, layers, nodeLayerMap]);
  const { onReconnect, onReconnectStart, onReconnectEnd } = useEdgeReconnect();
  const { quickAdd, top5, handleConnectEnd, confirmAdd, dismiss } =
    useQuickAdd();
  const { addComponent } = useCanvasWithHistory();

  // Clear stale hover on mount (Zustand survives HMR)
  useEffect(() => {
    setHoveredNodeId(null);
  }, [setHoveredNodeId]);

  const { processNodeChanges } = useBoundaryGrouping();
  const {
    isDragging,
    targetBoundaryBounds,
    onNodeDragStart: boundaryDragStart,
    onNodeDrag: boundaryDrag,
    onNodeDragStop: boundaryDragStop,
  } = useBoundaryDragFeedback();
  const { guides, computeGuides, clearGuides } = useAlignmentGuides();

  // Snap + boundary-grouping wrapper around the store's onNodesChange
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      const snapped = changes.map((change) => {
        if (change.type === "position" && change.dragging && change.position) {
          const node = nodes.find((n) => n.id === change.id);
          if (node) {
            const { snapX, snapY } = computeSnapOffsets(
              { ...node, position: change.position },
              nodes,
            );
            if (snapX !== null || snapY !== null) {
              return {
                ...change,
                position: {
                  x: change.position.x + (snapX ?? 0),
                  y: change.position.y + (snapY ?? 0),
                },
              };
            }
          }
        }
        return change;
      });
      storeOnNodesChange(snapped);
      processNodeChanges(snapped);
    },
    [storeOnNodesChange, processNodeChanges, nodes],
  );

  const { handleNodeDragStart, handleNodeDrag, handleNodeDragStop } =
    useCanvasDragHandlers({
      nodes,
      edges,
      onNodesChange,
      onNodeDragStart: boundaryDragStart,
      onNodeDrag: boundaryDrag,
      onNodeDragStop: boundaryDragStop,
      computeGuides,
      clearGuides,
    });

  const {
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    handleSelectionChange,
    handleMouseMove,
    handleDragOver,
    handleDrop,
  } = useCanvasInteractions({
    screenToFlowPosition,
    onCursorMove,
    onCollaborationSelectionChange,
  });

  const { isPanMode } = useKeyboardShortcuts({
    onShowHelp: () => setShowHelp(true),
    onEscape: () => setShowHelp(false),
    onToggleGrid: () => setShowGrid((p) => !p),
    onToggleSnap: () => setSnapToGrid((p) => !p),
    onToggleMinimap: () => setShowMinimap((p) => !p),
    onOpenFind: () => setFindOpen(true),
    onToggleOutline: () => setOutlineOpen((p) => !p),
  });

  useArrowNudge();
  useSelectInverse();

  const { isFormatPainting, cancel: cancelPainter } = useFormatPainter();
  const { handleKeyDown: handleA11yKeyDown } = useCanvasKeyboardNav({
    onNodeActivate,
    disableNudge: true,
  });

  return (
    <div
      // `relative` makes THIS the positioning context for canvas overlays
      // (CanvasEmptyState, OutlinePanel). Without it they resolved against the
      // page's <main> and only looked correct because it happens to be the same
      // box — any padding or border there would have misaligned every overlay.
      className="relative w-full h-full"
      tabIndex={0}
      role="application"
      aria-label="Threat modeling canvas"
      aria-describedby="canvas-instructions"
      onKeyDown={handleA11yKeyDown}
      onMouseMove={isCollaborating ? handleMouseMove : undefined}
      onMouseLeave={() => setHoveredNodeId(null)}
    >
      <VisuallyHidden>
        <div id="canvas-instructions">
          Use Tab to navigate between components. Arrow keys move selected
          components or pan the canvas. Press Enter or Space to open properties.
          Press Delete to remove selected items. Press ? for all keyboard
          shortcuts.
        </div>
      </VisuallyHidden>

      <ReactFlow
        nodes={effectiveNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaneClick={(e) => {
          setHoveredNodeId(null);
          if (isFormatPainting) cancelPainter();
          if (pendingPaletteType) {
            const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            addComponent(pendingPaletteType, pos);
            setPendingPaletteType(null);
          }
        }}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineComponent={ShiftSnapConnectionLine}
        onConnectEnd={handleConnectEnd}
        edgesReconnectable
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        fitView
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        selectionOnDrag
        panOnScroll
        panOnDrag={isPanMode}
        selectNodesOnDrag={false}
        elevateNodesOnSelect={false}
        className={
          isFormatPainting ? "bg-muted/50 cursor-crosshair" : "bg-muted/50"
        }
      >
        {findOpen && <FindInDiagram onClose={() => setFindOpen(false)} />}
        {showGrid && (
          <Background gap={16} size={1} className="!stroke-border" />
        )}
        <Controls position="bottom-right" />
        <Panel
          position="bottom-center"
          className="bg-background/90 rounded-md shadow-sm"
        >
          <ZoomIndicator />
        </Panel>
        {showMinimap && (
          <MiniMap
            position="bottom-left"
            nodeStrokeWidth={3}
            pannable
            zoomable
          />
        )}
        <CanvasToolbar
          nodeCount={nodes.length}
          edgeCount={edges.length}
          isCollaborating={isCollaborating}
          snapToGrid={snapToGrid}
          onToggleSnap={() => setSnapToGrid((p) => !p)}
          securityOverlay={securityOverlay}
          onToggleSecurityOverlay={toggleSecurityOverlay}
          onShowHelp={() => setShowHelp(true)}
          layersOpen={layersOpen}
          onToggleLayers={() => setLayersOpen((p) => !p)}
        />
        <Panel position="top-left" className="mt-12">
          <LayersPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
        </Panel>
        {isCollaborating && collaborators.length > 0 && (
          <>
            <CollaboratorCursors collaborators={collaborators} />
            <SelectionHighlights collaborators={collaborators} />
          </>
        )}
        <BoundaryHighlight
          bounds={targetBoundaryBounds}
          isActive={isDragging}
        />
        <AlignmentGuides guides={guides} />
      </ReactFlow>

      <OutlinePanel open={outlineOpen} onClose={() => setOutlineOpen(false)} />
      <ShortcutsHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <FloatingActionBar />
      {quickAdd && (
        <QuickAddShapePicker
          state={quickAdd}
          top5={top5}
          onSelect={confirmAdd}
          onDismiss={dismiss}
        />
      )}
      {nodes.length === 0 && (
        <CanvasEmptyState
          onOpenWizard={openGuidedWizard}
          onOpenImport={requestImport}
        />
      )}
      {pendingPaletteType && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          <span>Tap canvas to place</span>
          <button
            type="button"
            onClick={() => setPendingPaletteType(null)}
            className="ml-1 opacity-80 hover:opacity-100 text-xs underline"
            aria-label="Cancel tap-to-place"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
