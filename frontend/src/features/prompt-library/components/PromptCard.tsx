"use client";

import React from "react";
import { Copy, Pencil, Trash2, Eye, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PromptTemplateSummary } from "../types";
import { CATEGORY_LABELS, parseTags } from "../types";

interface PromptCardProps {
  prompt: PromptTemplateSummary;
  onSelect?: (prompt: PromptTemplateSummary) => void;
  onEdit?: (prompt: PromptTemplateSummary) => void;
  onClone: (prompt: PromptTemplateSummary) => void;
  onDelete: (id: string) => void;
}

export function PromptCard({
  prompt,
  onSelect,
  onEdit,
  onClone,
  onDelete,
}: PromptCardProps): React.ReactElement {
  const tags = parseTags(prompt);

  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 absolute top-2 right-2 z-10"
          >
            <span className="sr-only">Actions</span>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onSelect && (
            <DropdownMenuItem onClick={() => onSelect(prompt)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onClone(prompt)}>
            <Copy className="h-4 w-4 mr-2" />
            Clone
          </DropdownMenuItem>
          {!prompt.isBuiltIn && onEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(prompt)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(prompt.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CardHeader className="pb-2 pr-10">
        <CardTitle className="text-sm flex items-start gap-1.5">
          {prompt.isBuiltIn && (
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
          )}
          <span>{prompt.name}</span>
        </CardTitle>
        <CardDescription className="mt-1 text-xs">
          {prompt.description || "No description"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {CATEGORY_LABELS[prompt.category]}
          </Badge>
          {prompt.requiresVision && (
            <Badge variant="secondary">
              <Eye className="h-3 w-3 mr-1" />
              Vision
            </Badge>
          )}
          {tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
