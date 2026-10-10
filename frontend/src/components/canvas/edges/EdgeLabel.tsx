"use client";

import { memo, useState, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas";
import type { ConnectionData } from "@/types/canvas";
import { protocolDisplay, authDisplay } from "./edge-label-constants";
import { EdgeLabelChip } from "./EdgeLabelChip";
import { EdgeLabelTooltip } from "./EdgeLabelTooltip";
import { EdgeLabelInlineEdit } from "./EdgeLabelInlineEdit";
import { useEdgeLabelInteraction } from "./useEdgeLabelInteraction";
import { EdgeLabelAffordance } from "./EdgeLabelAffordance";

interface EdgeLabelProps {
  x: number;
  y: number;
  data: ConnectionData | undefined;
  selected?: boolean;
  securityLevel: "high" | "medium" | "low" | "critical";
  threatCount: number;
  edgeId?: string;
  onLabelChange?: (label: string) => void;
  onLabelDrag?: (flowPos: { x: number; y: number }) => void;
  /** Increment to open the inline editor from outside (double-click on the line). */
  editRequest?: number;
}

function EdgeLabelComponent({
  x,
  y,
  data,
  selected,
  securityLevel,
  threatCount,
  edgeId,
  onLabelChange,
  onLabelDrag,
  editRequest,
}: EdgeLabelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const securityOverlay = useCanvasStore((s) => s.securityOverlay);
  const canEdit = !!(edgeId && onLabelChange);

  const {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startLabelDrag,
    startEdit,
    commitEdit,
    cancelEdit,
  } = useEdgeLabelInteraction({
    canEdit,
    currentLabel: data?.label,
    onLabelChange,
    onLabelDrag,
  });

  useEffect(() => {
    if (editRequest) startEdit();
    // Only react to a NEW request; startEdit's identity changes with the label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest]);

  const protocol = data?.protocol ? protocolDisplay[data.protocol] : null;
  const auth = data?.authentication ? authDisplay[data.authentication] : null;
  const dataTypes = data?.dataClassifications ?? [];
  const encrypted = data?.encrypted ?? false;
  const offsetY =
    data?.labelOffset === "above"
      ? -14
      : data?.labelOffset === "below"
        ? 14
        : 0;
  const sizeClass =
    data?.labelSize === "xs"
      ? "text-[9px]"
      : data?.labelSize === "md"
        ? "text-sm"
        : data?.labelSize === "lg"
          ? "text-base"
          : "text-xs";
  const wrapperStyle = {
    transform: `translate(-50%, -50%) translate(${x}px, ${y + offsetY}px)`,
  };

  if (isEditing) {
    return (
      <EdgeLabelInlineEdit
        wrapperStyle={wrapperStyle}
        inputRef={inputRef}
        editValue={editValue}
        onChange={setEditValue}
        onCommit={commitEdit}
        onCancel={cancelEdit}
      />
    );
  }

  const hasSecurityInfo = !!(protocol || auth);
  const securityPillVisible = !!(
    hasSecurityInfo &&
    (securityOverlay || isHovered || selected)
  );
  const missingSecurityHint = !!(
    selected &&
    canEdit &&
    !data?.protocol &&
    !data?.authentication
  );
  const hasContent = !!(
    data?.label ||
    securityPillVisible ||
    missingSecurityHint ||
    threatCount > 0
  );

  if (!hasContent) {
    if (!selected || !canEdit) return null;
    return (
      <EdgeLabelAffordance
        wrapperStyle={wrapperStyle}
        onStartEdit={startEdit}
      />
    );
  }

  return (
    <div
      className="absolute pointer-events-auto nodrag nopan"
      style={wrapperStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={startEdit}
    >
      <EdgeLabelChip
        sizeClass={sizeClass}
        securityPillVisible={securityPillVisible}
        selected={selected}
        canEdit={canEdit}
        protocol={protocol}
        auth={auth}
        label={data?.label}
        missingSecurityHint={missingSecurityHint}
        threatCount={threatCount}
        onLabelDrag={onLabelDrag}
        onStartLabelDrag={startLabelDrag}
      />
      {isHovered && (
        <EdgeLabelTooltip
          data={data}
          protocol={protocol}
          auth={auth}
          encrypted={encrypted}
          dataTypes={dataTypes}
          threatCount={threatCount}
          securityLevel={securityLevel}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

export const EdgeLabel = memo(EdgeLabelComponent);
