"use client";

/**
 * LayersPanel - Named canvas layers for organizing and controlling node visibility/lock.
 *
 * Floating panel showing all layers with eye/lock toggles and Add Layer button.
 * Layers are session-only (not persisted to server).
 */
import { useState, useRef, useCallback } from "react";
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas";
import type { CanvasLayer } from "@/stores/canvas/types";

interface LayerRowProps {
  layer: CanvasLayer;
  nodeCount: number;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function LayerRow({
  layer,
  nodeCount,
  onToggleVisible,
  onToggleLocked,
  onRename,
  onDelete,
}: LayerRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(layer.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [layer.name]);

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== layer.name) onRename(trimmed);
    setEditing(false);
  }, [draft, layer.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") setEditing(false);
    },
    [commitEdit],
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors",
        !layer.visible && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={layer.visible ? "Hide layer" : "Show layer"}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {layer.visible ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={onToggleLocked}
        aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {layer.locked ? (
          <Lock className="h-3.5 w-3.5" />
        ) : (
          <Unlock className="h-3.5 w-3.5" />
        )}
      </button>

      {editing ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="h-5 text-xs px-1 py-0 flex-1"
          autoFocus
        />
      ) : (
        <button
          type="button"
          className="flex-1 text-left text-xs truncate"
          onDoubleClick={startEdit}
          title="Double-click to rename"
        >
          {layer.name}
        </button>
      )}

      <span className="text-[10px] text-muted-foreground shrink-0">
        {nodeCount}
      </span>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete layer"
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

interface LayersPanelProps {
  open: boolean;
  onClose: () => void;
}

export function LayersPanel({ open, onClose }: LayersPanelProps) {
  const layers = useCanvasStore((s) => s.layers);
  const nodeLayerMap = useCanvasStore((s) => s.nodeLayerMap);
  const addLayer = useCanvasStore((s) => s.addLayer);
  const deleteLayer = useCanvasStore((s) => s.deleteLayer);
  const setLayerVisibility = useCanvasStore((s) => s.setLayerVisibility);
  const setLayerLocked = useCanvasStore((s) => s.setLayerLocked);
  const renameLayer = useCanvasStore((s) => s.renameLayer);

  const nodeCountForLayer = useCallback(
    (layerId: string) =>
      Object.values(nodeLayerMap).filter((id) => id === layerId).length,
    [nodeLayerMap],
  );

  if (!open) return null;

  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg w-52 flex flex-col max-h-80">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold">Layers</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close layers panel"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto p-1">
        {layers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4 px-2">
            No layers yet. Add a layer to organize nodes.
          </p>
        ) : (
          layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              nodeCount={nodeCountForLayer(layer.id)}
              onToggleVisible={() =>
                setLayerVisibility(layer.id, !layer.visible)
              }
              onToggleLocked={() => setLayerLocked(layer.id, !layer.locked)}
              onRename={(name) => renameLayer(layer.id, name)}
              onDelete={() => deleteLayer(layer.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs gap-1.5"
          onClick={() => addLayer()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Layer
        </Button>
      </div>
    </div>
  );
}
