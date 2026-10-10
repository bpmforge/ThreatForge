"use client";

/**
 * LibraryManagerDialog - Dialog for managing threat libraries and templates.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Library } from "lucide-react";
import { useLibraryManagerState } from "./LibraryManagerState";
import { LibrariesTab } from "./LibrariesTab";
import { TemplatesTab } from "./TemplatesTab";

interface LibraryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LibraryManagerDialog({
  open,
  onOpenChange,
}: LibraryManagerDialogProps) {
  const state = useLibraryManagerState();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              Threat Library Manager
            </DialogTitle>
            <DialogDescription>
              Create and manage custom threat libraries for your organization.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="libraries" className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="libraries">Libraries</TabsTrigger>
              <TabsTrigger
                value="templates"
                disabled={!state.selectedLibraryId}
              >
                Templates{" "}
                {state.selectedLibrary &&
                  `(${state.selectedLibrary.templates?.length || 0})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="libraries" className="mt-4">
              <LibrariesTab
                libraries={state.libraries}
                isLoading={state.isLoading}
                selectedLibraryId={state.selectedLibraryId}
                onSelectLibrary={state.setSelectedLibraryId}
                showLibraryForm={state.showLibraryForm}
                editingLibrary={state.editingLibrary}
                libraryForm={state.libraryForm}
                onLibraryFormChange={state.setLibraryForm}
                onCreateLibrary={state.handleCreateLibrary}
                onUpdateLibrary={state.handleUpdateLibrary}
                onStartEdit={state.startEditLibrary}
                onStartNew={state.startNewLibrary}
                onCancel={state.cancelLibraryForm}
                onExport={state.handleExport}
                onImport={state.handleImport}
                onDelete={(library) =>
                  state.setDeleteConfirm({
                    type: "library",
                    id: library.id,
                    name: library.name,
                  })
                }
                createPending={state.createLibraryPending}
                updatePending={state.updateLibraryPending}
              />
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <TemplatesTab
                selectedLibrary={state.selectedLibrary}
                showTemplateForm={state.showTemplateForm}
                editingTemplate={state.editingTemplate}
                templateForm={state.templateForm}
                mitigationInput={state.mitigationInput}
                onMitigationInputChange={state.setMitigationInput}
                onTemplateFieldChange={state.updateTemplateField}
                onCreateTemplate={state.handleCreateTemplate}
                onUpdateTemplate={state.handleUpdateTemplate}
                onStartEdit={state.startEditTemplate}
                onStartNew={state.startNewTemplate}
                onCancel={state.cancelTemplateForm}
                onAddMitigation={state.addMitigation}
                onRemoveMitigation={state.removeMitigation}
                onDelete={(template) =>
                  state.setDeleteConfirm({
                    type: "template",
                    id: template.id,
                    name: template.name,
                  })
                }
                createPending={state.createTemplatePending}
                updatePending={state.updateTemplatePending}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!state.deleteConfirm}
        onOpenChange={() => state.setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {state.deleteConfirm?.type === "library" ? "Library" : "Template"}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{state.deleteConfirm?.name}
              &rdquo;? This action cannot be undone.
              {state.deleteConfirm?.type === "library" &&
                " All templates in this library will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                state.deleteConfirm?.type === "library"
                  ? state.handleDeleteLibrary
                  : state.handleDeleteTemplate
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
