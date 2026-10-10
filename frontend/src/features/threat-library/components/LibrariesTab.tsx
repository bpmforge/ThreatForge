/**
 * Libraries Tab
 *
 * Tab content for managing threat libraries.
 */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import type { ThreatLibrary, CreateLibraryRequest } from "../types";

interface LibrariesTabProps {
  libraries: ThreatLibrary[] | undefined;
  isLoading: boolean;
  selectedLibraryId: string | null;
  onSelectLibrary: (id: string) => void;
  showLibraryForm: boolean;
  editingLibrary: ThreatLibrary | null;
  libraryForm: CreateLibraryRequest;
  onLibraryFormChange: (form: CreateLibraryRequest) => void;
  onCreateLibrary: () => void;
  onUpdateLibrary: () => void;
  onStartEdit: (library: ThreatLibrary) => void;
  onStartNew: () => void;
  onCancel: () => void;
  onExport: (libraryId: string) => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (library: ThreatLibrary) => void;
  createPending: boolean;
  updatePending: boolean;
}

export function LibrariesTab({
  libraries,
  isLoading,
  selectedLibraryId,
  onSelectLibrary,
  showLibraryForm,
  editingLibrary,
  libraryForm,
  onLibraryFormChange,
  onCreateLibrary,
  onUpdateLibrary,
  onStartEdit,
  onStartNew,
  onCancel,
  onExport,
  onImport,
  onDelete,
  createPending,
  updatePending,
}: LibrariesTabProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Button size="sm" onClick={onStartNew}>
            <Plus className="h-4 w-4 mr-1" />
            New Library
          </Button>
          <label>
            <input
              type="file"
              accept=".json"
              onChange={onImport}
              className="hidden"
            />
            <Button size="sm" variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                Import
              </span>
            </Button>
          </label>
        </div>
      </div>

      {showLibraryForm && (
        <div className="mb-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-medium mb-3">
            {editingLibrary ? "Edit Library" : "New Library"}
          </h4>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lib-name">Name</Label>
              <Input
                id="lib-name"
                value={libraryForm.name}
                onChange={(e) =>
                  onLibraryFormChange({ ...libraryForm, name: e.target.value })
                }
                placeholder="My Custom Threats"
              />
            </div>
            <div>
              <Label htmlFor="lib-desc">Description</Label>
              <Textarea
                id="lib-desc"
                value={libraryForm.description}
                onChange={(e) =>
                  onLibraryFormChange({
                    ...libraryForm,
                    description: e.target.value,
                  })
                }
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={editingLibrary ? onUpdateLibrary : onCreateLibrary}
                disabled={createPending || updatePending}
              >
                {editingLibrary ? "Save" : "Create"}
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="h-[350px]">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-14 rounded" />
                    </div>
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-7 w-7 rounded" />
                    <Skeleton className="h-7 w-7 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : libraries?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No libraries found.</p>
        ) : (
          <div className="space-y-2">
            {libraries?.map((library) => (
              <div
                key={library.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLibraryId === library.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => onSelectLibrary(library.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {library.name}
                      {library.isDefault && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                      {library.isPublic && (
                        <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                          Public
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {library.templateCount || 0} templates
                      {library.description && ` • ${library.description}`}
                    </p>
                  </div>
                  {library.isOwned && !library.isDefault && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEdit(library);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExport(library.id);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(library);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}
