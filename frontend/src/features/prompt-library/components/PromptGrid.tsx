"use client";

import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PromptCard } from "./PromptCard";
import type { PromptTemplateSummary } from "../types";

interface PromptGridProps {
  isLoading: boolean;
  prompts: PromptTemplateSummary[];
  onSelectPrompt?: (prompt: PromptTemplateSummary) => void;
  onEditPrompt?: (prompt: PromptTemplateSummary) => void;
  onClone: (prompt: PromptTemplateSummary) => void;
  onDelete: (id: string) => void;
  onCreatePrompt?: () => void;
}

export function PromptGrid({
  isLoading,
  prompts,
  onSelectPrompt,
  onEditPrompt,
  onClone,
  onDelete,
  onCreatePrompt,
}: PromptGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="p-6 space-y-2">
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No prompts found</p>
          {onCreatePrompt && (
            <Button onClick={onCreatePrompt} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Prompt
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {prompts.map((prompt) => (
        <PromptCard
          key={prompt.id}
          prompt={prompt}
          onSelect={onSelectPrompt}
          onEdit={onEditPrompt}
          onClone={onClone}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
