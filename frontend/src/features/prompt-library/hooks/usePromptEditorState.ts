import { useState, useEffect } from "react";
import * as api from "../services/api";
import type {
  PromptTemplate,
  PromptVariable,
  PromptCategory,
  PromptOutputFormat,
} from "../types";
import { parseVariables } from "../types";

interface PromptEditorState {
  name: string;
  description: string;
  category: PromptCategory;
  userPromptTemplate: string;
  variables: PromptVariable[];
  outputFormat: PromptOutputFormat;
  outputSchema: string;
  temperature: number;
  maxTokens: number;
  requiresVision: boolean;
  tags: string[];
  newTag: string;
  previewOpen: boolean;
  previewVariables: Record<string, string>;
  previewResult: { userPrompt: string } | null;
  previewLoading: boolean;
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setCategory: (v: PromptCategory) => void;
  setUserPromptTemplate: (v: string) => void;
  setOutputFormat: (v: PromptOutputFormat) => void;
  setOutputSchema: (v: string) => void;
  setTemperature: (v: number) => void;
  setMaxTokens: (v: number) => void;
  setRequiresVision: (v: boolean) => void;
  setNewTag: (v: string) => void;
  setPreviewOpen: (v: boolean) => void;
  setPreviewVariables: (v: Record<string, string>) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  updateVariable: (index: number, updates: Partial<PromptVariable>) => void;
  handlePreview: (orgId: string, promptId: string) => Promise<void>;
  getFormValues: () => {
    name: string;
    description: string;
    category: PromptCategory;
    userPromptTemplate: string;
    variables: PromptVariable[];
    outputFormat: PromptOutputFormat;
    outputSchema: string;
    temperature: number;
    maxTokens: number;
    requiresVision: boolean;
    tags: string[];
  };
}

export function usePromptEditorState(
  existingPrompt?: PromptTemplate,
): PromptEditorState {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PromptCategory>("EXTRACTION");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [outputFormat, setOutputFormat] = useState<PromptOutputFormat>("JSON");
  const [outputSchema, setOutputSchema] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [requiresVision, setRequiresVision] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<
    Record<string, string>
  >({});
  const [previewResult, setPreviewResult] = useState<{
    userPrompt: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (existingPrompt) {
      setName(existingPrompt.name);
      setDescription(existingPrompt.description || "");
      setCategory(existingPrompt.category);
      setUserPromptTemplate(existingPrompt.userPromptTemplate);
      setVariables(parseVariables(existingPrompt));
      setOutputFormat(existingPrompt.outputFormat);
      setOutputSchema(existingPrompt.outputSchema || "");
      setTemperature(existingPrompt.temperature);
      setMaxTokens(existingPrompt.maxTokens);
      setRequiresVision(existingPrompt.requiresVision);
      try {
        setTags(JSON.parse(existingPrompt.tags || "[]"));
      } catch {
        setTags([]);
      }
    }
  }, [existingPrompt]);

  useEffect(() => {
    const matches = userPromptTemplate.match(/\{\{(\w+)\}\}/g) || [];
    const varNames = [...new Set(matches.map((m) => m.replace(/[{}]/g, "")))];
    setVariables(
      varNames.map(
        (n) =>
          variables.find((v) => v.name === n) || {
            name: n,
            type: "text",
            required: true,
          },
      ),
    );
  }, [userPromptTemplate]);

  return {
    name,
    description,
    category,
    userPromptTemplate,
    variables,
    outputFormat,
    outputSchema,
    temperature,
    maxTokens,
    requiresVision,
    tags,
    newTag,
    previewOpen,
    previewVariables,
    previewResult,
    previewLoading,
    setName,
    setDescription,
    setCategory,
    setUserPromptTemplate,
    setOutputFormat,
    setOutputSchema,
    setTemperature,
    setMaxTokens,
    setRequiresVision,
    setNewTag,
    setPreviewOpen,
    setPreviewVariables,
    addTag: () => {
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
        setNewTag("");
      }
    },
    removeTag: (tag: string) => setTags(tags.filter((t) => t !== tag)),
    updateVariable: (index: number, updates: Partial<PromptVariable>) => {
      const next = [...variables];
      next[index] = { ...next[index], ...updates };
      setVariables(next);
    },
    handlePreview: async (orgId: string, promptId: string) => {
      setPreviewLoading(true);
      try {
        const result = await api.previewPrompt(
          orgId,
          promptId,
          previewVariables,
        );
        setPreviewResult({ userPrompt: result.userPrompt });
      } catch (error) {
        console.error("Preview failed:", error);
      } finally {
        setPreviewLoading(false);
      }
    },
    getFormValues: () => ({
      name,
      description,
      category,
      userPromptTemplate,
      variables,
      outputFormat,
      outputSchema,
      temperature,
      maxTokens,
      requiresVision,
      tags,
    }),
  };
}
