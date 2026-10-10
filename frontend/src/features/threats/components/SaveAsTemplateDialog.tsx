"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Library } from "lucide-react";
import { useSaveAsTemplateForm } from "../hooks/useSaveAsTemplateForm";
import { TemplateLibrarySelector } from "./TemplateLibrarySelector";
import { TemplateMitigationsList } from "./TemplateMitigationsList";
import { TemplateCategorySelects } from "./TemplateCategorySelects";
import type { Threat } from "../types";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threat: Threat;
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  threat,
}: SaveAsTemplateDialogProps) {
  const form = useSaveAsTemplateForm(threat, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={form.handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Save this threat to your organization&apos;s library for reuse.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <TemplateLibrarySelector
              libraries={form.ownedLibraries}
              isLoading={form.librariesLoading}
              selectedLibraryId={form.selectedLibraryId}
              onSelectLibrary={form.setSelectedLibraryId}
              showNewLibrary={form.showNewLibrary}
              onToggleNewLibrary={form.setShowNewLibrary}
              newLibraryName={form.newLibraryName}
              onNewLibraryNameChange={form.setNewLibraryName}
              onCreateLibrary={form.handleCreateLibrary}
              isCreating={form.isCreatingLibrary}
            />

            <div className="space-y-2">
              <Label htmlFor="template-name">Name *</Label>
              <Input
                id="template-name"
                value={form.name}
                onChange={(e) => form.setNameOverride(e.target.value)}
                placeholder="e.g., SQL Injection"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-desc">Description *</Label>
              <Textarea
                id="template-desc"
                value={form.description}
                onChange={(e) => form.setDescriptionOverride(e.target.value)}
                placeholder="Describe the threat..."
                rows={3}
              />
            </div>

            <TemplateCategorySelects
              strideCategory={form.strideCategory}
              severity={form.severity}
              onStrideCategoryChange={form.setStrideCategoryOverride}
              onSeverityChange={form.setSeverityOverride}
            />

            <TemplateMitigationsList
              mitigations={form.mitigations}
              newMitigation={form.newMitigation}
              onNewMitigationChange={form.setNewMitigation}
              onAdd={form.handleAddMitigation}
              onRemove={form.handleRemoveMitigation}
            />
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => form.handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={form.handleSave}
            disabled={
              !form.selectedLibraryId ||
              !form.name.trim() ||
              !form.description.trim() ||
              form.isSaving
            }
          >
            {form.isSaving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
