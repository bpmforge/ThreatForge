"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProjectRisk {
  id: string;
  name: string;
  modelCount: number;
  threatCount: number;
  openThreats: number;
  criticalCount: number;
  riskScore: number;
}

interface OrgRiskProjectListProps {
  projectRisk: ProjectRisk[];
}

export function OrgRiskProjectList({ projectRisk }: OrgRiskProjectListProps) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-sm">Projects by Risk Score</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {projectRisk.map((project, i) => (
            <div
              key={project.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <span className="text-xs text-muted-foreground w-6">
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground">
                  {project.modelCount} models · {project.threatCount} threats ·{" "}
                  {project.openThreats} open
                </p>
              </div>
              {project.criticalCount > 0 && (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  {project.criticalCount} CRITICAL
                </Badge>
              )}
              <div className="text-right">
                <p className="text-sm font-mono font-medium">
                  {project.riskScore}
                </p>
                <p className="text-[10px] text-muted-foreground">risk score</p>
              </div>
            </div>
          ))}
          {projectRisk.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No projects with threat models yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
