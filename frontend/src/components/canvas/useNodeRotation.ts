"use client";

import { useCallback, useRef } from "react";
import type { ComponentNodeData } from "@/types/canvas";
import { useCanvasStore } from "@/stores/canvas";

export function useNodeRotation(id: string, data: ComponentNodeData) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodeRef = useRef<HTMLDivElement>(null);
  const rotateStartRef = useRef<{
    startAngle: number;
    initRotation: number;
    nodeRect: DOMRect;
  } | null>(null);

  const handleRotatePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = nodeRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle =
        (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      rotateStartRef.current = {
        startAngle,
        initRotation: data.style?.rotation ?? 0,
        nodeRect: rect,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [data.style?.rotation],
  );

  const handleRotatePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!rotateStartRef.current) return;
      e.stopPropagation();
      const rect = rotateStartRef.current.nodeRect;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const currentAngle =
        (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      const delta = currentAngle - rotateStartRef.current.startAngle;
      const newRotation =
        (((rotateStartRef.current.initRotation + delta) % 360) + 360) % 360;
      updateNodeData(id, {
        style: { ...(data.style ?? {}), rotation: Math.round(newRotation) },
      });
    },
    [id, data.style, updateNodeData],
  );

  const handleRotatePointerUp = useCallback((e: React.PointerEvent) => {
    if (!rotateStartRef.current) return;
    e.stopPropagation();
    rotateStartRef.current = null;
  }, []);

  return {
    nodeRef,
    handleRotatePointerDown,
    handleRotatePointerMove,
    handleRotatePointerUp,
  };
}
