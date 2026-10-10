"use client";

/**
 * Canvas Empty State
 *
 * Shows a helpful hint when the canvas has no components.
 * Fades away when the first node is added.
 */

import { Layers, Wand2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasEmptyStateProps {
  onOpenWizard?: () => void;
  onOpenImport?: () => void;
}

export function CanvasEmptyState({
  onOpenWizard,
  onOpenImport,
}: CanvasEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="pointer-events-auto text-center space-y-4 p-8 rounded-xl bg-background/80 backdrop-blur-sm border border-dashed border-muted-foreground/30 max-w-md">
        <div className="flex justify-center gap-3 text-muted-foreground">
          <Layers className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-medium">Start Your Threat Model</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Drag components from the palette on the left, or use one of these
            shortcuts:
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {onOpenWizard && (
            <Button
              variant="outline"
              onClick={onOpenWizard}
              className="flex items-center gap-2 h-auto px-4 py-2 text-sm justify-start"
            >
              <Wand2 className="h-4 w-4" />
              Guided Wizard — Answer 2-3 questions, AI builds your model
            </Button>
          )}
          {onOpenImport && (
            <Button
              variant="outline"
              onClick={onOpenImport}
              className="flex items-center gap-2 h-auto px-4 py-2 text-sm justify-start"
            >
              <Upload className="h-4 w-4" />
              Import Document — Upload architecture doc or paste text
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-xs">?</kbd>{" "}
          for keyboard shortcuts
        </p>
      </div>
    </div>
  );
}
