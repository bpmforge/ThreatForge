"use client";

/**
 * LoadDialog - Dialog for loading saved threat models.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ThreatModel } from "../types";

interface LoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: ThreatModel[];
  loading: boolean;
  onLoad: (modelId: string) => void;
  onFetchModels: () => void;
}

export function LoadDialog({
  open,
  onOpenChange,
  models,
  loading,
  onLoad,
  onFetchModels,
}: LoadDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (isOpen) onFetchModels();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Open
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Threat Model</DialogTitle>
          <DialogDescription>Select a threat model to open</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No threat models found
            </p>
          ) : (
            models.map((model) => (
              <button
                key={model.id}
                onClick={() => onLoad(model.id)}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-muted-foreground">
                  v{model.version} •{" "}
                  {new Date(model.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
