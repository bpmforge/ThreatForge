/**
 * VersionHistoryDialog - Dialog wrapper for version history panel
 */
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VersionHistoryPanel } from "@/features/version-history";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string | null;
  onPreview?: (versionId: string) => void;
  onRestore?: () => void;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  modelId,
  onPreview,
  onRestore,
}: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[500px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>
            View and restore previous versions of your threat model.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <VersionHistoryPanel
            modelId={modelId}
            onPreview={onPreview}
            onRestore={() => {
              onRestore?.();
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
