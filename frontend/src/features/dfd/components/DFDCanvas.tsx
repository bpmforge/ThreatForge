"use client";

/**
 * DFDCanvas - Main React Flow canvas for Data Flow Diagrams
 *
 * Provides the interactive diagramming surface with DFD-specific nodes
 * and drag-and-drop support.
 */
import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  type OnSelectionChangeParams,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";

import { useDFDCanvasStore } from "@/stores/dfd-canvas-store";
import {
  DFDProcessNode,
  DFDDataStoreNode,
  DFDExternalEntityNode,
} from "./nodes";
import { DFDFlowEdge } from "./edges";
import type { DFDNode, DFDEdge } from "@/types/dfd-canvas";
import type { ExternalEntityType } from "@/features/dfd";
import type { NodeChange, EdgeChange } from "@xyflow/react";

/** Custom node type registry */
const nodeTypes = {
  "dfd-process": DFDProcessNode,
  "dfd-datastore": DFDDataStoreNode,
  "dfd-entity": DFDExternalEntityNode,
} as const;

/** Custom edge type registry */
const edgeTypes = {
  "dfd-flow": DFDFlowEdge,
} as const;

/** Default edge options */
const defaultEdgeOptions = {
  type: "dfd-flow",
  markerEnd: { type: MarkerType.ArrowClosed },
};

/** Props for drag-and-drop from palette */
interface DragData {
  type: "dfd-process" | "dfd-datastore" | "dfd-entity";
  entityType?: ExternalEntityType;
}

/** Props for DFDCanvas */
interface DFDCanvasProps {
  /** DFD ID being edited */
  dfdId: string;
  /** DFD name */
  dfdName: string;
  /** Export callback */
  onExport?: () => void;
  /** Import callback */
  onImport?: () => void;
}

export function DFDCanvas({ dfdName, onExport, onImport }: DFDCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);

  // Zustand store selectors
  const nodes = useDFDCanvasStore((s) => s.nodes);
  const edges = useDFDCanvasStore((s) => s.edges);
  const storeOnNodesChange = useDFDCanvasStore((s) => s.onNodesChange);
  const storeOnEdgesChange = useDFDCanvasStore((s) => s.onEdgesChange);
  const onConnect = useDFDCanvasStore((s) => s.onConnect);
  const addProcess = useDFDCanvasStore((s) => s.addProcess);
  const addDataStore = useDFDCanvasStore((s) => s.addDataStore);
  const addExternalEntity = useDFDCanvasStore((s) => s.addExternalEntity);
  const setSelection = useDFDCanvasStore((s) => s.setSelection);
  const deleteSelected = useDFDCanvasStore((s) => s.deleteSelected);

  const onNodesChange = useCallback(
    (changes: NodeChange<DFDNode>[]) => {
      storeOnNodesChange(changes);
    },
    [storeOnNodesChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<DFDEdge>[]) => {
      storeOnEdgesChange(changes);
    },
    [storeOnEdgesChange],
  );

  /** Handle selection changes */
  const handleSelectionChange = useCallback(
    ({
      nodes: selectedNodes,
      edges: selectedEdges,
    }: OnSelectionChangeParams) => {
      const nodeIds = selectedNodes.map((n) => n.id);
      const edgeIds = selectedEdges.map((e) => e.id);
      setSelection(nodeIds, edgeIds);
    },
    [setSelection],
  );

  /** Handle drag over for palette drops */
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  /** Handle drop from palette */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const dataStr = event.dataTransfer.getData("application/json");
      if (!dataStr) return;

      try {
        const data: DragData = JSON.parse(dataStr);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        if (data.type === "dfd-process") {
          addProcess(position);
        } else if (data.type === "dfd-datastore") {
          addDataStore(position);
        } else if (data.type === "dfd-entity" && data.entityType) {
          addExternalEntity(position, data.entityType);
        }
      } catch {
        console.error("Failed to parse drop data");
      }
    },
    [screenToFlowPosition, addProcess, addDataStore, addExternalEntity],
  );

  /** Handle keyboard shortcuts */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      }
      if (event.key === "g" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setShowGrid((prev) => !prev);
      }
      if (event.key === "m" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setShowMinimap((prev) => !prev);
      }
    },
    [deleteSelected],
  );

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid={showGrid}
        snapGrid={[16, 16]}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        selectionOnDrag
        panOnScroll
        className="bg-muted/50"
      >
        {/* Grid background - uses CSS for dark mode support */}
        {showGrid && (
          <Background gap={16} size={1} className="!stroke-border" />
        )}

        {/* Zoom controls - styled via globals.css for dark mode */}
        <Controls position="bottom-right" />

        {/* Minimap for navigation - styled via globals.css for dark mode */}
        {showMinimap && (
          <MiniMap
            position="bottom-left"
            nodeStrokeWidth={3}
            pannable
            zoomable
          />
        )}

        {/* Canvas info panel */}
        <Panel
          position="top-left"
          className="bg-background/90 p-2 rounded-lg shadow-sm"
        >
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">{dfdName}</span>
              <span className="mx-2">|</span>
              <span className="font-medium">{nodes.length}</span> elements
              <span className="mx-2">•</span>
              <span className="font-medium">{edges.length}</span> flows
            </div>
            {onImport && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onImport}
              >
                <Upload className="h-3 w-3 mr-1" />
                Import
              </Button>
            )}
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onExport}
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            )}
          </div>
        </Panel>

        {/* DFD Legend */}
        <Panel
          position="top-right"
          className="bg-background/90 p-2 rounded-lg shadow-sm"
        >
          <div className="text-xs space-y-1">
            <div className="font-medium text-muted-foreground mb-2">
              DFD Notation
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-blue-400 bg-white" />
              <span>Process</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-3 border-t-2 border-b-2 border-purple-400 bg-white" />
              <span>Data Store</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-4 border-2 border-amber-400 bg-amber-50" />
              <span>External Entity</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
