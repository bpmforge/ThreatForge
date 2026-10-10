/**
 * SelectionHighlights - Shows which nodes other collaborators have selected.
 *
 * Renders colored borders around nodes that remote users have selected.
 */
"use client";

import { useMemo } from "react";
import { useReactFlow, useNodes } from "@xyflow/react";
import type { Collaborator } from "../types";

interface SelectionHighlightsProps {
  collaborators: Collaborator[];
}

interface SelectionBox {
  nodeId: string;
  color: string;
  userName: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SelectionHighlights({
  collaborators,
}: SelectionHighlightsProps) {
  const nodes = useNodes();
  const { flowToScreenPosition } = useReactFlow();

  const selectionBoxes = useMemo(() => {
    const boxes: SelectionBox[] = [];

    collaborators.forEach((collaborator) => {
      if (!collaborator.selection?.length) return;

      collaborator.selection.forEach((nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        const screenPos = flowToScreenPosition({
          x: node.position.x,
          y: node.position.y,
        });

        boxes.push({
          nodeId,
          color: collaborator.color,
          userName: collaborator.name,
          x: screenPos.x,
          y: screenPos.y,
          width: node.measured?.width ?? node.width ?? 150,
          height: node.measured?.height ?? node.height ?? 40,
        });
      });
    });

    return boxes;
  }, [collaborators, nodes, flowToScreenPosition]);

  if (selectionBoxes.length === 0) return null;

  return (
    <>
      {selectionBoxes.map((box) => (
        <div
          key={`${box.userName}-${box.nodeId}`}
          className="absolute pointer-events-none z-40"
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
            border: `2px solid ${box.color}`,
            borderRadius: "4px",
            boxShadow: `0 0 0 1px ${box.color}40`,
          }}
        >
          <span
            className="absolute -top-5 left-0 px-1 py-0.5 text-[10px] text-white rounded"
            style={{ backgroundColor: box.color }}
          >
            {box.userName}
          </span>
        </div>
      ))}
    </>
  );
}
