"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Link2 } from "lucide-react";
import type { UserStory, UserStoryStatus } from "../types";

const STATUS_COLORS: Record<UserStoryStatus, string> = {
  DRAFT: "bg-gray-500",
  READY: "bg-blue-500",
  IN_PROGRESS: "bg-yellow-500",
  DONE: "bg-green-500",
};

interface UserStoryCardProps {
  story: UserStory;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function UserStoryCard({
  story,
  isSelected,
  onSelect,
  onDelete,
}: UserStoryCardProps) {
  return (
    <button
      type="button"
      className={`
        w-full text-left p-3 rounded-lg border transition-colors
        hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring
        ${isSelected ? "border-primary bg-primary/5" : "border-border"}
      `}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{story.title}</span>
            <Badge
              className={`${STATUS_COLORS[story.status]} text-white text-xs shrink-0`}
            >
              {story.status.replace("_", " ")}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">
            As a <span className="font-medium">{story.asA}</span>, I want{" "}
            <span className="font-medium">{story.iWant}</span>
          </p>

          <div className="flex items-center gap-2 mt-2">
            {story.dataFlows.length > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Link2 className="h-3 w-3" />
                {story.dataFlows.length} flow
                {story.dataFlows.length !== 1 && "s"}
              </Badge>
            )}
            {story.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {story.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{story.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </button>
  );
}
