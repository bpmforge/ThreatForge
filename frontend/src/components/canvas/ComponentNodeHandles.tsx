"use client";

import { useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { ComponentInterface, InterfacePosition } from "@/types/canvas";

const positionMap: Record<InterfacePosition, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

function getHandleOffset(index: number, total: number): string {
  if (total === 1) return "50%";
  const step = 80 / (total + 1);
  return `${10 + step * (index + 1)}%`;
}

const defaultHandleCls =
  "w-2.5 h-2.5 !bg-muted-foreground/60 !border-background hover:!bg-blue-500 transition-colors";

interface ComponentNodeHandlesProps {
  interfaces?: ComponentInterface[];
}

export function ComponentNodeHandles({
  interfaces,
}: ComponentNodeHandlesProps) {
  const interfacesByPosition = useMemo(() => {
    if (!interfaces?.length) return null;
    const grouped: Record<InterfacePosition, ComponentInterface[]> = {
      left: [],
      right: [],
      top: [],
      bottom: [],
    };
    interfaces.forEach((iface) => grouped[iface.position].push(iface));
    return grouped;
  }, [interfaces]);

  if (!interfaces?.length || !interfacesByPosition) {
    return (
      <>
        <Handle
          id="handle-top"
          type="target"
          position={Position.Top}
          className={defaultHandleCls}
        />
        <Handle
          id="handle-top-s"
          type="source"
          position={Position.Top}
          className={defaultHandleCls}
        />
        {/* Target BEFORE source at every position so the SOURCE handle is
            the one on top (last painted) and receives the pointerdown. With
            the target on top, dragging out of a node's right side started
            from the target handle and React Flow created the edge
            REVERSED (drop node → dragged node) — wrong data-flow direction. */}
        <Handle
          id="handle-right-t"
          type="target"
          position={Position.Right}
          className={defaultHandleCls}
        />
        <Handle
          id="handle-right"
          type="source"
          position={Position.Right}
          className={defaultHandleCls}
        />
        <Handle
          id="handle-bottom"
          type="target"
          position={Position.Bottom}
          className={defaultHandleCls}
        />
        <Handle
          id="handle-bottom-s"
          type="source"
          position={Position.Bottom}
          className={defaultHandleCls}
        />
        <Handle
          id="handle-left"
          type="target"
          position={Position.Left}
          className={defaultHandleCls}
        />
        <Handle
          id="handle-left-s"
          type="source"
          position={Position.Left}
          className={defaultHandleCls}
        />
      </>
    );
  }

  return (
    <>
      {interfaces.flatMap((iface) => {
        const group = interfacesByPosition[iface.position];
        const offset = getHandleOffset(group.indexOf(iface), group.length);
        const isHorizontal =
          iface.position === "left" || iface.position === "right";
        const handleStyle = isHorizontal ? { top: offset } : { left: offset };
        const tooltip = `${iface.name}${iface.port ? ` :${iface.port}` : ""}`;
        const cls = "w-3 h-3 bg-muted-foreground border-2 border-background";

        return [
          <Handle
            key={`${iface.id}-target`}
            id={`${iface.id}-target`}
            type="target"
            position={positionMap[iface.position]}
            className={cls}
            style={handleStyle}
            title={tooltip}
          />,
          <Handle
            key={`${iface.id}-source`}
            id={`${iface.id}-source`}
            type="source"
            position={positionMap[iface.position]}
            className={cls}
            style={handleStyle}
            title={tooltip}
          />,
        ];
      })}
    </>
  );
}
