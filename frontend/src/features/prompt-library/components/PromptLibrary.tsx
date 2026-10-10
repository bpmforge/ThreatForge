"use client";

import React from "react";
import { Plus, Search, Filter, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PromptGrid } from "./PromptGrid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePromptLibrary } from "../hooks/usePromptLibrary";
import type { PromptTemplateSummary, PromptCategory } from "../types";
import { CATEGORY_LABELS } from "../types";

interface PromptLibraryProps {
  orgId: string;
  onSelectPrompt?: (prompt: PromptTemplateSummary) => void;
  onEditPrompt?: (prompt: PromptTemplateSummary) => void;
  onCreatePrompt?: () => void;
}

export function PromptLibrary({
  orgId,
  onSelectPrompt,
  onEditPrompt,
  onCreatePrompt,
}: PromptLibraryProps): React.ReactElement {
  const lib = usePromptLibrary(orgId);

  if (lib.error) {
    return (
      <div className="p-4 text-destructive">
        Failed to load prompts: {lib.error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Prompt Library</h2>
          <p className="text-sm text-muted-foreground">
            Configure AI prompts for threat modeling and document analysis
          </p>
        </div>
        {onCreatePrompt && (
          <Button onClick={onCreatePrompt}>
            <Plus className="h-4 w-4 mr-2" />
            New Prompt
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={lib.searchQuery}
            onChange={(e) => lib.setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={lib.categoryFilter}
          onValueChange={(v) =>
            lib.setCategoryFilter(v as PromptCategory | "all")
          }
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={lib.showBuiltInOnly ? "secondary" : "outline"}
          size="sm"
          onClick={() => lib.setShowBuiltInOnly(!lib.showBuiltInOnly)}
        >
          <Lock className="h-4 w-4 mr-2" />
          Built-in Only
        </Button>
      </div>

      <PromptGrid
        isLoading={lib.isLoading}
        prompts={lib.filteredPrompts}
        onSelectPrompt={onSelectPrompt}
        onEditPrompt={onEditPrompt}
        onClone={lib.handleClone}
        onDelete={(id) => lib.setDeletePromptId(id)}
        onCreatePrompt={onCreatePrompt}
      />

      <AlertDialog
        open={!!lib.deletePromptId}
        onOpenChange={() => lib.setDeletePromptId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this prompt? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={lib.handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
