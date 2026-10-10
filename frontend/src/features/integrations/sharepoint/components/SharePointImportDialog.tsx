"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { useSharePointImport } from "./useSharePointImport";
import { SharePointConfigStep } from "./SharePointConfigStep";
import {
  SharePointSitesStep,
  SharePointDrivesStep,
  SharePointFilesStep,
  SharePointLoadingStep,
} from "./SharePointBrowseSteps";

interface SharePointImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (content: string, filename: string) => void;
}

export function SharePointImportDialog({
  open,
  onOpenChange,
  onImport,
}: SharePointImportDialogProps) {
  const h = useSharePointImport({ open, onOpenChange, onImport });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Import from SharePoint
          </DialogTitle>
          <DialogDescription>
            {h.step === "config" &&
              "Enter your Azure App Registration credentials."}
            {h.step === "sites" && "Select a SharePoint site."}
            {h.step === "drives" &&
              `Select a document library in ${h.selectedSite?.displayName}.`}
            {h.step === "files" &&
              `Choose a file from ${h.selectedDrive?.name}.`}
            {h.step === "loading" && "Fetching file content…"}
          </DialogDescription>
        </DialogHeader>

        {h.step === "config" && <SharePointConfigStep h={h} />}
        {h.step === "sites" && <SharePointSitesStep h={h} />}
        {h.step === "drives" && <SharePointDrivesStep h={h} />}
        {h.step === "files" && <SharePointFilesStep h={h} />}
        {h.step === "loading" && <SharePointLoadingStep />}

        {h.step !== "config" && h.step !== "loading" && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={h.handleBack}
          >
            ← Back
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
