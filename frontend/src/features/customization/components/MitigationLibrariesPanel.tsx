"use client";

/**
 * Mitigation Libraries Panel
 *
 * Manages reusable mitigation template libraries.
 */
import { useState } from "react";
import {
  Plus,
  Library,
  Trash2,
  ChevronRight,
  FileText,
  Globe,
  Lock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteAlertDialog } from "@/components/dialogs/DeleteAlertDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  useMitigationLibraries,
  useCreateLibrary,
  useDeleteLibrary,
} from "../hooks/useMitigationLibraries";
import { MitigationTemplatesPanel } from "./MitigationTemplatesPanel";
import type { MitigationLibrary } from "../types";

interface MitigationLibrariesPanelProps {
  orgId: string;
}

export function MitigationLibrariesPanel({
  orgId,
}: MitigationLibrariesPanelProps) {
  const { data: libraries, isLoading, error } = useMitigationLibraries(orgId);
  const createLibrary = useCreateLibrary(orgId);
  const deleteLibrary = useDeleteLibrary(orgId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedLibrary, setSelectedLibrary] =
    useState<MitigationLibrary | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) return;

    createLibrary.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setName("");
          setDescription("");
          setIsPublic(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    deleteLibrary.mutate(deleteConfirmId, {
      onSuccess: () => {
        setDeleteConfirmId(null);
        if (selectedLibrary?.id === deleteConfirmId) {
          setSelectedLibrary(null);
        }
      },
    });
  };

  if (selectedLibrary) {
    return (
      <MitigationTemplatesPanel
        orgId={orgId}
        library={selectedLibrary}
        onBack={() => setSelectedLibrary(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mitigation Libraries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading libraries...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mitigation Libraries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">Failed to load libraries</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-5 w-5" />
                Mitigation Libraries
              </CardTitle>
              <CardDescription>
                Create reusable mitigation templates organized in libraries
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Library
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {libraries && libraries.length > 0 ? (
            <div className="space-y-2">
              {libraries.map((library) => (
                <div
                  key={library.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedLibrary(library)}
                >
                  <Library className="h-5 w-5 text-muted-foreground" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {library.name}
                      </span>
                      {library.isPublic ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Globe className="h-3 w-3" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Lock className="h-3 w-3" />
                          Private
                        </Badge>
                      )}
                    </div>
                    {library.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {library.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      <FileText className="h-3 w-3 inline mr-1" />
                      {library.templateCount} template
                      {library.templateCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(library.id);
                      }}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No mitigation libraries yet</p>
              <p className="text-sm">
                Create a library to start building reusable mitigations
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Library Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Library</DialogTitle>
            <DialogDescription>
              Create a new mitigation library to organize reusable templates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lib-name">Name</Label>
              <Input
                id="lib-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., OWASP Controls, API Security Mitigations"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lib-description">Description (optional)</Label>
              <Textarea
                id="lib-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this library..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="lib-public">Public Library</Label>
                <p className="text-sm text-muted-foreground">
                  Allow other organizations to subscribe
                </p>
              </div>
              <Switch
                id="lib-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createLibrary.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createLibrary.isPending || !name.trim()}
            >
              {createLibrary.isPending ? "Creating..." : "Create Library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteAlertDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Library"
      >
        Are you sure you want to delete this library? All templates in this
        library will also be deleted. This action cannot be undone.
      </DeleteAlertDialog>
    </>
  );
}
