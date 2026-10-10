/**
 * Library List component for Component Template Manager.
 */
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Edit2, Trash2, Globe, Lock } from "lucide-react";
import type { ComponentTemplateLibrary } from "../types";

interface LibraryListProps {
  libraries: ComponentTemplateLibrary[];
  selectedLibraryId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onEdit: (library: ComponentTemplateLibrary) => void;
  onDelete: (library: ComponentTemplateLibrary) => void;
  onExport: (id: string) => void;
}

export function LibraryList({
  libraries,
  isLoading,
  onSelect,
  onEdit,
  onDelete,
  onExport,
}: LibraryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (libraries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No libraries yet. Create one to get started.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {libraries.map((lib) => (
          <div
            key={lib.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
            onClick={() => onSelect(lib.id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{lib.name}</span>
                {lib.isPublic ? (
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Public
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Private
                  </Badge>
                )}
                {lib.isDefault && <Badge variant="default">Default</Badge>}
              </div>
              {lib.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {lib.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {lib.templateCount ?? 0} templates
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport(lib.id);
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              {lib.isOwned && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(lib);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(lib);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
