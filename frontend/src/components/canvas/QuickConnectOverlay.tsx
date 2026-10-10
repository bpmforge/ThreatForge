"use client";

/**
 * QuickConnectOverlay — Lucid-style directional arrows on selected component nodes.
 *
 * Hover a selected node → 4 arrows appear at N/E/S/W edges.
 * Click an arrow → spawns a same-type node in that direction + auto-connects it.
 */
import { useCallback } from "react";
import { ArrowUp, ArrowRight, ArrowDown, ArrowLeft } from "lucide-react";
import { useCanvasStore } from "@/stores/canvas";
import { useCanvasWithHistory } from "@/hooks/useCanvasWithHistory";
import type { ComponentType } from "@/types/canvas";

interface QuickConnectOverlayProps {
  sourceId: string;
  sourceType: ComponentType;
  nodeWidth: number;
  nodeHeight: number;
}

const GAP = 60; // px between spawned node and source

const directions = [
  {
    key: "top",
    icon: ArrowUp,
    style: { top: -32, left: "50%", transform: "translateX(-50%)" },
    dx: (w: number) => -(w / 2),
    dy: (h: number) => -(h + GAP),
  },
  {
    key: "right",
    icon: ArrowRight,
    style: { right: -32, top: "50%", transform: "translateY(-50%)" },
    dx: (w: number) => w + GAP,
    dy: (h: number) => -(h / 2),
  },
  {
    key: "bottom",
    icon: ArrowDown,
    style: { bottom: -32, left: "50%", transform: "translateX(-50%)" },
    dx: (w: number) => -(w / 2),
    dy: () => GAP,
  },
  {
    key: "left",
    icon: ArrowLeft,
    style: { left: -32, top: "50%", transform: "translateY(-50%)" },
    dx: (w: number) => -(w + GAP),
    dy: (h: number) => -(h / 2),
  },
] as const;

export function QuickConnectOverlay({
  sourceId,
  sourceType,
  nodeWidth,
  nodeHeight,
}: QuickConnectOverlayProps) {
  const { addComponent } = useCanvasWithHistory();
  const addEdges = useCanvasStore((s) => s.addEdges);
  const nodes = useCanvasStore((s) => s.nodes);

  const handleSpawn = useCallback(
    (dx: (w: number) => number, dy: (h: number) => number) =>
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const source = nodes.find((n) => n.id === sourceId);
        if (!source) return;

        const newX = source.position.x + dx(nodeWidth);
        const newY = source.position.y + dy(nodeHeight);
        const newId = addComponent(sourceType, { x: newX, y: newY });

        addEdges([
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            source: sourceId,
            target: newId,
            type: "security",
            animated: false,
            data: { style: { lineStyle: "smoothstep" } },
          } as Parameters<typeof addEdges>[0][0],
        ]);
      },
    [
      sourceId,
      sourceType,
      nodeWidth,
      nodeHeight,
      nodes,
      addComponent,
      addEdges,
    ],
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
      className="nodrag nopan"
    >
      {directions.map(({ key, icon: Icon, style, dx, dy }) => (
        <button
          key={key}
          style={{ position: "absolute", pointerEvents: "all", ...style }}
          className="
            flex items-center justify-center w-6 h-6 rounded-full
            bg-blue-500 text-white shadow-md
            hover:bg-blue-600 hover:scale-110 active:scale-95
            transition-transform duration-100
            border-2 border-white
          "
          onMouseDown={handleSpawn(dx, dy)}
          title={`Add connected node (${key})`}
          aria-label={`Add connected node to the ${key}`}
        >
          <Icon className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
