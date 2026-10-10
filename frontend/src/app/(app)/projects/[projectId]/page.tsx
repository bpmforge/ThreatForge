"use client";

/**
 * Project Detail Page
 *
 * Shows project details, threat models list, DFDs, user stories, and settings.
 */
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  AlertTriangle,
  CheckCircle,
  MoreVertical,
  Settings,
  ExternalLink,
  BookOpen,
  FileText,
} from "lucide-react";
import { EmptyModelList } from "@/components/empty-states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import { useProject, ProjectSettings } from "@/features/projects";
import { UserStoryList, UserStoryEditor } from "@/features/user-stories";
import { CreateModelDialog } from "@/features/dashboard";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default function ProjectPage({ params }: Props) {
  const { projectId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("models");
  const [selectedStoryId, setSelectedStoryId] = useState<string | undefined>();
  const [showStoryEditor, setShowStoryEditor] = useState(false);
  const [showCreateModel, setShowCreateModel] = useState(false);
  const { data: project, isLoading, error } = useProject(projectId);

  // For MVP, assume OWNER role
  const currentUserRole = "OWNER" as const;

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Projects", href: "/projects" },
    { label: project?.name ?? "Loading..." },
  ];

  function handleDeleted() {
    router.push("/projects");
  }

  if (isLoading) {
    return (
      <>
        <AppHeader breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <p className="text-muted-foreground">Loading project...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <AppHeader breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <p className="text-destructive mb-4">Failed to load project</p>
            <Button onClick={() => router.push("/projects")}>
              Back to Projects
            </Button>
          </div>
        </main>
      </>
    );
  }

  // Use stats from API (with fallback to 0)
  const stats = project.stats ?? {
    totalThreats: 0,
    openThreats: 0,
    mitigatedThreats: 0,
  };

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs}>
        <Button onClick={() => setShowCreateModel(true)}>
          <Plus className="size-4 mr-2" />
          New Model
        </Button>
      </AppHeader>

      <CreateModelDialog
        open={showCreateModel}
        onOpenChange={setShowCreateModel}
        defaultProjectId={projectId}
        projectName={project.name}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Project Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1 max-w-2xl">
                  {project.description}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActiveTab("settings")}>
                  <Settings className="size-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="size-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {project.threatModels.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Threat Models
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-8 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalThreats}</p>
                    <p className="text-sm text-muted-foreground">
                      Total Threats
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.openThreats}</p>
                    <p className="text-sm text-muted-foreground">
                      Open Threats
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="size-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {stats.mitigatedThreats}
                    </p>
                    <p className="text-sm text-muted-foreground">Mitigated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="models">
                <FileText className="size-4 mr-1.5" />
                Models ({project.threatModels.length})
              </TabsTrigger>
              <TabsTrigger value="stories">
                <BookOpen className="size-4 mr-1.5" />
                User Stories
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="size-4 mr-1.5" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="models" className="mt-4">
              {project.threatModels.length === 0 ? (
                <Card>
                  <CardContent className="py-0">
                    <EmptyModelList
                      onCreateModel={() => setShowCreateModel(true)}
                      projectName={project.name}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {project.threatModels.map((tm) => (
                    <Card
                      key={tm.id}
                      className="hover:border-primary/50 transition-colors cursor-pointer"
                    >
                      <Link href={`/models/${tm.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">
                              {tm.name}
                            </CardTitle>
                            <ExternalLink className="size-4 text-muted-foreground" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Version {tm.version}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(tm.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {tm.threatCount !== undefined &&
                            tm.threatCount > 0 && (
                              <div className="mt-2 flex items-center gap-1 text-sm text-amber-600">
                                <AlertTriangle className="size-3.5" />
                                {tm.threatCount} threat
                                {tm.threatCount !== 1 ? "s" : ""}
                              </div>
                            )}
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="stories" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Story List */}
                <div className="lg:col-span-1">
                  <Card>
                    <CardContent className="p-4">
                      <UserStoryList
                        projectId={projectId}
                        selectedStoryId={selectedStoryId}
                        onSelect={(id) => {
                          setSelectedStoryId(id);
                          setShowStoryEditor(true);
                        }}
                        onCreateNew={() => {
                          setSelectedStoryId(undefined);
                          setShowStoryEditor(true);
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Story Editor */}
                <div className="lg:col-span-2">
                  {showStoryEditor ? (
                    <Card>
                      <UserStoryEditor
                        key={selectedStoryId || "new"}
                        projectId={projectId}
                        storyId={selectedStoryId}
                        onClose={() => {
                          setShowStoryEditor(false);
                          setSelectedStoryId(undefined);
                        }}
                        onSaved={(id) => {
                          setSelectedStoryId(id);
                        }}
                      />
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                          <BookOpen className="size-12 mx-auto mb-4 opacity-50" />
                          <p>Select a user story to edit or create a new one</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <ProjectSettings
                key={project.id}
                project={project}
                currentUserRole={currentUserRole}
                onDeleted={handleDeleted}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
