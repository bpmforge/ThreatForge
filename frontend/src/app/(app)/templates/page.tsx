"use client";

/**
 * Templates Gallery Page
 *
 * Browse and create models from saved templates.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import { TemplateGallery } from "@/features/model-templates";
import { useThreatModels } from "@/features/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TemplatesPage() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Templates" }];
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const { data: models } = useThreatModels();

  // Extract unique projects from models
  const projects = Array.from(
    new Map(
      (models ?? [])
        .filter((m) => m.projectId)
        .map((m) => [m.projectId, m.projectId]),
    ).values(),
  );

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Model Templates
            </h1>
            <p className="text-muted-foreground text-sm">
              Start new threat models from pre-configured templates.
            </p>
          </div>

          {projects.length > 0 ? (
            <>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((pid) => (
                    <SelectItem key={pid} value={pid!}>
                      {pid}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProjectId ? (
                <TemplateGallery
                  projectId={selectedProjectId}
                  onModelCreated={(id) => router.push(`/models/${id}`)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <FileStack className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    Select a project to browse available templates.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileStack className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                Create a project first, then save models as templates.
              </p>
              <Button asChild>
                <Link href="/projects?new=true">Create Project</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
