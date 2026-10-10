"use client";

/**
 * SwimlaneNode - Named horizontal lane container for organizing diagram nodes.
 *
 * RF wrapper around SwimlaneNodeInner: owns the NodeResizer and reads the live
 * child count from the store. The pure inner renders the header and lane
 * columns without React Flow context.
 */
import { memo } from "react";
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import {
  SwimlaneNodeInner,
  SWIMLANE_HEADER_HEIGHT,
  SWIMLANE_MIN_LANE_WIDTH,
} from "./SwimlaneNodeInner";
import type { SwimlaneNodeData } from "@/types/canvas";

type SwimlaneNodeType = Node<SwimlaneNodeData, "swimlane">;

function SwimlaneNodeComponent({
  id,
  data,
  selected,
}: NodeProps<SwimlaneNodeType>) {
  const childCount = useCanvasStore(
    (s) => s.nodes.filter((n) => n.parentId === id).length,
  );

  const laneCount = data.lanes?.length || 2;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={laneCount * SWIMLANE_MIN_LANE_WIDTH + 2}
        minHeight={SWIMLANE_HEADER_HEIGHT + 80}
        handleStyle={{ width: 8, height: 8 }}
      />
      <SwimlaneNodeInner
        data={data}
        selected={selected}
        childCount={childCount}
      />
    </>
  );
}

export const SwimlaneNode = memo(SwimlaneNodeComponent);
