/**
 * RecentModels - Grid of recent threat models
 */
"use client";

import { DeleteConfirmDialog } from "@/components/dialogs/DeleteAlertDialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Grid, List, FileText, FolderOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ModelCard } from "./ModelCard";
import { MoveToProjectDialog } from "./MoveToProjectDialog";
import {
  useThreatModels,
  useDeleteThreatModel,
  useDuplicateThreatModel,
} from "../hooks/useDashboard";
import { usePresence } from "../hooks/usePresence";
import { useProjects } from "@/features/projects";
import type { DashboardFilters } from "../types";

interface RecentModelsProps {
  onCreateNew: () => void;
  organizationId?: string;
  onFocusModel?: (id: string, name: string) => void;
}

export function RecentModels({
  onCreateNew,
  organizationId,
  onFocusModel,
}: RecentModelsProps) {
  const [filters, setFilters] = useState<DashboardFilters>({
    sortBy: "lastModified",
    sortOrder: "desc",
  });
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{
    id: string;
    name: string;
    projectId?: string;
  } | null>(null);

  // Merge organizationId prop with filters for the query
  const queryFilters = { ...filters, organizationId };
  const { data: models, isLoading, error } = useThreatModels(queryFilters);
  const { data: projects } = useProjects({ organizationId });
  const deleteModel = useDeleteThreatModel();
  const duplicateModel = useDuplicateThreatModel();

  const modelIds = models?.map((m) => m.id) ?? [];
  const { data: presenceCounts } = usePresence(modelIds);

  const filteredModels = models?.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteModel.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateModel.mutate(id);
  };

  const handleMove = (id: string, name: string, currentProjectId?: string) => {
    setMoveDialog({ id, name, projectId: currentProjectId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Models</h2>
        <Button onClick={onCreateNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Model
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.projectId || "all"}
          onValueChange={(value) =>
            setFilters((f) => ({
              ...f,
              projectId: value === "all" ? undefined : value,
            }))
          }
        >
          <SelectTrigger className="w-44" aria-label="Filter by project">
            <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sortBy}
          onValueChange={(value) =>
            setFilters((f) => ({
              ...f,
              sortBy: value as DashboardFilters["sortBy"],
            }))
          }
        >
          <SelectTrigger className="w-40" aria-label="Sort models by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastModified">Last Modified</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="threatCount">Threat Count</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col gap-2"
          }
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">Failed to load threat models</p>
          <p className="text-sm mt-1">{(error as Error).message}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      ) : !filteredModels?.length ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="font-medium text-foreground">No threat models yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first threat model to get started
          </p>
          <Button onClick={onCreateNew} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Model
          </Button>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col gap-2"
          }
        >
          {filteredModels.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onMove={handleMove}
              onFocus={
                onFocusModel
                  ? () => onFocusModel(model.id, model.name)
                  : undefined
              }
              activeCount={presenceCounts?.[model.id]}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Threat Model?"
        name={deleteConfirm?.name}
      />

      {/* Move to project dialog */}
      {moveDialog && (
        <MoveToProjectDialog
          open={!!moveDialog}
          onOpenChange={(open) => !open && setMoveDialog(null)}
          modelId={moveDialog.id}
          modelName={moveDialog.name}
          currentProjectId={moveDialog.projectId}
        />
      )}
    </div>
  );
}
