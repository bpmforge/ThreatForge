"use client";

/**
 * ThreatLibraryDialog - Modal wrapper for the threat library browser.
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
import type { ComponentType, StrideCategory, Severity } from "@/types/canvas";
import type { LibraryThreat } from "../types";
import { ThreatLibraryBrowser } from "./ThreatLibraryBrowser";

interface ThreatLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentType?: ComponentType;
  selectedLabel?: string;
  onSelectThreat: (data: {
    name: string;
    description: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    libraryId: string;
  }) => void;
}

export function ThreatLibraryDialog({
  open,
  onOpenChange,
  componentType,
  selectedLabel,
  onSelectThreat,
}: ThreatLibraryDialogProps) {
  const handleSelect = (threat: LibraryThreat) => {
    onSelectThreat({
      name: threat.name,
      description: threat.description,
      strideCategories: threat.strideCategories,
      severity: threat.defaultSeverity,
      libraryId: threat.id,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-xs">
          Browse Library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Threat Library</DialogTitle>
          <DialogDescription>
            Select a pre-defined threat
            {selectedLabel ? ` for ${selectedLabel}` : ""}. Threats are filtered
            by applicable component types.
          </DialogDescription>
        </DialogHeader>
        <ThreatLibraryBrowser
          componentType={componentType}
          onSelectThreat={handleSelect}
          maxHeight="350px"
        />
      </DialogContent>
    </Dialog>
  );
}
