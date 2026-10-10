"use client";

/**
 * CollaboratorCursors - Displays remote collaborators' cursors on the canvas.
 *
 * Shows cursor positions and user names for all connected collaborators.
 */
import { useMemo } from "react";
import { useReactFlow, Panel } from "@xyflow/react";
import type { Collaborator } from "../types";

interface CollaboratorCursorsProps {
  collaborators: Collaborator[];
}

/** Individual cursor display for a collaborator */
function CollaboratorCursor({
  collaborator,
  screenPosition,
}: {
  collaborator: Collaborator;
  screenPosition: { x: number; y: number } | null;
}) {
  if (!screenPosition) return null;

  return (
    <div
      className="absolute pointer-events-none z-50 transition-transform duration-75"
      style={{
        transform: `translate(${screenPosition.x}px, ${screenPosition.y}px)`,
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
      >
        <path
          d="M5.5 3.21V20.79a1 1 0 001.65.77l4.63-3.95a1 1 0 01.65-.24h6.07a1 1 0 00.77-1.64L6.27 2.44a1 1 0 00-1.77.77z"
          fill={collaborator.color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      {/* Name label */}
      <div
        className="ml-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.name}
      </div>
    </div>
  );
}

/** Collaborator list badge for panel */
function CollaboratorBadge({ collaborator }: { collaborator: Collaborator }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm"
      style={{ backgroundColor: collaborator.color }}
      title={collaborator.name}
    >
      {collaborator.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function CollaboratorCursors({
  collaborators,
}: CollaboratorCursorsProps) {
  const { flowToScreenPosition } = useReactFlow();

  // Convert collaborator cursor positions from flow to screen coordinates
  const cursorsWithScreenPos = useMemo(() => {
    return collaborators
      .filter((c) => c.cursor)
      .map((collaborator) => ({
        collaborator,
        screenPosition: collaborator.cursor
          ? flowToScreenPosition(collaborator.cursor)
          : null,
      }));
  }, [collaborators, flowToScreenPosition]);

  return (
    <>
      {/* Render cursor overlays */}
      {cursorsWithScreenPos.map(({ collaborator, screenPosition }) => (
        <CollaboratorCursor
          key={collaborator.id}
          collaborator={collaborator}
          screenPosition={screenPosition}
        />
      ))}

      {/* Collaborators panel */}
      {collaborators.length > 0 && (
        <Panel position="top-right" className="flex items-center gap-1">
          <div className="bg-background/90 px-2 py-1 rounded-lg shadow-sm flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {collaborators.length} online
            </span>
            <div className="flex -space-x-2">
              {collaborators.slice(0, 5).map((collaborator) => (
                <CollaboratorBadge
                  key={collaborator.id}
                  collaborator={collaborator}
                />
              ))}
              {collaborators.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
                  +{collaborators.length - 5}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
