"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lock, Globe } from "lucide-react";
import type { GitHubRepository } from "../../types";

interface GitHubStep2Props {
  repositories: GitHubRepository[];
  selectedRepo: GitHubRepository | null;
  onSelectRepository: (repo: GitHubRepository) => void;
}

export function GitHubStep2({
  repositories,
  selectedRepo,
  onSelectRepository,
}: GitHubStep2Props) {
  return (
    <div className="space-y-4">
      <Label>Select Repository</Label>
      <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
        {repositories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No repositories found
          </p>
        ) : (
          repositories.map((repo) => (
            <button
              key={repo.id}
              onClick={() => onSelectRepository(repo)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedRepo?.id === repo.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {repo.private ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{repo.full_name}</span>
                </div>
                {repo.private && (
                  <Badge variant="outline" className="text-xs">
                    Private
                  </Badge>
                )}
              </div>
              {repo.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {repo.description}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
