"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCanvasStore } from "@/stores/canvas";
import type { ComponentNodeData } from "@/types/canvas";
import { ThreatChecklistPanel } from "./ThreatChecklistPanel";

export function ChecklistPanel(): React.ReactElement {
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

  const selectedNode =
    selectedNodeIds.length === 1
      ? nodes.find((n) => n.id === selectedNodeIds[0] && n.type === "component")
      : null;

  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground text-center">
          Select a component to see the STRIDE checklist
        </p>
      </div>
    );
  }

  const data = selectedNode.data as ComponentNodeData;

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <ThreatChecklistPanel
          componentId={selectedNode.id}
          componentLabel={data.label}
          componentType={data.type}
        />
      </div>
    </ScrollArea>
  );
}
