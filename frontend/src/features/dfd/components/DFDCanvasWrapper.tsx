"use client";

/**
 * DFDCanvasWrapper - Wrapper that provides React Flow context and data loading
 */
import { useEffect, useCallback, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { DFDCanvas } from "./DFDCanvas";
import { DFDPalette } from "./DFDPalette";
import { DFDSelectionPanel } from "./DFDSelectionPanel";
import { useDFD } from "../hooks/useDFD";
import { useDFDCanvasStore } from "@/stores/dfd-canvas-store";
import type { DFDNode, DFDEdge } from "@/types/dfd-canvas";
import type { DataType } from "../types";
import { Loader2 } from "lucide-react";
import { exportDFDToMermaid } from "@/features/export";
import { DiagramImportDialog } from "@/features/integrations/diagram-import";
import { toast } from "sonner";

interface DFDCanvasWrapperProps {
  threatModelId: string;
  dfdId: string;
}

export function DFDCanvasWrapper({
  threatModelId,
  dfdId,
}: DFDCanvasWrapperProps) {
  const { data: dfd, isLoading, error } = useDFD(threatModelId, dfdId);
  const loadCanvas = useDFDCanvasStore((s) => s.loadCanvas);
  const activeDfdId = useDFDCanvasStore((s) => s.activeDfdId);
  const addNodes = useDFDCanvasStore((s) => s.addNodes);
  const addEdges = useDFDCanvasStore((s) => s.addEdges);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Load DFD data into canvas store when data is fetched
  useEffect(() => {
    if (dfd && dfd.id !== activeDfdId) {
      // Convert DFD data to canvas nodes/edges
      const nodes: DFDNode[] = [];
      const edges: DFDEdge[] = [];

      // Convert processes
      dfd.processes?.forEach((process) => {
        nodes.push({
          id: process.nodeId,
          type: "dfd-process",
          position: { x: process.positionX, y: process.positionY },
          data: {
            number: process.number,
            name: process.name,
            description: process.description ?? undefined,
            linkedComponentId: process.linkedComponentId ?? undefined,
          },
        });
      });

      // Convert data stores
      dfd.dataStores?.forEach((store) => {
        nodes.push({
          id: store.nodeId,
          type: "dfd-datastore",
          position: { x: store.positionX, y: store.positionY },
          data: {
            number: store.number,
            name: store.name,
            description: store.description ?? undefined,
            dataTypes: store.dataTypes as DataType[],
            linkedComponentId: store.linkedComponentId ?? undefined,
          },
        });
      });

      // Convert external entities
      dfd.externalEntities?.forEach((entity) => {
        nodes.push({
          id: entity.nodeId,
          type: "dfd-entity",
          position: { x: entity.positionX, y: entity.positionY },
          data: {
            name: entity.name,
            entityType: entity.entityType,
            description: entity.description ?? undefined,
            linkedComponentId: entity.linkedComponentId ?? undefined,
          },
        });
      });

      // Convert data flows - need to find source/target node IDs
      dfd.dataFlows?.forEach((flow) => {
        // Find source node ID
        let sourceNodeId = "";
        if (flow.sourceProcessId) {
          const proc = dfd.processes?.find(
            (p) => p.id === flow.sourceProcessId,
          );
          sourceNodeId = proc?.nodeId ?? "";
        } else if (flow.sourceDataStoreId) {
          const store = dfd.dataStores?.find(
            (s) => s.id === flow.sourceDataStoreId,
          );
          sourceNodeId = store?.nodeId ?? "";
        } else if (flow.sourceEntityId) {
          const entity = dfd.externalEntities?.find(
            (e) => e.id === flow.sourceEntityId,
          );
          sourceNodeId = entity?.nodeId ?? "";
        }

        // Find target node ID
        let targetNodeId = "";
        if (flow.targetProcessId) {
          const proc = dfd.processes?.find(
            (p) => p.id === flow.targetProcessId,
          );
          targetNodeId = proc?.nodeId ?? "";
        } else if (flow.targetDataStoreId) {
          const store = dfd.dataStores?.find(
            (s) => s.id === flow.targetDataStoreId,
          );
          targetNodeId = store?.nodeId ?? "";
        } else if (flow.targetEntityId) {
          const entity = dfd.externalEntities?.find(
            (e) => e.id === flow.targetEntityId,
          );
          targetNodeId = entity?.nodeId ?? "";
        }

        if (sourceNodeId && targetNodeId) {
          edges.push({
            id: flow.edgeId,
            type: "dfd-flow",
            source: sourceNodeId,
            target: targetNodeId,
            data: {
              number: flow.number ?? undefined,
              name: flow.name,
              dataTypes: flow.dataTypes as DataType[],
              volume: flow.volume ?? undefined,
              frequency: flow.frequency ?? undefined,
            },
          });
        }
      });

      // Also check if canvasState exists and use it (may have layout info)
      if (dfd.canvasState?.nodes && dfd.canvasState.nodes.length > 0) {
        loadCanvas(
          dfdId,
          dfd.canvasState.nodes as DFDNode[],
          dfd.canvasState.edges as DFDEdge[],
        );
      } else {
        loadCanvas(dfdId, nodes, edges);
      }
    }
  }, [dfd, dfdId, activeDfdId, loadCanvas]);

  // Export handler
  const handleExport = useCallback(() => {
    if (dfd) {
      exportDFDToMermaid(dfd);
    }
  }, [dfd]);

  // Import handler - for DFD nodes/edges
  const handleDFDImport = useCallback(
    (nodes: unknown[], edges: unknown[]) => {
      addNodes(nodes as DFDNode[]);
      addEdges(edges as DFDEdge[]);
      toast.success(
        `Imported ${nodes.length} elements and ${edges.length} flows`,
      );
    },
    [addNodes, addEdges],
  );

  // Open import dialog
  const handleOpenImport = useCallback(() => {
    setShowImportDialog(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !dfd) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Failed to load Data Flow Diagram
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full">
        <DFDPalette />
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <DFDCanvas
              dfdId={dfdId}
              dfdName={dfd.name}
              onExport={handleExport}
              onImport={handleOpenImport}
            />
          </ReactFlowProvider>
        </div>
        <div className="w-72 border-l bg-background overflow-auto">
          <DFDSelectionPanel />
        </div>
      </div>

      <DiagramImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={() => {}} // Architecture import not used here
        onDFDImportComplete={handleDFDImport}
        defaultTarget="dfd"
      />
    </>
  );
}
