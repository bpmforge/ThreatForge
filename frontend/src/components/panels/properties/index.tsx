"use client";

/**
 * PropertiesPanel - Entry point for properties editing.
 *
 * Shows different panels based on selection type (component, boundary, connection).
 */

import { useCanvasStore } from "@/stores/canvas";
import { EdgePropertiesPanel } from "./EdgePropertiesPanel";
import { NodePropertiesPanel } from "./NodePropertiesPanel";

interface PropertiesPanelProps {
  modelId?: string;
}

export function PropertiesPanel({ modelId }: PropertiesPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);

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
      <div className="w-full h-full bg-background flex flex-col overflow-hidden">
        <div className="p-3 border-b shrink-0">
          <h2 className="font-semibold text-foreground text-sm">Properties</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Select a component or connection to view properties
          </p>
        </div>
      </div>
    );
  }

  if (selectedEdge) {
    return (
      <EdgePropertiesPanel
        edge={selectedEdge}
        nodes={nodes}
        onUpdate={updateEdgeData}
      />
    );
  }

  return (
    <NodePropertiesPanel
      node={selectedNode!}
      onUpdate={updateNodeData}
      modelId={modelId}
    />
  );
}
