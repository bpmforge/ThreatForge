"use client";

/**
 * CanvasToolbar — top-left info panel with node/edge counts and toggle buttons.
 *
 * Extracted from ThreatModelCanvas to keep the orchestrating component ≤300 lines.
 */

import { Panel } from "@xyflow/react";

interface CanvasToolbarProps {
  nodeCount: number;
  edgeCount: number;
  isCollaborating: boolean;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  securityOverlay: boolean;
  onToggleSecurityOverlay: () => void;
  onShowHelp: () => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
}

export function CanvasToolbar({
  nodeCount,
  edgeCount,
  isCollaborating,
  snapToGrid,
  onToggleSnap,
  securityOverlay,
  onToggleSecurityOverlay,
  onShowHelp,
  layersOpen,
  onToggleLayers,
}: CanvasToolbarProps) {
  return (
    <Panel
      position="top-left"
      className="bg-background/90 p-2 rounded-lg shadow-sm"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{nodeCount}</span> components
        <span>•</span>
        <span className="font-medium">{edgeCount}</span> connections
        <span>•</span>
        <button
          onClick={onShowHelp}
          className="hover:text-foreground transition-colors underline decoration-dotted"
          aria-label="Show keyboard shortcuts"
        >
          ? shortcuts
        </button>
        {isCollaborating && (
          <>
            <span>•</span>
            <span className="text-green-600">Live</span>
          </>
        )}
        <span>•</span>
        <button
          onClick={onToggleSnap}
          aria-pressed={snapToGrid}
          aria-label={
            snapToGrid ? "Disable snap to grid" : "Enable snap to grid"
          }
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            snapToGrid
              ? "bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400"
              : "border-border text-muted-foreground hover:border-muted-foreground/60"
          }`}
        >
          {snapToGrid ? "Snap On" : "Snap Off"}
        </button>
        <span>•</span>
        <button
          onClick={onToggleSecurityOverlay}
          aria-pressed={securityOverlay}
          aria-label={
            securityOverlay
              ? "Hide protocol/auth labels"
              : "Show protocol/auth labels"
          }
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            securityOverlay
              ? "bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400"
              : "border-border text-muted-foreground hover:border-muted-foreground/60"
          }`}
        >
          {securityOverlay ? "Security On" : "Security Off"}
        </button>
        <span>•</span>
        <button
          onClick={onToggleLayers}
          aria-pressed={layersOpen}
          aria-label={layersOpen ? "Close layers panel" : "Open layers panel"}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            layersOpen
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "border-border text-muted-foreground hover:border-muted-foreground/60"
          }`}
        >
          Layers
        </button>
      </div>
    </Panel>
  );
}
