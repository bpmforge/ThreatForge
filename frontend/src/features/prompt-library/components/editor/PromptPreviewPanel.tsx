"use client";

/**
 * PromptPreviewPanel — Preview dialog for the prompt editor.
 *
 * Lets the user fill in variable values and see the interpolated user prompt.
 * Extracted from PromptEditor to keep the layout orchestrator ≤200 lines.
 */

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PromptVariable } from "../../types";

interface PromptPreviewPanelProps {
  open: boolean;
  variables: PromptVariable[];
  previewVariables: Record<string, string>;
  previewResult: { userPrompt: string } | null;
  previewLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onPreviewVariableChange: (name: string, value: string) => void;
  onGeneratePreview: () => void;
}

export function PromptPreviewPanel({
  open,
  variables,
  previewVariables,
  previewResult,
  previewLoading,
  onOpenChange,
  onPreviewVariableChange,
  onGeneratePreview,
}: PromptPreviewPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Preview Prompt</DialogTitle>
          <DialogDescription>
            Enter variable values to see the interpolated user prompt
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {variables.map((variable) => (
              <div key={variable.name} className="space-y-2">
                <Label>{variable.displayName || variable.name}</Label>
                <Input
                  value={previewVariables[variable.name] || ""}
                  onChange={(e) =>
                    onPreviewVariableChange(variable.name, e.target.value)
                  }
                  placeholder={`Enter ${variable.name}...`}
                />
              </div>
            ))}
          </div>
          <Button onClick={onGeneratePreview} disabled={previewLoading}>
            <Play className="h-4 w-4 mr-2" />
            Generate Preview
          </Button>
          {previewResult && (
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">
                    User Prompt
                  </Label>
                  <pre className="mt-1 whitespace-pre-wrap text-sm font-mono bg-muted p-2 rounded">
                    {previewResult.userPrompt}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
