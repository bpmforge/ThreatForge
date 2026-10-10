"use client";

import { Info } from "lucide-react";
import { useDFDCanvasStore } from "@/stores/dfd-canvas-store";
import { DFDCanvasProcessPanel } from "./DFDCanvasProcessPanel";
import { DFDCanvasDataStorePanel } from "./DFDCanvasDataStorePanel";
import { DFDCanvasEntityPanel } from "./DFDCanvasEntityPanel";
import { DFDCanvasFlowPanel } from "./DFDCanvasFlowPanel";

export function DFDSelectionPanel() {
  const selectedNodeIds = useDFDCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useDFDCanvasStore((s) => s.selectedEdgeIds);
  const nodes = useDFDCanvasStore((s) => s.nodes);
  const edges = useDFDCanvasStore((s) => s.edges);
  const updateNodeData = useDFDCanvasStore((s) => s.updateNodeData);
  const updateEdgeData = useDFDCanvasStore((s) => s.updateEdgeData);

  const selectedNode =
    selectedNodeIds.length === 1
      ? nodes.find((n) => n.id === selectedNodeIds[0])
      : null;
  const selectedEdge =
    selectedEdgeIds.length === 1
      ? edges.find((e) => e.id === selectedEdgeIds[0])
      : null;

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="p-4">
        <h3 className="font-semibold text-sm mb-2">Properties</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Info className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Select an element to view its properties
          </p>
        </div>
      </div>
    );
  }

  if (selectedNode) {
    const onUpdate = (data: Partial<typeof selectedNode.data>) =>
      updateNodeData(selectedNode.id, data);

    switch (selectedNode.type) {
      case "dfd-process":
        return (
          <DFDCanvasProcessPanel
            key={selectedNode.id}
            node={selectedNode}
            onUpdate={onUpdate}
          />
        );
      case "dfd-datastore":
        return (
          <DFDCanvasDataStorePanel
            key={selectedNode.id}
            node={selectedNode}
            onUpdate={onUpdate}
          />
        );
      case "dfd-entity":
        return (
          <DFDCanvasEntityPanel
            key={selectedNode.id}
            node={selectedNode}
            onUpdate={onUpdate}
          />
        );
      default:
        return null;
    }
  }

  if (selectedEdge) {
    return (
      <DFDCanvasFlowPanel
        key={selectedEdge.id}
        edge={selectedEdge}
        onUpdate={(data) => updateEdgeData(selectedEdge.id, data)}
      />
    );
  }

  return null;
}
