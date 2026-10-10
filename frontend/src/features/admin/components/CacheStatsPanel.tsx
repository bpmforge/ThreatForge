"use client";

import { useState } from "react";
import {
  Database,
  Trash2,
  Tag,
  RefreshCw,
  Percent,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  useCacheStats,
  useClearCache,
  useInvalidateCacheByTag,
  useInvalidateCacheByPattern,
} from "../hooks/useAdmin";

export function CacheStatsPanel(): React.ReactElement {
  const { data: stats, isLoading, error, refetch } = useCacheStats();
  const clearCache = useClearCache();
  const invalidateByTag = useInvalidateCacheByTag();
  const invalidateByPattern = useInvalidateCacheByPattern();

  const [tagInput, setTagInput] = useState("");
  const [patternInput, setPatternInput] = useState("");

  const handleClearAll = async () => {
    try {
      await clearCache.mutateAsync();
      toast.success("Cache cleared");
    } catch {
      toast.error("Failed to clear cache");
    }
  };

  const handleInvalidateTag = async () => {
    if (!tagInput.trim()) return;
    try {
      const result = await invalidateByTag.mutateAsync(tagInput.trim());
      toast.success(`Invalidated ${result.invalidatedCount} entries`);
      setTagInput("");
    } catch {
      toast.error("Failed to invalidate by tag");
    }
  };

  const handleInvalidatePattern = async () => {
    if (!patternInput.trim()) return;
    try {
      const result = await invalidateByPattern.mutateAsync(patternInput.trim());
      toast.success(`Invalidated ${result.invalidatedCount} entries`);
      setPatternInput("");
    } catch {
      toast.error("Failed to invalidate by pattern");
    }
  };

  if (error) {
    return (
      <div className="bg-background rounded-lg border p-6">
        <p className="text-red-600 text-sm">Failed to load cache stats</p>
      </div>
    );
  }

  const usagePercent = stats ? (stats.size / stats.maxSize) * 100 : 0;

  return (
    <div className="bg-background rounded-lg border p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          Cache Statistics
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
        </div>
      ) : stats ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Percent className="h-4 w-4" />
                Hit Rate
              </div>
              <p className="text-2xl font-bold text-green-600">
                {stats.hitRatePercent}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Hits</div>
              <p className="text-2xl font-bold">
                {stats.hits.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Misses</div>
              <p className="text-2xl font-bold text-amber-600">
                {stats.misses.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <HardDrive className="h-4 w-4" />
                Size
              </div>
              <p className="text-2xl font-bold">
                {stats.size} / {stats.maxSize}
              </p>
            </div>
          </div>

          {/* Usage Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cache Usage</span>
              <span>{usagePercent.toFixed(1)}%</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>

          {/* Active Tags */}
          {stats.tags.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Active Tags</p>
              <div className="flex flex-wrap gap-2">
                {stats.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Invalidate by tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleInvalidateTag}
                disabled={!tagInput.trim() || invalidateByTag.isPending}
              >
                <Tag className="h-4 w-4 mr-1" />
                Invalidate Tag
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Invalidate by pattern (e.g., user:*)..."
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleInvalidatePattern}
                disabled={!patternInput.trim() || invalidateByPattern.isPending}
              >
                Invalidate Pattern
              </Button>
            </div>

            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearCache.isPending}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Cache
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
