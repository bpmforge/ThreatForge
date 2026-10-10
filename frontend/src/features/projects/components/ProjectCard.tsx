/**
 * Project card for list view
 */
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectSummary } from "../types";

interface Props {
  project: ProjectSummary;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProjectCard({ project }: Props) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-1">
              {project.name}
            </CardTitle>
            <Badge
              variant={project.status === "ACTIVE" ? "default" : "secondary"}
            >
              {project.status === "ACTIVE" ? "Active" : "Archived"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {project.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{project.threatModelCount} threat model(s)</span>
            <span>Updated {formatDate(project.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
