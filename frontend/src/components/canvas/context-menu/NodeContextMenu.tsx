"use client";

/**
 * NodeContextMenu — menu items rendered when right-clicking a node (component or boundary).
 *
 * Receives all handlers as props from the parent CanvasContextMenu orchestrator.
 */

import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import type { CanvasNode } from "@/stores/canvas";
import type { ComponentNodeData } from "@/types/canvas";

interface NodeContextMenuProps {
  nodeId: string;
  nodeType: "component" | "boundary";
  nodes: CanvasNode[];
  isFormatPainting: boolean;
  canMatchSize: boolean;
  onEditProperties: () => void;
  onAddThreat: () => void;
  onBrowseCatalog: () => void;
  onSuggestThreats: () => void;
  onAnalyzeJustThisComponent: () => void;
  onDuplicate: () => void;
  onUngroupBoundary: () => void;
  onSelectSameType: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  onMatchSize: (mode: "width" | "height" | "both") => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}

export function NodeContextMenu({
  nodeId,
  nodeType,
  nodes,
  isFormatPainting,
  canMatchSize,
  onEditProperties,
  onAddThreat,
  onBrowseCatalog,
  onSuggestThreats,
  onAnalyzeJustThisComponent,
  onDuplicate,
  onUngroupBoundary,
  onSelectSameType,
  onDelete,
  onToggleLock,
  onCopyStyle,
  onPasteStyle,
  onMatchSize,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
}: NodeContextMenuProps) {
  const node = nodes.find((n) => n.id === nodeId);
  const isLocked = !!node?.data?.locked;

  // Compute "Select All <type>" label for component nodes
  const selectSameTypeLabel = (() => {
    if (nodeType !== "component") return null;
    const type = node ? (node.data as ComponentNodeData).type : null;
    if (!type) return null;
    const label = type
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^(aws|gcp|azure) /, (m) => m.toUpperCase());
    return label;
  })();

  return (
    <>
      <ContextMenuItem onClick={onEditProperties}>
        Edit Properties
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onAddThreat}>Add Threat</ContextMenuItem>
      <ContextMenuItem onClick={onBrowseCatalog}>
        Browse Threat Catalog
      </ContextMenuItem>
      <ContextMenuItem onClick={onSuggestThreats}>
        Suggest Threats (AI)
      </ContextMenuItem>
      {nodeType === "component" && (
        <ContextMenuItem onClick={onAnalyzeJustThisComponent}>
          Re-analyze just this component
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onDuplicate}>
        Duplicate
        <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
      </ContextMenuItem>

      {nodeType === "boundary" && (
        <ContextMenuItem onClick={onUngroupBoundary}>
          Ungroup Boundary
          <ContextMenuShortcut>Ctrl+Shift+G</ContextMenuShortcut>
        </ContextMenuItem>
      )}

      {selectSameTypeLabel && (
        <ContextMenuItem onClick={onSelectSameType}>
          Select All {selectSameTypeLabel}
        </ContextMenuItem>
      )}

      <ContextMenuItem
        onClick={onDelete}
        className="text-red-600 focus:text-red-600"
      >
        Delete
        <ContextMenuShortcut>Del</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onToggleLock}>
        {isLocked ? "Unlock Node" : "Lock Node"}
      </ContextMenuItem>

      <ContextMenuItem onClick={onCopyStyle}>Copy Style</ContextMenuItem>

      {isFormatPainting && (
        <ContextMenuItem onClick={onPasteStyle}>Paste Style</ContextMenuItem>
      )}

      {canMatchSize && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Match Size</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-36">
            <ContextMenuItem onClick={() => onMatchSize("width")}>
              Match Width
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onMatchSize("height")}>
              Match Height
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onMatchSize("both")}>
              Match Both
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onBringToFront}>
        Bring to Front
        <ContextMenuShortcut>Ctrl+Shift+]</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onSendToBack}>
        Send to Back
        <ContextMenuShortcut>Ctrl+Shift+[</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onBringForward}>
        Bring Forward
        <ContextMenuShortcut>Ctrl+]</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onSendBackward}>
        Send Backward
        <ContextMenuShortcut>Ctrl+[</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );
}
