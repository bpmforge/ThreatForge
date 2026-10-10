"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAISettings } from "../hooks/useAISettings";
import { AISettingsPanel } from "./AISettingsPanel";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Model ID - settings are fetched via the model's organization */
  orgId: string | null;
}

export function SettingsDialog({
  open,
  onOpenChange,
  orgId: modelId,
}: SettingsDialogProps) {
  const { settings, loading, saving, error, updateSettings } = useAISettings({
    orgId: modelId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your threat modeling workspace
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] mt-4 pr-4">
          <h3 className="mb-3 text-sm font-medium">AI Configuration</h3>
          {!modelId ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Save your threat model to configure AI settings.</p>
              <p className="text-sm mt-2">
                AI settings are stored with your threat model.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading settings...
            </div>
          ) : (
            <AISettingsPanel
              key={modelId || "default"}
              settings={settings}
              onSave={updateSettings}
              saving={saving}
              error={error}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
