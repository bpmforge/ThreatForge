"use client";

/**
 * Mitigation Templates Panel
 *
 * Displays and manages templates within a library.
 */
import { useState } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Shield,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteAlertDialog } from "@/components/dialogs/DeleteAlertDialog";
import {
  useMitigationTemplates,
  useDeleteTemplate,
} from "../hooks/useMitigationLibraries";
import { TemplateDialog } from "./TemplateDialog";
import type { MitigationLibrary, MitigationTemplate } from "../types";

const STRATEGY_LABELS: Record<string, { label: string; color: string }> = {
  PREVENTION: { label: "Prevention", color: "bg-green-500" },
  DETECTION: { label: "Detection", color: "bg-blue-500" },
  RESPONSE: { label: "Response", color: "bg-yellow-500" },
  RECOVERY: { label: "Recovery", color: "bg-purple-500" },
  DETERRENCE: { label: "Deterrence", color: "bg-orange-500" },
};

const EFFORT_LABELS: Record<string, string> = {
  TRIVIAL: "Trivial",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  VERY_HIGH: "Very High",
};

interface MitigationTemplatesPanelProps {
  orgId: string;
  library: MitigationLibrary;
  onBack: () => void;
}

export function MitigationTemplatesPanel({
  orgId,
  library,
  onBack,
}: MitigationTemplatesPanelProps) {
  const {
    data: templates,
    isLoading,
    error,
  } = useMitigationTemplates(orgId, library.id);
  const deleteTemplate = useDeleteTemplate(orgId, library.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MitigationTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleEdit = (template: MitigationTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteTemplate.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {library.name}
              </CardTitle>
              <CardDescription>
                {library.description ||
                  "Manage mitigation templates in this library"}
              </CardDescription>
            </div>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading templates...
            </div>
          ) : error ? (
            <div className="text-destructive">Failed to load templates</div>
          ) : templates && templates.length > 0 ? (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{template.name}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs text-white ${
                            STRATEGY_LABELS[template.strategy]?.color ||
                            "bg-gray-500"
                          }`}
                        >
                          {STRATEGY_LABELS[template.strategy]?.label ||
                            template.strategy}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          Effort:{" "}
                          {EFFORT_LABELS[template.effort] || template.effort}
                        </span>
                        <span>
                          Effectiveness:{" "}
                          {EFFORT_LABELS[template.effectiveness] ||
                            template.effectiveness}
                        </span>
                        {template.tags.length > 0 && (
                          <span className="flex gap-1">
                            {template.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {template.tags.length > 3 && (
                              <span className="text-muted-foreground">
                                +{template.tags.length - 3}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(template.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No templates in this library</p>
              <p className="text-sm">
                Add templates to build your mitigation knowledge base
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        libraryId={library.id}
        template={editingTemplate}
      />

      <DeleteAlertDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Template"
      >
        Are you sure you want to delete this template? This action cannot be
        undone.
      </DeleteAlertDialog>
    </>
  );
}
