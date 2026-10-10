"use client";

import React from "react";
import { Save, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePrompt,
  useCreatePrompt,
  useUpdatePrompt,
} from "../hooks/usePrompts";
import { usePromptEditorState } from "../hooks/usePromptEditorState";
import type { PromptTemplate } from "../types";
import { PromptMetadataForm } from "./editor/PromptMetadataForm";
import { PromptVariablesPanel } from "./editor/PromptVariablesPanel";
import { PromptPreviewPanel } from "./editor/PromptPreviewPanel";
import { PromptUserPromptTab } from "./editor/PromptUserPromptTab";
import { PromptOutputTab } from "./editor/PromptOutputTab";

interface PromptEditorProps {
  orgId: string;
  promptId?: string;
  onSave?: (prompt: PromptTemplate) => void;
  onCancel?: () => void;
}

export function PromptEditor({
  orgId,
  promptId,
  onSave,
  onCancel,
}: PromptEditorProps): React.ReactElement {
  const isEditing = !!promptId;
  const { data: existingPrompt, isLoading } = usePrompt(orgId, promptId);
  const createMutation = useCreatePrompt(orgId);
  const updateMutation = useUpdatePrompt(orgId);
  const isReadOnly = existingPrompt?.isBuiltIn ?? false;

  const s = usePromptEditorState(existingPrompt);

  const handleSave = async () => {
    if (isReadOnly) return;
    const vals = s.getFormValues();
    const input = {
      name: vals.name,
      description: vals.description,
      category: vals.category,
      systemPrompt: "",
      userPromptTemplate: vals.userPromptTemplate,
      variables: JSON.stringify(vals.variables),
      outputFormat: vals.outputFormat,
      outputSchema: vals.outputSchema || undefined,
      temperature: vals.temperature,
      maxTokens: vals.maxTokens,
      requiresVision: vals.requiresVision,
      tags: JSON.stringify(vals.tags),
    };
    try {
      if (isEditing && promptId) {
        onSave?.(await updateMutation.mutateAsync({ promptId, input }));
      } else {
        onSave?.(await createMutation.mutateAsync(input));
      }
    } catch {
      // handled by mutation
    }
  };

  if (isEditing && isLoading)
    return <div className="p-4">Loading prompt...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {isReadOnly && <Lock className="h-4 w-4 text-muted-foreground" />}
            {isReadOnly
              ? "View Prompt"
              : isEditing
                ? "Edit Prompt"
                : "Create Prompt"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isReadOnly
              ? "Built-in prompt (read-only). Clone to customize."
              : "Configure the AI prompt template"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              {isReadOnly ? "Back" : "Cancel"}
            </Button>
          )}
          {!isReadOnly && (
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Save Changes" : "Create Prompt"}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="prompts">User Prompt</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
        </TabsList>

        <PromptMetadataForm
          name={s.name}
          description={s.description}
          category={s.category}
          tags={s.tags}
          newTag={s.newTag}
          requiresVision={s.requiresVision}
          isReadOnly={isReadOnly}
          onNameChange={s.setName}
          onDescriptionChange={s.setDescription}
          onCategoryChange={s.setCategory}
          onNewTagChange={s.setNewTag}
          onAddTag={s.addTag}
          onRemoveTag={s.removeTag}
          onRequiresVisionChange={s.setRequiresVision}
        />

        <PromptUserPromptTab
          value={s.userPromptTemplate}
          isReadOnly={isReadOnly}
          isEditing={isEditing}
          onChange={s.setUserPromptTemplate}
          onOpenPreview={() => s.setPreviewOpen(true)}
        />

        <PromptVariablesPanel
          variables={s.variables}
          isReadOnly={isReadOnly}
          onUpdateVariable={s.updateVariable}
        />

        <PromptOutputTab
          outputFormat={s.outputFormat}
          outputSchema={s.outputSchema}
          temperature={s.temperature}
          maxTokens={s.maxTokens}
          isReadOnly={isReadOnly}
          onOutputFormatChange={s.setOutputFormat}
          onOutputSchemaChange={s.setOutputSchema}
          onTemperatureChange={s.setTemperature}
          onMaxTokensChange={s.setMaxTokens}
        />
      </Tabs>

      <PromptPreviewPanel
        open={s.previewOpen}
        variables={s.variables}
        previewVariables={s.previewVariables}
        previewResult={s.previewResult}
        previewLoading={s.previewLoading}
        onOpenChange={s.setPreviewOpen}
        onPreviewVariableChange={(name, value) =>
          s.setPreviewVariables({ ...s.previewVariables, [name]: value })
        }
        onGeneratePreview={() => promptId && s.handlePreview(orgId, promptId)}
      />
    </div>
  );
}
