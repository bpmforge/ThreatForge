"use client";

/**
 * LegendNode - Auto-updating diagram legend.
 *
 * RF wrapper around LegendNodeInner: reads the canvas store live for the set
 * of unique component types on the canvas and hands them to the pure inner.
 */
import { memo } from "react";
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import { LegendNodeInner } from "./LegendNodeInner";
import type {
  LegendNodeData,
  ComponentNodeData,
  ComponentType,
} from "@/types/canvas";

type LegendNodeType = Node<LegendNodeData, "legend">;

function LegendNodeComponent({ selected }: NodeProps<LegendNodeType>) {
  // Selector returns a sorted string to keep the reference stable across renders.
  // Zustand compares by Object.is — a new array would always trigger a re-render loop.
  const typeKey = useCanvasStore((s) => {
    const seen = new Set<string>();
    for (const n of s.nodes) {
      if (n.type === "component") {
        seen.add((n.data as ComponentNodeData).type as string);
      }
    }
    return Array.from(seen).sort().join(",");
  });
  const uniqueTypes = typeKey ? (typeKey.split(",") as ComponentType[]) : [];

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={80}
        lineClassName="border-blue-400"
        handleClassName="w-3 h-3 bg-white border-2 border-blue-400 rounded"
      />
      <LegendNodeInner uniqueTypes={uniqueTypes} />
    </>
  );
}

export const LegendNode = memo(LegendNodeComponent);
