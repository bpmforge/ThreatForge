"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ThreatCatalogDialog,
  type CatalogThreat,
} from "@/features/threat-catalog";
import {
  DocumentViewerDialog,
  DocGapAnalysisDialog,
} from "@/features/documents";
import type { ComponentType } from "@/types/canvas";

interface ModelPageDialogsProps {
  restoreConfirm: { savedAt: string } | null;
  onRestoreCancel: () => void;
  onRestoreConfirm: () => void;
  threatCatalogOpen: boolean;
  onCloseThreatCatalog: () => void;
  onAddCatalogThreat: (threat: CatalogThreat) => void;
  catalogComponentType?: ComponentType;
  catalogComponentName?: string;
  viewingDocId: string | null;
  onCloseViewer: () => void;
  gapAnalysisOpen: boolean;
  onGapAnalysisOpenChange: (open: boolean) => void;
  modelId: string;
}

export function ModelPageDialogs({
  restoreConfirm,
  onRestoreCancel,
  onRestoreConfirm,
  threatCatalogOpen,
  onCloseThreatCatalog,
  onAddCatalogThreat,
  catalogComponentType,
  catalogComponentName,
  viewingDocId,
  onCloseViewer,
  gapAnalysisOpen,
  onGapAnalysisOpenChange,
  modelId,
}: ModelPageDialogsProps) {
  return (
    <>
      <AlertDialog
        open={!!restoreConfirm}
        onOpenChange={() => onRestoreCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Unsaved Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Found unsaved changes from {restoreConfirm?.savedAt}. Do you want
              to restore them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onRestoreCancel}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction onClick={onRestoreConfirm}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ThreatCatalogDialog
        open={threatCatalogOpen}
        onOpenChange={(open) => !open && onCloseThreatCatalog()}
        onAddThreat={onAddCatalogThreat}
        componentType={catalogComponentType}
        componentName={catalogComponentName}
      />

      {viewingDocId && (
        <DocumentViewerDialog
          open={!!viewingDocId}
          onOpenChange={(open) => !open && onCloseViewer()}
          modelId={modelId}
          documentId={viewingDocId}
        />
      )}

      <DocGapAnalysisDialog
        open={gapAnalysisOpen}
        onOpenChange={onGapAnalysisOpenChange}
        modelId={modelId}
      />
    </>
  );
}
