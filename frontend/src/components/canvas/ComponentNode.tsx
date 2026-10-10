"use client";

import { memo, useState } from "react";
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import type { ComponentNodeData } from "@/types/canvas";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { QuickConnectOverlay } from "./QuickConnectOverlay";
import { NodeActionToolbar } from "./NodeActionToolbar";
import { ComponentNodeHandles } from "./ComponentNodeHandles";
import { ComponentNodeInner } from "./ComponentNodeInner";
import { useCanvasStore } from "@/stores/canvas";
import { useFormatPainter } from "@/hooks/useFormatPainter";
import { useNodeRotation } from "./useNodeRotation";

type ComponentNodeType = Node<ComponentNodeData, "component">;

function ComponentNodeComponent({
  id,
  data,
  selected,
}: NodeProps<ComponentNodeType>) {
  const [isHovered, setIsHovered] = useState(false);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  // The arrows sit exactly where a connected line's end-stub pill lives;
  // while the user is editing a line they would steal its handles.
  const editingEdge = useCanvasStore((s) =>
    s.selectedEdgeIds.some((eid) => {
      const e = s.edges.find((x) => x.id === eid);
      return !!e && (e.source === id || e.target === id);
    }),
  );
  const isSingleSelect = selected && selectedNodeIds.length === 1;
  const { isFormatPainting, pasteStyle } = useFormatPainter();

  const {
    nodeRef,
    handleRotatePointerDown,
    handleRotatePointerMove,
    handleRotatePointerUp,
  } = useNodeRotation(id, data);

  const nodeW = 160;
  const nodeH = 60;

  return (
    <div
      ref={nodeRef}
      className={cn("h-full w-full", isFormatPainting && "cursor-crosshair")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isFormatPainting ? () => pasteStyle(id) : undefined}
    >
      {/* Mounted only on the single selected node: it subscribes to the
          canvas store, and one instance per node re-rendered every node on
          every drag frame. */}
      {isSingleSelect && <NodeActionToolbar nodeId={id} isVisible />}

      {(selected || isHovered) && !editingEdge && (
        <QuickConnectOverlay
          sourceId={id}
          sourceType={data.type}
          nodeWidth={nodeW}
          nodeHeight={nodeH}
        />
      )}

      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineClassName="!border-blue-500"
        handleClassName="!bg-blue-500 !border-white"
      />

      <ComponentNodeHandles interfaces={data.interfaces} />

      {selected && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white cursor-grab shadow-sm z-10 hover:bg-blue-600 transition-colors"
          title="Drag to rotate"
          aria-label="Rotate node"
          onPointerDown={handleRotatePointerDown}
          onPointerMove={handleRotatePointerMove}
          onPointerUp={handleRotatePointerUp}
        >
          <RotateCcw className="h-3 w-3 pointer-events-none" />
        </div>
      )}

      <ComponentNodeInner data={data} selected={selected} />
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeComponent);
