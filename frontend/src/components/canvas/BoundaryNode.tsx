"use client";

/**
 * BoundaryNode - Custom React Flow node for trust boundaries.
 *
 * RF wrapper around BoundaryNodeInner: owns the NodeResizer and the
 * store-derived values (child count, nesting depth, collapse toggle) that the
 * pure inner renders. The visual lives in BoundaryNodeInner, which needs no
 * React Flow context.
 */
import { memo, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvas";
import { minBoundarySize } from "@/stores/canvas/geometry";
import { BoundaryNodeInner } from "./BoundaryNodeInner";
import type { BoundaryNodeData } from "@/types/canvas";

type BoundaryNodeType = Node<BoundaryNodeData, "boundary">;

/** How many boundary ancestors this boundary has, counting itself. */
function boundaryNestingDepth(
  nodes: { id: string; type?: string; parentId?: string }[],
  id: string,
): number {
  let depth = 1;
  let currentNode = nodes.find((n) => n.id === id);
  while (currentNode?.parentId) {
    const parentId: string = currentNode.parentId;
    const parent = nodes.find((n) => n.id === parentId);
    if (parent?.type !== "boundary") break;
    depth++;
    currentNode = parent;
  }
  return depth;
}

function BoundaryNodeComponent({
  id,
  data,
  selected,
}: NodeProps<BoundaryNodeType>) {
  const toggleCollapse = useCanvasStore((s) => s.toggleBoundaryCollapse);
  const adoptContainedNodes = useCanvasStore((s) => s.adoptContainedNodes);
  const isCollapsed = data.collapsed ?? false;

  const handleCollapseToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleCollapse(id);
    },
    [id, toggleCollapse],
  );

  // Select only the values derived from this boundary's children (and its
  // ancestry), compared shallowly: subscribing to the whole nodes array
  // re-rendered every boundary on every drag frame of any node.
  const { childCount, minWidth, minHeight, nestingDepth } = useCanvasStore(
    useShallow((s) => {
      const children = s.nodes.filter((n) => n.parentId === id);
      // A boundary can never be resized smaller than its contents: every
      // child keeps BOUNDARY_INNER_PAD of clearance from the interior edges.
      const minSize = minBoundarySize(children);
      return {
        childCount: children.length,
        minWidth: minSize.width,
        minHeight: minSize.height,
        nestingDepth: boundaryNestingDepth(s.nodes, id),
      };
    }),
  );

  return (
    <>
      <NodeResizer
        minWidth={minWidth}
        minHeight={isCollapsed ? 40 : minHeight}
        // Resizing over a component pulls it in (fully, with clearance)
        // rather than leaving it half inside the zone.
        onResizeEnd={() => adoptContainedNodes(id)}
        isVisible={selected && !isCollapsed}
        lineClassName="border-blue-400"
        handleClassName="w-3 h-3 bg-white border-2 border-blue-400 rounded"
      />
      <BoundaryNodeInner
        data={data}
        selected={selected}
        childCount={childCount}
        nestingDepth={nestingDepth}
        onToggleCollapse={handleCollapseToggle}
      />
    </>
  );
}

export const BoundaryNode = memo(BoundaryNodeComponent);
