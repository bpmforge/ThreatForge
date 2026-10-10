"use client";

/**
 * ContextMenu - Right-click context menu router for the canvas.
 *
 * Detects what was right-clicked and delegates to one of three sub-menus:
 * EmptyCanvasMenu | NodeContextMenu | EdgeContextMenu
 */
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCanvasStore } from "@/stores/canvas";
import { useUIStore } from "@/stores/ui-store";
import { EmptyCanvasMenu } from "./context-menu/EmptyCanvasMenu";
import { NodeContextMenu } from "./context-menu/NodeContextMenu";
import { EdgeContextMenu } from "./context-menu/EdgeContextMenu";
import { useContextMenuHandlers } from "./context-menu/useContextMenuHandlers";

interface ContextMenuProps {
  children: React.ReactNode;
}

type MenuContext =
  | { type: "canvas"; position: { x: number; y: number } }
  | { type: "node"; nodeId: string; nodeType: "component" | "boundary" }
  | { type: "edge"; edgeId: string; position: { x: number; y: number } }
  | null;

export function CanvasContextMenu({ children }: ContextMenuProps) {
  const [menuContext, setMenuContext] = useState<MenuContext>(null);

  const params = useParams();
  const modelId = params?.id as string | undefined;

  const nodes = useCanvasStore((s) => s.nodes);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const isFormatPainting = useUIStore((s) => s.isFormatPainting);

  const h = useContextMenuHandlers(menuContext, modelId);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;

      const nodeElement = target.closest(".react-flow__node");
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute("data-id");
        const node = nodes.find((n) => n.id === nodeId);
        if (node && nodeId) {
          setMenuContext({
            type: "node",
            nodeId,
            nodeType: node.type as "component" | "boundary",
          });
          if (!node.selected) setSelection([nodeId], []);
          return;
        }
      }

      const edgeElement = target.closest(".react-flow__edge");
      if (edgeElement) {
        const edgeId = edgeElement.getAttribute("data-id");
        if (edgeId) {
          setMenuContext({
            type: "edge",
            edgeId,
            position: { x: event.clientX, y: event.clientY },
          });
          setSelection([], [edgeId]);
          return;
        }
      }

      setMenuContext({
        type: "canvas",
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [nodes, setSelection],
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        <div className="w-full h-full">{children}</div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {menuContext?.type === "canvas" && (
          <EmptyCanvasMenu
            canCreateFromSelection={h.canCreateFromSelection}
            onAddComponent={h.handleAddComponent}
            onAddBoundary={h.handleAddBoundary}
            onInsertSwimlane={h.handleInsertSwimlane}
            onInsertLegend={h.handleInsertLegend}
            onCreateBoundaryFromSelection={h.createBoundaryFromSelection}
            onSelectAll={h.handleSelectAll}
            onFitView={h.handleFitView}
          />
        )}

        {menuContext?.type === "node" && (
          <NodeContextMenu
            nodeId={menuContext.nodeId}
            nodeType={menuContext.nodeType}
            nodes={h.nodes}
            isFormatPainting={isFormatPainting}
            canMatchSize={h.canMatchSize}
            onEditProperties={h.handleEditProperties}
            onAddThreat={h.handleAddThreat}
            onBrowseCatalog={h.handleBrowseCatalog}
            onSuggestThreats={h.handleSuggestThreats}
            onAnalyzeJustThisComponent={h.handleAnalyzeJustThisComponent}
            onDuplicate={h.duplicateSelected}
            onUngroupBoundary={h.handleUngroupBoundary}
            onSelectSameType={h.handleSelectSameType}
            onDelete={h.deleteSelected}
            onToggleLock={h.handleToggleLock}
            onCopyStyle={h.handleCopyStyle}
            onPasteStyle={h.handlePasteStyle}
            onMatchSize={h.handleMatchSize}
            onBringToFront={h.handleBringToFront}
            onSendToBack={h.handleSendToBack}
            onBringForward={h.handleBringForward}
            onSendBackward={h.handleSendBackward}
          />
        )}

        {menuContext?.type === "edge" && (
          <EdgeContextMenu
            onEditProperties={h.handleEditProperties}
            onResetLine={h.handleResetLine}
            onRemoveBend={h.handleRemoveBend}
            canRemoveBend={h.canRemoveBend}
            onReverseEdge={h.handleReverseEdge}
            onAddThreat={h.handleAddThreat}
            onDelete={h.deleteSelected}
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
