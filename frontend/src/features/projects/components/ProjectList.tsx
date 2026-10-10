/**
 * Project list with search and filter
 */
"use client";

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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, AlertCircle } from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { EmptyProjectList as EmptyProjectListComponent } from "@/components/empty-states";
import type { ProjectStatus, ProjectSortField, SortOrder } from "../types";

interface Props {
  organizationId?: string;
}

export function ProjectList({ organizationId }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [sortBy, setSortBy] = useState<ProjectSortField>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: projects,
    isLoading,
    error,
  } = useProjects({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    organizationId: organizationId || undefined,
    sortBy,
    sortOrder,
  });

  if (error) {
    return (
      <div className="py-12 text-center border-2 border-dashed rounded-lg">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive/50 mb-4" />
        <p className="font-medium text-destructive">Failed to load projects</p>
        <p className="text-sm text-muted-foreground mt-1">
          {(error as Error)?.message || "Please try again later"}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as ProjectSortField)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Last updated</SelectItem>
            <SelectItem value="createdAt">Created</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        >
          {sortOrder === "asc" ? "Asc" : "Desc"}
        </Button>

        <div className="flex-1" />

        <Button onClick={() => setCreateOpen(true)}>New Project</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        search ? (
          <div className="py-12 text-center border-2 border-dashed rounded-lg">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="font-medium text-foreground">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">
              No projects match &quot;{search}&quot;
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setSearch("")}
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <EmptyProjectListComponent
            onCreateProject={() => setCreateOpen(true)}
          />
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        organizationId={organizationId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {/* Note: organizationId is optional - if not provided, the server auto-selects */}
    </div>
  );
}
