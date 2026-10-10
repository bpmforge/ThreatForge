/**
 * Templates Tab
 *
 * Tab content for managing threat templates within a library.
 */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type {
  ThreatLibrary,
  ThreatTemplate,
  CreateTemplateRequest,
} from "../types";
import { STRIDE_FULL_NAMES, SEVERITY_COLORS } from "../constants";
import type { StrideCategory, Severity } from "@/types/canvas";

const STRIDE_CATEGORIES: StrideCategory[] = [
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
];

const SEVERITY_OPTIONS: Severity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
];

interface TemplatesTabProps {
  selectedLibrary: ThreatLibrary | undefined;
  showTemplateForm: boolean;
  editingTemplate: ThreatTemplate | null;
  templateForm: CreateTemplateRequest;
  mitigationInput: string;
  onMitigationInputChange: (value: string) => void;
  onTemplateFieldChange: <K extends keyof CreateTemplateRequest>(
    field: K,
    value: CreateTemplateRequest[K],
  ) => void;
  onCreateTemplate: () => void;
  onUpdateTemplate: () => void;
  onStartEdit: (template: ThreatTemplate) => void;
  onStartNew: () => void;
  onCancel: () => void;
  onAddMitigation: () => void;
  onRemoveMitigation: (index: number) => void;
  onDelete: (template: ThreatTemplate) => void;
  createPending: boolean;
  updatePending: boolean;
}

export function TemplatesTab({
  selectedLibrary,
  showTemplateForm,
  editingTemplate,
  templateForm,
  mitigationInput,
  onMitigationInputChange,
  onTemplateFieldChange,
  onCreateTemplate,
  onUpdateTemplate,
  onStartEdit,
  onStartNew,
  onCancel,
  onAddMitigation,
  onRemoveMitigation,
  onDelete,
  createPending,
  updatePending,
}: TemplatesTabProps) {
  if (!selectedLibrary) return null;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium">{selectedLibrary.name}</h4>
        {selectedLibrary.isOwned && !selectedLibrary.isDefault && (
          <Button size="sm" onClick={onStartNew}>
            <Plus className="h-4 w-4 mr-1" />
            New Template
          </Button>
        )}
      </div>

      {showTemplateForm && (
        <div className="mb-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-medium mb-3">
            {editingTemplate ? "Edit Template" : "New Template"}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  value={templateForm.name}
                  onChange={(e) =>
                    onTemplateFieldChange("name", e.target.value)
                  }
                  placeholder="SQL Injection"
                />
              </div>
              <div>
                <Label htmlFor="tpl-cat">STRIDE Category</Label>
                <Select
                  value={templateForm.strideCategory}
                  onValueChange={(v) =>
                    onTemplateFieldChange("strideCategory", v as StrideCategory)
                  }
                >
                  <SelectTrigger id="tpl-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRIDE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {STRIDE_FULL_NAMES[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tpl-sev">Default Severity</Label>
                <Select
                  value={templateForm.defaultSeverity}
                  onValueChange={(v) =>
                    onTemplateFieldChange("defaultSeverity", v as Severity)
                  }
                >
                  <SelectTrigger id="tpl-sev">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((sev) => (
                      <SelectItem key={sev} value={sev}>
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-2 ${SEVERITY_COLORS[sev]}`}
                        />
                        {sev}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="tpl-desc">Description</Label>
                <Textarea
                  id="tpl-desc"
                  value={templateForm.description}
                  onChange={(e) =>
                    onTemplateFieldChange("description", e.target.value)
                  }
                  placeholder="Describe the threat..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Suggested Mitigations</Label>
                <div className="flex gap-2">
                  <Input
                    value={mitigationInput}
                    onChange={(e) => onMitigationInputChange(e.target.value)}
                    placeholder="Add mitigation..."
                    onKeyDown={(e) => e.key === "Enter" && onAddMitigation()}
                  />
                  <Button size="sm" variant="outline" onClick={onAddMitigation}>
                    Add
                  </Button>
                </div>
                {templateForm.suggestedMitigations &&
                  templateForm.suggestedMitigations.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {templateForm.suggestedMitigations.map((m, i) => (
                        <li
                          key={i}
                          className="text-xs flex items-center justify-between bg-muted px-2 py-1 rounded"
                        >
                          <span className="truncate">{m}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => onRemoveMitigation(i)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              onClick={editingTemplate ? onUpdateTemplate : onCreateTemplate}
              disabled={createPending || updatePending}
            >
              {editingTemplate ? "Save" : "Create"}
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[300px]">
        {!selectedLibrary.templates?.length ? (
          <p className="text-sm text-muted-foreground">
            No templates in this library.
          </p>
        ) : (
          <div className="space-y-2">
            {selectedLibrary.templates.map((template) => (
              <div
                key={template.id}
                className="p-3 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded ${SEVERITY_COLORS[template.defaultSeverity]} text-white`}
                      >
                        {template.defaultSeverity}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {template.strideCategory.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h5 className="font-medium mt-1">{template.name}</h5>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {template.description}
                    </p>
                  </div>
                  {selectedLibrary.isOwned && !selectedLibrary.isDefault && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onStartEdit(template)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onDelete(template)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}
