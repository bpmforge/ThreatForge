"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

interface UseEdgeLabelInteractionProps {
  canEdit: boolean;
  currentLabel: string | undefined;
  onLabelChange?: (label: string) => void;
  onLabelDrag?: (flowPos: { x: number; y: number }) => void;
}

export function useEdgeLabelInteraction({
  canEdit,
  currentLabel,
  onLabelChange,
  onLabelDrag,
}: UseEdgeLabelInteractionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const startLabelDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!onLabelDrag) return;
      e.stopPropagation();
      e.preventDefault();
      const onMove = (ev: MouseEvent) => {
        onLabelDrag(screenToFlowPosition({ x: ev.clientX, y: ev.clientY }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onLabelDrag, screenToFlowPosition],
  );

  const startEdit = useCallback(() => {
    if (!canEdit) return;
    setEditValue(currentLabel ?? "");
    setIsEditing(true);
  }, [canEdit, currentLabel]);

  const commitEdit = useCallback(() => {
    if (!canEdit) return;
    const trimmed = editValue.trim();
    if (trimmed !== (currentLabel ?? "")) onLabelChange!(trimmed);
    setIsEditing(false);
  }, [canEdit, editValue, currentLabel, onLabelChange]);

  const cancelEdit = useCallback(() => setIsEditing(false), []);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  return {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startLabelDrag,
    startEdit,
    commitEdit,
    cancelEdit,
  };
}
