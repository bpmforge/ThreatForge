"use client";

/**
 * Projects List Page
 *
 * Shows all projects in a grid/list view with search and filtering.
 */
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import { ProjectList } from "@/features/projects";

export default function ProjectsPage() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Projects" }];
  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage your threat modeling projects and their models.
            </p>
          </div>

          {/* Project List with integrated toolbar */}
          <ProjectList />
        </div>
      </main>
    </>
  );
}
