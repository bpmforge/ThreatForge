"use client";

/**
 * NodeActionToolbar — Floating mini-toolbar for a selected single node.
 */
import { NodeToolbar, Position } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  Trash2,
  StickyNote,
  Sparkles,
  Lock,
  LockOpen,
  Paintbrush,
} from "lucide-react";
import { useCanvasWithHistory } from "@/hooks/useCanvasWithHistory";
import { useUIStore } from "@/stores/ui-store";
import { useCanvasStore } from "@/stores/canvas";
import { useFormatPainter } from "@/hooks/useFormatPainter";

interface NodeActionToolbarProps {
  nodeId: string;
  isVisible: boolean;
}

export function NodeActionToolbar({
  nodeId,
  isVisible,
}: NodeActionToolbarProps) {
  const { duplicateSelected, deleteSelected } = useCanvasWithHistory();
  const requestAddThreat = useUIStore((s) => s.requestAddThreat);
  const requestAISuggestions = useUIStore((s) => s.requestAISuggestions);
  const toggleNodeLock = useCanvasStore((s) => s.toggleNodeLock);
  const isLocked = useCanvasStore(
    (s) =>
      !!(s.nodes.find((n) => n.id === nodeId)?.data as { locked?: boolean })
        ?.locked,
  );
  const { activate: activatePainter } = useFormatPainter();

  return (
    <NodeToolbar isVisible={isVisible} position={Position.Top} offset={12}>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 bg-background border rounded-lg shadow-lg px-2 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={duplicateSelected}
                disabled={isLocked}
                aria-label="Duplicate node"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Duplicate (Ctrl+D)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => requestAddThreat(nodeId)}
                aria-label="Add threat"
              >
                <StickyNote className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Add threat
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={requestAISuggestions}
                aria-label="AI threat suggestions"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Suggest threats (AI)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => activatePainter(nodeId)}
                aria-label="Copy style (format painter)"
              >
                <Paintbrush className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Copy style
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => toggleNodeLock(nodeId)}
                aria-label={isLocked ? "Unlock node" : "Lock node"}
              >
                {isLocked ? (
                  <LockOpen className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isLocked ? "Unlock" : "Lock"} (prevents editing)
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={deleteSelected}
                disabled={isLocked}
                aria-label="Delete node"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Delete (Del)
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </NodeToolbar>
  );
}
