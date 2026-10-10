"use client";

/**
 * PromptMetadataForm — Basic Info tab content for the prompt editor.
 *
 * Renders name, category, description, tags, and vision toggle fields.
 * Extracted from PromptEditor to keep the layout orchestrator ≤200 lines.
 */

import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import type { PromptCategory } from "../../types";
import { CATEGORY_LABELS } from "../../types";

interface PromptMetadataFormProps {
  name: string;
  description: string;
  category: PromptCategory;
  tags: string[];
  newTag: string;
  requiresVision: boolean;
  isReadOnly: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: PromptCategory) => void;
  onNewTagChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onRequiresVisionChange: (value: boolean) => void;
}

export function PromptMetadataForm({
  name,
  description,
  category,
  tags,
  newTag,
  requiresVision,
  isReadOnly,
  onNameChange,
  onDescriptionChange,
  onCategoryChange,
  onNewTagChange,
  onAddTag,
  onRemoveTag,
  onRequiresVisionChange,
}: PromptMetadataFormProps) {
  return (
    <TabsContent value="basic" className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="My Custom Prompt"
            disabled={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={category}
            onValueChange={(v) => onCategoryChange(v as PromptCategory)}
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What does this prompt do?"
          rows={2}
          disabled={isReadOnly}
        />
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
              {!isReadOnly && (
                <button
                  onClick={() => onRemoveTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => onNewTagChange(e.target.value)}
              placeholder="Add tag..."
              onKeyDown={(e) => e.key === "Enter" && onAddTag()}
            />
            <Button variant="outline" onClick={onAddTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="vision"
            checked={requiresVision}
            onCheckedChange={onRequiresVisionChange}
            disabled={isReadOnly}
          />
          <Label htmlFor="vision">Requires Vision (Image Input)</Label>
        </div>
      </div>
    </TabsContent>
  );
}
