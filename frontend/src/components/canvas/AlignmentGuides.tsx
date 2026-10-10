"use client";

import { useStore } from "@xyflow/react";
import type { GuideLine } from "@/hooks/useAlignmentGuides";

interface AlignmentGuidesProps {
  guides: GuideLine[];
}

export function AlignmentGuides({ guides }: AlignmentGuidesProps) {
  const transform = useStore((s) => s.transform);

  if (guides.length === 0) return null;

  const [tx, ty, tz] = transform;

  const toScreen = (x: number, y: number) => ({
    x: x * tz + tx,
    y: y * tz + ty,
  });

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      {guides.map((g, i) => {
        const s1 = toScreen(g.x1, g.y1);
        const s2 = toScreen(g.x2, g.y2);
        return (
          <line
            key={i}
            x1={s1.x}
            y1={s1.y}
            x2={s2.x}
            y2={s2.y}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4,3"
            strokeOpacity={0.8}
          />
        );
      })}
    </svg>
  );
}
