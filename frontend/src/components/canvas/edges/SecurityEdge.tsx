"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { ConnectionData } from "@/types/canvas";
import { EdgeLabel } from "./EdgeLabel";
import { EdgeEndLabel, END_LABEL_T, endLabelSlot } from "./EdgeEndLabel";
import { closestT, pointAt } from "./path-segments";
import { WaypointHandles } from "./WaypointHandles";
import { EndpointMarkerDefs, endpointUrl } from "./endpoints";
import { useSecurityEdge } from "./useSecurityEdge";
import { useCanvasStore } from "@/stores/canvas";

type SecurityEdgeType = Edge<ConnectionData, "security">;

function SecurityEdgeComponent({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<SecurityEdgeType>) {
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  // Pointer is over this line (its 20px hit band). Lucid/draw.io brighten a
  // line on hover so the user can see what a click will select.
  const [hovered, setHovered] = useState(false);
  // Bumped by a double-click on the line: the label opens for editing (or is
  // created) at the double-clicked spot — the Lucid/draw.io "double-click a
  // line to add text" gesture. Waypoint reset stays in the context menu.
  const [labelEditRequest, setLabelEditRequest] = useState(0);
  const [startEditRequest, setStartEditRequest] = useState(0);
  const [endEditRequest, setEndEditRequest] = useState(0);
  const { screenToFlowPosition } = useReactFlow();

  const {
    isHighlighted,
    isDimmed,
    setDraggingCorners,
    transientPill,
    setTransientPill,
    corners,
    segments,
    edgePath,
    finalPath,
    displayPath,
    effectiveLabelPos,
    collisionDodgeY,
    style,
    security,
    threatCount,
    handleLabelChange,
    handleWaypointUpdate,
    handleWaypointCommit,
    handleHitPathMouseMove,
    handleHitPathMouseLeave,
    handleAddWaypoint,
    handleLabelDrag,
  } = useSecurityEdge({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  });

  return (
    <>
      <EndpointMarkerDefs />

      {data?.lineVariant === "double" && (
        <path
          d={displayPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={(style.strokeWidth ?? 2) + 4}
          strokeOpacity={isDimmed ? 0.2 : 1}
          className={cn(
            "pointer-events-none",
            selected ? "stroke-blue-500" : "",
          )}
        />
      )}

      <BaseEdge
        id={id}
        path={displayPath}
        // React Flow's own 20px interaction path would sit ON TOP of the hit
        // path below and swallow hover / double-click / Alt-click, so it is
        // disabled and our hit path (rendered after the line) takes over.
        interactionWidth={0}
        markerEnd={endpointUrl(data?.endpoint?.end, "end") ?? markerEnd}
        markerStart={endpointUrl(data?.endpoint?.start, "start")}
        style={{
          ...style,
          strokeWidth:
            data?.lineVariant === "double"
              ? 1
              : isHighlighted || hovered
                ? style.strokeWidth + 1
                : style.strokeWidth,
          opacity: isDimmed ? 0.2 : 1,
          // Inline `stroke` beats the Tailwind classes below, so the
          // selected / hovered colours have to be set here too.
          stroke:
            data?.lineVariant === "double"
              ? "var(--background, white)"
              : selected
                ? "#3b82f6"
                : isHighlighted || hovered
                  ? "#60a5fa"
                  : style.stroke,
          transition: "stroke 0.2s, stroke-width 0.15s, opacity 0.15s",
        }}
        className={cn(
          data?.lineVariant !== "double" && selected && "stroke-blue-500",
          data?.lineVariant !== "double" &&
            (isHighlighted || hovered) &&
            !selected &&
            "stroke-blue-400",
        )}
      />

      {(selected || hovered) && (
        <path
          d={displayPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={style.strokeWidth + 4}
          strokeOpacity={selected ? 0.2 : 0.12}
          className="pointer-events-none"
        />
      )}

      <path
        d={finalPath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "crosshair", pointerEvents: "stroke" }}
        onClick={handleAddWaypoint}
        onDoubleClick={(e) => {
          e.stopPropagation();
          // Near an end → that end's label; otherwise the mid label.
          const t = closestT(
            edgePath,
            screenToFlowPosition({ x: e.clientX, y: e.clientY }),
          );
          const slot = endLabelSlot(t);
          if (slot === "start") setStartEditRequest((n) => n + 1);
          else if (slot === "end") setEndEditRequest((n) => n + 1);
          else setLabelEditRequest((n) => n + 1);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseMove={handleHitPathMouseMove}
        onMouseLeave={() => {
          setHovered(false);
          handleHitPathMouseLeave();
        }}
      />

      {selected && segments.length > 0 && (
        <WaypointHandles
          corners={corners}
          segments={segments}
          onDoubleClick={() => setLabelEditRequest((n) => n + 1)}
          endpoints={{
            source: { x: sourceX, y: sourceY },
            target: { x: targetX, y: targetY },
          }}
          transientPill={transientPill}
          onUpdate={handleWaypointUpdate}
          onCommit={handleWaypointCommit}
          onInsertWaypoint={(insertIndex, positions) => {
            const current: Array<{ x: number; y: number; manual?: boolean }> =
              data?.waypoints ?? corners;
            const next = [...current];
            next.splice(
              insertIndex,
              0,
              ...positions.map((p) => ({ x: p.x, y: p.y, manual: true })),
            );
            updateEdgeData(id, { waypoints: next });
            setDraggingCorners(null);
            setTransientPill(null);
          }}
        />
      )}

      <EdgeLabelRenderer>
        {(() => {
          const ps = pointAt(edgePath, END_LABEL_T.start);
          const pe = pointAt(edgePath, END_LABEL_T.end);
          return (
            <>
              <EdgeEndLabel
                x={ps.x}
                y={ps.y}
                value={data?.startLabel}
                selected={!!selected}
                editRequest={startEditRequest}
                onChange={(v) =>
                  updateEdgeData(id, { startLabel: v || undefined })
                }
              />
              <EdgeEndLabel
                x={pe.x}
                y={pe.y}
                value={data?.endLabel}
                selected={!!selected}
                editRequest={endEditRequest}
                onChange={(v) =>
                  updateEdgeData(id, { endLabel: v || undefined })
                }
              />
            </>
          );
        })()}
        <EdgeLabel
          x={effectiveLabelPos.x}
          y={effectiveLabelPos.y + collisionDodgeY}
          data={data}
          selected={selected}
          securityLevel={security.level}
          threatCount={threatCount}
          edgeId={id}
          editRequest={labelEditRequest}
          onLabelChange={handleLabelChange}
          onLabelDrag={handleLabelDrag}
        />
      </EdgeLabelRenderer>
    </>
  );
}

export const SecurityEdge = memo(SecurityEdgeComponent);
