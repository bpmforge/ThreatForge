/**
 * ProjectsAtRisk - Shows project-level threat rollups with risk indicators
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Shield,
} from "lucide-react";
import Link from "next/link";
import type { ProjectRiskSummary } from "../services/api";

interface ProjectsAtRiskProps {
  projects: ProjectRiskSummary[];
  isLoading?: boolean;
  onViewAll?: () => void;
}

function getRiskLevel(project: ProjectRiskSummary): {
  level: "critical" | "warning" | "good" | "none";
  label: string;
  color: string;
  bgColor: string;
} {
  if (project.criticalThreats > 0) {
    return {
      level: "critical",
      label: "Critical",
      color: "text-red-600",
      bgColor: "bg-red-500/10 border-red-500/30",
    };
  }
  if (project.openThreats > 0) {
    return {
      level: "warning",
      label: "At Risk",
      color: "text-yellow-600",
      bgColor: "bg-yellow-500/10 border-yellow-500/30",
    };
  }
  if (
    project.totalThreats > 0 &&
    project.mitigatedThreats === project.totalThreats
  ) {
    return {
      level: "good",
      label: "Secure",
      color: "text-green-600",
      bgColor: "bg-green-500/10 border-green-500/30",
    };
  }
  return {
    level: "none",
    label: "No Threats",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  };
}

function ProjectCard({ project }: { project: ProjectRiskSummary }) {
  const risk = getRiskLevel(project);

  return (
    <Link href={`/projects/${project.id}`}>
      <Card
        className={cn(
          "hover:shadow-md transition-all cursor-pointer border",
          risk.bgColor,
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span
                className="font-medium text-sm truncate max-w-[120px]"
                title={project.name}
              >
                {project.name}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", risk.color)}
            >
              {risk.label}
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Models</span>
              <span>{project.modelCount}</span>
            </div>

            {project.totalThreats > 0 && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Open
                  </span>
                  <span
                    className={
                      project.openThreats > 0 ? "text-red-600 font-medium" : ""
                    }
                  >
                    {project.openThreats}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Mitigated
                  </span>
                  <span
                    className={
                      project.mitigatedThreats > 0 ? "text-green-600" : ""
                    }
                  >
                    {project.mitigatedThreats}
                  </span>
                </div>
              </>
            )}

            {project.criticalThreats > 0 && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-[10px] text-red-600 font-medium">
                  {project.criticalThreats} critical threat
                  {project.criticalThreats !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ProjectsAtRisk({
  projects,
  isLoading,
  onViewAll,
}: ProjectsAtRiskProps) {
  // Sort projects by risk: critical first, then warning, then good
  const sortedProjects = [...projects].sort((a, b) => {
    const riskA = getRiskLevel(a);
    const riskB = getRiskLevel(b);
    const order = { critical: 0, warning: 1, good: 2, none: 3 };
    return order[riskA.level] - order[riskB.level];
  });

  // Show top 4 projects
  const displayProjects = sortedProjects.slice(0, 4);
  const hasMore = projects.length > 4;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Projects Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Projects Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No projects yet. Create a project to organize your threat models.
          </p>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/projects">
              <FolderOpen className="h-4 w-4 mr-2" />
              Create Project
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Projects Overview
          </CardTitle>
          {hasMore && (
            <Button variant="ghost" size="sm" onClick={onViewAll} asChild>
              <Link href="/projects" className="text-xs">
                View All
                <ChevronRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {displayProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
