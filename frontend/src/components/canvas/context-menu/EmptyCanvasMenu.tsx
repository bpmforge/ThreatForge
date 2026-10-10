"use client";

/**
 * EmptyCanvasMenu — menu items rendered when right-clicking empty canvas background.
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
import type { ComponentType } from "@/types/canvas";

/** Component type categories for the Add Component submenu */
const componentCategories: {
  label: string;
  items: { type: ComponentType; label: string }[];
}[] = [
  {
    label: "Actors",
    items: [
      { type: "ACTOR", label: "User/Actor" },
      { type: "EXTERNAL_ENTITY", label: "External Entity" },
    ],
  },
  {
    label: "Processing",
    items: [
      { type: "PROCESS", label: "Process" },
      { type: "WEB_APP", label: "Web Application" },
      { type: "API", label: "API" },
    ],
  },
  {
    label: "Storage",
    items: [
      { type: "DATABASE", label: "Database" },
      { type: "FILE_SYSTEM", label: "File Storage" },
      { type: "CACHE", label: "Cache" },
      { type: "QUEUE", label: "Queue" },
    ],
  },
];

interface EmptyCanvasMenuProps {
  canCreateFromSelection: boolean;
  onAddComponent: (type: ComponentType) => void;
  onAddBoundary: () => void;
  onInsertSwimlane: () => void;
  onInsertLegend: () => void;
  onCreateBoundaryFromSelection: () => void;
  onSelectAll: () => void;
  onFitView: () => void;
}

export function EmptyCanvasMenu({
  canCreateFromSelection,
  onAddComponent,
  onAddBoundary,
  onInsertSwimlane,
  onInsertLegend,
  onCreateBoundaryFromSelection,
  onSelectAll,
  onFitView,
}: EmptyCanvasMenuProps) {
  return (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Add Component</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          {componentCategories.map((category) => (
            <ContextMenuSub key={category.label}>
              <ContextMenuSubTrigger>{category.label}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-40">
                {category.items.map((item) => (
                  <ContextMenuItem
                    key={item.type}
                    onClick={() => onAddComponent(item.type)}
                  >
                    {item.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuItem onClick={onAddBoundary}>
        Add Trust Boundary
      </ContextMenuItem>

      <ContextMenuItem onClick={onInsertSwimlane}>
        Insert Swimlane
      </ContextMenuItem>

      <ContextMenuItem onClick={onInsertLegend}>Insert Legend</ContextMenuItem>

      {canCreateFromSelection && (
        <ContextMenuItem onClick={onCreateBoundaryFromSelection}>
          Create Boundary from Selection
          <ContextMenuShortcut>Ctrl+G</ContextMenuShortcut>
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem onClick={onSelectAll}>
        Select All
        <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuItem onClick={onFitView}>
        Fit View
        <ContextMenuShortcut>Ctrl+0</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );
}
