"use client";

/**
 * Dashboard Page
 *
 * Main landing page showing recent models, stats, and quick actions.
 * Now uses the app shell layout with sidebar.
 * Supports model focus mode for detailed STRIDE breakdown.
 */
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  StatsCard,
  RecentModels,
  QuickActions,
  ActivityFeed,
  CreateModelDialog,
  CreateFromGithubDialog,
  FocusedModelStats,
  useDashboardStats,
  useImportThreatModel,
  useProjectsAtRisk,
  EmptyDashboard,
  RiskScoreWidget,
  ProjectsAtRisk,
} from "@/features/dashboard";
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import { useCurrentOrgId } from "@/stores/org-store";
import { useUIStore } from "@/stores/ui-store";

export default function DashboardPage() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Dashboard" }];
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const openTour = useUIStore((s) => s.openTour);
  const [focusedModel, setFocusedModel] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const currentOrgId = useCurrentOrgId();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    currentOrgId ?? undefined,
  );
  const { data: projectsAtRisk, isLoading: projectsLoading } =
    useProjectsAtRisk(currentOrgId ?? undefined);
  const importModel = useImportThreatModel();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewModel = () => {
    setCreateDialogOpen(true);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Import the model
      const model = await importModel.mutateAsync({
        name: data.name || file.name.replace(/\.(json|yaml|yml)$/, ""),
        canvasState: data.canvasState,
      });

      // Navigate to the new model
      router.push(`/models/${model.id}`);
    } catch (err) {
      console.error("Failed to import:", err);
      toast.error("Failed to import file", {
        description: "Please ensure it is a valid JSON threat model export.",
      });
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBrowseTemplates = () => {
    router.push("/templates");
  };

  const handleSelectTemplate = (templateType: string) => {
    if (templateType === "browse") {
      router.push("/templates");
    } else {
      // Specific quick-start card → new-model flow prefilled for that type.
      router.push(`/models/new?template=${templateType}`);
    }
  };

  const handleBrowseProjects = () => {
    router.push("/projects");
  };

  // Show empty dashboard for first-time users (no models and not loading)
  const showEmptyDashboard = !statsLoading && stats?.totalModels === 0;

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />

      <main className="flex-1 overflow-y-auto">
        {showEmptyDashboard ? (
          <EmptyDashboard
            onCreateProject={handleNewModel}
            onSelectTemplate={handleSelectTemplate}
            onImport={handleImport}
            onStartTour={openTour}
          />
        ) : (
          <div className="p-6 space-y-6">
            {/* Page Header */}
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back. Here&apos;s an overview of your threat models.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Models"
                value={stats?.totalModels ?? 0}
                icon={FileText}
                description={
                  stats?.modelsThisWeek
                    ? `${stats.modelsThisWeek} this week`
                    : "No models yet"
                }
                isLoading={statsLoading}
              />
              <StatsCard
                title="Total Threats"
                value={stats?.totalThreats ?? 0}
                icon={AlertTriangle}
                description="Identified threats"
                isLoading={statsLoading}
                urgency={(stats?.totalThreats ?? 0) > 0 ? "warning" : "default"}
              />
              <StatsCard
                title="Open Threats"
                value={stats?.openThreats ?? 0}
                icon={AlertTriangle}
                description={
                  stats?.criticalThreats
                    ? `${stats.criticalThreats} critical`
                    : "Requiring attention"
                }
                isLoading={statsLoading}
                urgency={
                  (stats?.criticalThreats ?? 0) > 0
                    ? "danger"
                    : (stats?.openThreats ?? 0) > 0
                      ? "warning"
                      : "default"
                }
              />
              <StatsCard
                title="Mitigated"
                value={stats?.mitigatedThreats ?? 0}
                icon={CheckCircle}
                description="Successfully addressed"
                isLoading={statsLoading}
                urgency={
                  (stats?.mitigatedThreats ?? 0) > 0 ? "success" : "default"
                }
              />
            </div>

            {/* Projects At Risk */}
            <ProjectsAtRisk
              projects={projectsAtRisk ?? []}
              isLoading={projectsLoading}
            />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Recent Models / Focused Model - takes 3 columns */}
              <div className="lg:col-span-3">
                {focusedModel ? (
                  <FocusedModelStats
                    modelId={focusedModel.id}
                    modelName={focusedModel.name}
                    onClearFocus={() => setFocusedModel(null)}
                  />
                ) : (
                  <RecentModels
                    onCreateNew={handleNewModel}
                    organizationId={currentOrgId ?? undefined}
                    onFocusModel={(id, name) => setFocusedModel({ id, name })}
                  />
                )}
              </div>

              {/* Sidebar - takes 1 column */}
              <div className="space-y-6">
                <RiskScoreWidget
                  totalThreats={stats?.totalThreats ?? 0}
                  openThreats={stats?.openThreats ?? 0}
                  criticalThreats={stats?.criticalThreats ?? 0}
                  mitigatedThreats={stats?.mitigatedThreats ?? 0}
                  isLoading={statsLoading}
                />
                <QuickActions
                  onNewModel={handleNewModel}
                  onImport={handleImport}
                  onBrowseTemplates={handleBrowseTemplates}
                  onBrowseProjects={handleBrowseProjects}
                  onFromGithub={() => setGithubDialogOpen(true)}
                />
                <ActivityFeed organizationId={currentOrgId ?? undefined} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Model Dialog */}
      <CreateModelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Create from GitHub Dialog */}
      <CreateFromGithubDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
