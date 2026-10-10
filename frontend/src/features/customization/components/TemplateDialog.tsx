"use client";

/**
 * Mitigation Template Create/Edit Dialog
 */
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateTemplate,
  useUpdateTemplate,
} from "../hooks/useMitigationLibraries";
import type {
  MitigationTemplate,
  CreateTemplateData,
  MitigationStrategy,
  EffortLevel,
  EffectivenessLevel,
} from "../types";

const STRATEGY_OPTIONS: { value: MitigationStrategy; label: string }[] = [
  { value: "PREVENTION", label: "Prevention" },
  { value: "DETECTION", label: "Detection" },
  { value: "RESPONSE", label: "Response" },
  { value: "RECOVERY", label: "Recovery" },
  { value: "DETERRENCE", label: "Deterrence" },
];

const EFFORT_OPTIONS: { value: EffortLevel; label: string }[] = [
  { value: "TRIVIAL", label: "Trivial" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very High" },
];

const EFFECTIVENESS_OPTIONS: { value: EffectivenessLevel; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very High" },
];

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  libraryId: string;
  template: MitigationTemplate | null;
}

interface FormState {
  name: string;
  description: string;
  strategy: MitigationStrategy;
  effort: EffortLevel;
  effectiveness: EffectivenessLevel;
  tags: string;
  implementationSteps: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  strategy: "PREVENTION",
  effort: "MEDIUM",
  effectiveness: "MEDIUM",
  tags: "",
  implementationSteps: "",
};

export function TemplateDialog({
  open,
  onOpenChange,
  orgId,
  libraryId,
  template,
}: TemplateDialogProps) {
  const createTemplate = useCreateTemplate(orgId, libraryId);
  const updateTemplate = useUpdateTemplate(orgId, libraryId);

  // Track whether user has started editing
  const [formEdits, setFormEdits] = useState<Partial<FormState>>({});

  const isEditing = !!template;

  // Derive form values: use edits if present, otherwise template data or defaults
  const getFormValue = <K extends keyof FormState>(key: K): FormState[K] => {
    if (key in formEdits) return formEdits[key] as FormState[K];
    if (template) {
      if (key === "tags") return template.tags.join(", ") as FormState[K];
      if (key === "implementationSteps")
        return template.implementationSteps.join("\n") as FormState[K];
      return template[key as keyof typeof template] as FormState[K];
    }
    return DEFAULT_FORM[key];
  };

  const name = getFormValue("name");
  const description = getFormValue("description");
  const strategy = getFormValue("strategy");
  const effort = getFormValue("effort");
  const effectiveness = getFormValue("effectiveness");
  const tags = getFormValue("tags");
  const implementationSteps = getFormValue("implementationSteps");

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setFormEdits((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setFormEdits({});
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  const handleSubmit = () => {
    if (!name.trim() || !description.trim()) return;

    const data: CreateTemplateData = {
      name: name.trim(),
      description: description.trim(),
      strategy,
      effort,
      effectiveness,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      implementationSteps: implementationSteps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const onSuccess = () => onOpenChange(false);

    if (isEditing) {
      updateTemplate.mutate({ templateId: template.id, data }, { onSuccess });
    } else {
      createTemplate.mutate(data, { onSuccess });
    }
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Template" : "Create Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the mitigation template details"
              : "Create a reusable mitigation template"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tmpl-name">Name</Label>
            <Input
              id="tmpl-name"
              value={name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., Input Validation, Rate Limiting"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmpl-description">Description</Label>
            <Textarea
              id="tmpl-description"
              value={description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Describe what this mitigation does and when to apply it..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select
                value={strategy}
                onValueChange={(v) =>
                  updateField("strategy", v as MitigationStrategy)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Effort</Label>
              <Select
                value={effort}
                onValueChange={(v) => updateField("effort", v as EffortLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Effectiveness</Label>
              <Select
                value={effectiveness}
                onValueChange={(v) =>
                  updateField("effectiveness", v as EffectivenessLevel)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFECTIVENESS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmpl-steps">
              Implementation Steps (one per line)
            </Label>
            <Textarea
              id="tmpl-steps"
              value={implementationSteps}
              onChange={(e) =>
                updateField("implementationSteps", e.target.value)
              }
              placeholder="Step 1: Identify input fields&#10;Step 2: Define validation rules&#10;Step 3: Implement server-side validation"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmpl-tags">Tags (comma-separated)</Label>
            <Input
              id="tmpl-tags"
              value={tags}
              onChange={(e) => updateField("tags", e.target.value)}
              placeholder="e.g., OWASP, Input, XSS, SQL Injection"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || !description.trim()}
          >
            {isPending
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
