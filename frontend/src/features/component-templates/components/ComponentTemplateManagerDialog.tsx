/**
 * Component Template Manager Dialog
 *
 * Admin UI for managing component template libraries and templates.
 * Supports CRUD operations, import/export, and template preview.
 */
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Library, Box } from "lucide-react";
import {
  useComponentTemplateLibraries,
  useComponentTemplateLibrary,
  useComponentTemplates,
} from "../hooks/useComponentTemplates";
import { LibraryList } from "./LibraryList";
import { LibraryForm } from "./LibraryForm";
import { TemplateList } from "./TemplateList";
import { TemplateForm } from "./TemplateForm";
import { useComponentTemplateManagerHandlers } from "./useComponentTemplateManagerHandlers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function ComponentTemplateManagerDialog({
  open,
  onOpenChange,
  organizationId,
}: Props) {
  const h = useComponentTemplateManagerHandlers({ organizationId });

  const { data: librariesData, isLoading: librariesLoading } =
    useComponentTemplateLibraries(organizationId);
  const libraries = Array.isArray(librariesData) ? librariesData : [];
  const { data: selectedLibrary } = useComponentTemplateLibrary(
    organizationId,
    h.selectedLibraryId ?? undefined,
  );
  const { data: templatesData } = useComponentTemplates(
    organizationId,
    h.selectedLibraryId ?? undefined,
  );
  const templates = Array.isArray(templatesData) ? templatesData : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              Component Template Manager
            </DialogTitle>
            <DialogDescription>
              Create and manage reusable component templates for your team.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={h.activeTab}
            onValueChange={(v) =>
              h.setActiveTab(v as "libraries" | "templates")
            }
          >
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="libraries" className="gap-2">
                  <Library className="h-4 w-4" />
                  Libraries
                </TabsTrigger>
                <TabsTrigger
                  value="templates"
                  className="gap-2"
                  disabled={!h.selectedLibraryId}
                >
                  <Box className="h-4 w-4" />
                  Templates
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={h.handleImport}>
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </Button>
                {h.activeTab === "libraries" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      h.setEditingLibrary(null);
                      h.setShowLibraryForm(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Library
                  </Button>
                )}
                {h.activeTab === "templates" && h.selectedLibraryId && (
                  <Button
                    size="sm"
                    onClick={() => {
                      h.setEditingTemplate(null);
                      h.setShowTemplateForm(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Template
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="libraries" className="m-0">
              {h.showLibraryForm ? (
                <LibraryForm
                  library={h.editingLibrary}
                  onSubmit={h.handleLibrarySubmit}
                  onCancel={() => {
                    h.setShowLibraryForm(false);
                    h.setEditingLibrary(null);
                  }}
                  isLoading={
                    h.createLibrary.isPending || h.updateLibrary.isPending
                  }
                />
              ) : (
                <LibraryList
                  libraries={libraries}
                  selectedLibraryId={h.selectedLibraryId}
                  isLoading={librariesLoading}
                  onSelect={(id) => {
                    h.setSelectedLibraryId(id);
                    h.setActiveTab("templates");
                  }}
                  onEdit={(lib) => {
                    h.setEditingLibrary(lib);
                    h.setShowLibraryForm(true);
                  }}
                  onDelete={(lib) =>
                    h.setDeleteConfirm({
                      type: "library",
                      id: lib.id,
                      name: lib.name,
                    })
                  }
                  onExport={h.handleExport}
                />
              )}
            </TabsContent>

            <TabsContent value="templates" className="m-0">
              {h.showTemplateForm ? (
                <TemplateForm
                  template={h.editingTemplate}
                  onSubmit={h.handleTemplateSubmit}
                  onCancel={() => {
                    h.setShowTemplateForm(false);
                    h.setEditingTemplate(null);
                  }}
                  isLoading={
                    h.createTemplate.isPending || h.updateTemplate.isPending
                  }
                />
              ) : (
                <TemplateList
                  templates={templates}
                  libraryName={selectedLibrary?.name ?? ""}
                  onEdit={(tmpl) => {
                    h.setEditingTemplate(tmpl);
                    h.setShowTemplateForm(true);
                  }}
                  onDelete={(tmpl) =>
                    h.setDeleteConfirm({
                      type: "template",
                      id: tmpl.id,
                      name: tmpl.name,
                    })
                  }
                  onBack={() => h.setActiveTab("libraries")}
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!h.deleteConfirm}
        onOpenChange={() => h.setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {h.deleteConfirm?.type === "library" ? "Library" : "Template"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{h.deleteConfirm?.name}
              &quot;? This action cannot be undone.
              {h.deleteConfirm?.type === "library" &&
                " All templates in this library will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                h.deleteConfirm?.type === "library"
                  ? h.handleDeleteLibrary
                  : h.handleDeleteTemplate
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
