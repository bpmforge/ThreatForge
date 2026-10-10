/**
 * Template List component for Component Template Manager.
 */
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit2, Trash2 } from "lucide-react";
import { COMPONENT_TYPE_OPTIONS } from "./constants";
import type { ComponentTemplate } from "../types";

interface TemplateListProps {
  templates: ComponentTemplate[];
  libraryName: string;
  onEdit: (template: ComponentTemplate) => void;
  onDelete: (template: ComponentTemplate) => void;
  onBack: () => void;
}

export function TemplateList({
  templates,
  libraryName,
  onEdit,
  onDelete,
  onBack,
}: TemplateListProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back to Libraries
        </Button>
        <span className="text-muted-foreground">|</span>
        <span className="font-medium">{libraryName}</span>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No templates yet. Create one to get started.
        </div>
      ) : (
        <ScrollArea className="h-[350px]">
          <div className="grid grid-cols-2 gap-3">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: tmpl.color || "#6366f1" }}
                    >
                      {tmpl.icon || tmpl.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium">{tmpl.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {COMPONENT_TYPE_OPTIONS.find(
                          (o) => o.value === tmpl.componentType,
                        )?.label ?? tmpl.componentType}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(tmpl)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDelete(tmpl)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>

                {tmpl.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {tmpl.description}
                  </p>
                )}

                {tmpl.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tmpl.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {tmpl.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{tmpl.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
