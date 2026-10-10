"use client";

/**
 * ModelTagsEditor - Display and edit model tags
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateModelTags } from "@/features/dashboard";
import { cn } from "@/lib/utils";
import { Tag, X, Plus } from "lucide-react";

interface ModelTagsEditorProps {
  modelId: string;
  tags: string[];
}

const TAG_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
];

function getTagColor(tag: string): string {
  // Simple hash to consistently assign colors to tags
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash = hash & hash;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function ModelTagsEditor({ modelId, tags }: ModelTagsEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateTags = useUpdateModelTags();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAddTag = useCallback(() => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 20) {
      updateTags.mutate({ id: modelId, tags: [...tags, trimmedTag] });
      setNewTag("");
    }
  }, [modelId, tags, newTag, updateTags]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      updateTags.mutate({
        id: modelId,
        tags: tags.filter((t) => t !== tagToRemove),
      });
    },
    [modelId, tags, updateTags],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
            "hover:bg-muted/50 transition-colors",
            tags.length > 0
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Tag className="h-3 w-3" />
          {tags.length > 0 ? (
            <span className="flex items-center gap-1">
              {tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn("px-1.5 py-0 text-[10px]", getTagColor(tag))}
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <span className="text-muted-foreground">
                  +{tags.length - 2}
                </span>
              )}
            </span>
          ) : (
            <span>Tags</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="h-8 text-sm"
              maxLength={50}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddTag}
              disabled={
                !newTag.trim() || tags.includes(newTag.trim().toLowerCase())
              }
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 text-xs",
                    getTagColor(tag),
                  )}
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              No tags yet. Add tags to organize your models.
            </p>
          )}

          {tags.length >= 20 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Maximum of 20 tags reached
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
