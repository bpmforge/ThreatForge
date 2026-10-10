"use client";

/**
 * EdgeContextMenu — menu items rendered when right-clicking an edge (connection).
 *
 * Receives all handlers as props from the parent CanvasContextMenu orchestrator.
 *
 * There is no "Convert to…" line-style submenu: useSecurityEdge pins every
 * edge to the orthogonal router, so every style would render the same.
 */

import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";

interface EdgeContextMenuProps {
  onEditProperties: () => void;
  onResetLine: () => void;
  /** Remove the bend nearest the right-click (enabled only when one is close). */
  onRemoveBend?: () => void;
  canRemoveBend?: boolean;
  onReverseEdge: () => void;
  onAddThreat: () => void;
  onDelete: () => void;
}

export function EdgeContextMenu({
  onEditProperties,
  onResetLine,
  onRemoveBend,
  canRemoveBend,
  onReverseEdge,
  onAddThreat,
  onDelete,
}: EdgeContextMenuProps) {
  return (
    <>
      <ContextMenuItem onClick={onEditProperties}>
        Edit Properties
      </ContextMenuItem>

      <ContextMenuSeparator />

      {onRemoveBend && (
        <ContextMenuItem onClick={onRemoveBend} disabled={!canRemoveBend}>
          Remove bend
        </ContextMenuItem>
      )}

      <ContextMenuItem onClick={onResetLine}>Reset line</ContextMenuItem>

      <ContextMenuItem onClick={onReverseEdge}>
        Reverse direction
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onAddThreat}>Add Threat</ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        onClick={onDelete}
        className="text-red-600 focus:text-red-600"
      >
        Delete
        <ContextMenuShortcut>Del</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );
}
