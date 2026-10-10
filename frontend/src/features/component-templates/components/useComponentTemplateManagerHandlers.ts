import { useState, useCallback } from "react";
import {
  useCreateComponentTemplateLibrary,
  useUpdateComponentTemplateLibrary,
  useDeleteComponentTemplateLibrary,
  useCreateComponentTemplate,
  useUpdateComponentTemplate,
  useDeleteComponentTemplate,
  useImportComponentTemplateLibrary,
  useExportComponentTemplateLibrary,
} from "../hooks/useComponentTemplates";
import type {
  ComponentTemplateLibrary,
  ComponentTemplate,
  CreateTemplateRequest,
} from "../types";

interface UseComponentTemplateManagerHandlersProps {
  organizationId: string;
}

export function useComponentTemplateManagerHandlers({
  organizationId,
}: UseComponentTemplateManagerHandlersProps) {
  const [activeTab, setActiveTab] = useState<"libraries" | "templates">(
    "libraries",
  );
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(
    null,
  );
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingLibrary, setEditingLibrary] =
    useState<ComponentTemplateLibrary | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<ComponentTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "library" | "template";
    id: string;
    name: string;
  } | null>(null);

  const createLibrary = useCreateComponentTemplateLibrary(organizationId);
  const updateLibrary = useUpdateComponentTemplateLibrary(
    organizationId,
    selectedLibraryId ?? "",
  );
  const deleteLibrary = useDeleteComponentTemplateLibrary(organizationId);
  const createTemplate = useCreateComponentTemplate(
    organizationId,
    selectedLibraryId ?? "",
  );
  const updateTemplate = useUpdateComponentTemplate(
    organizationId,
    selectedLibraryId ?? "",
    editingTemplate?.id ?? "",
  );
  const deleteTemplate = useDeleteComponentTemplate(
    organizationId,
    selectedLibraryId ?? "",
  );
  const importLibrary = useImportComponentTemplateLibrary(organizationId);
  const exportLibrary = useExportComponentTemplateLibrary(organizationId);

  const handleLibrarySubmit = useCallback(
    async (data: {
      name: string;
      description?: string;
      isPublic?: boolean;
    }) => {
      if (editingLibrary) {
        await updateLibrary.mutateAsync(data);
        setEditingLibrary(null);
      } else {
        await createLibrary.mutateAsync(data);
      }
      setShowLibraryForm(false);
    },
    [createLibrary, updateLibrary, editingLibrary],
  );

  const handleDeleteLibrary = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "library") return;
    await deleteLibrary.mutateAsync(deleteConfirm.id);
    if (selectedLibraryId === deleteConfirm.id) {
      setSelectedLibraryId(null);
    }
    setDeleteConfirm(null);
  }, [deleteLibrary, selectedLibraryId, deleteConfirm]);

  const handleTemplateSubmit = useCallback(
    async (data: CreateTemplateRequest) => {
      if (editingTemplate) {
        await updateTemplate.mutateAsync(data);
        setEditingTemplate(null);
      } else {
        await createTemplate.mutateAsync(data);
      }
      setShowTemplateForm(false);
    },
    [createTemplate, updateTemplate, editingTemplate],
  );

  const handleDeleteTemplate = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "template") return;
    await deleteTemplate.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  }, [deleteTemplate, deleteConfirm]);

  const handleExport = useCallback(
    async (libraryId: string) => {
      const data = await exportLibrary.mutateAsync(libraryId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `component-templates-${data.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [exportLibrary],
  );

  const handleImport = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      await importLibrary.mutateAsync(data);
    };
    input.click();
  }, [importLibrary]);

  return {
    activeTab,
    setActiveTab,
    selectedLibraryId,
    setSelectedLibraryId,
    showLibraryForm,
    setShowLibraryForm,
    showTemplateForm,
    setShowTemplateForm,
    editingLibrary,
    setEditingLibrary,
    editingTemplate,
    setEditingTemplate,
    deleteConfirm,
    setDeleteConfirm,
    createLibrary,
    updateLibrary,
    createTemplate,
    updateTemplate,
    handleLibrarySubmit,
    handleDeleteLibrary,
    handleTemplateSubmit,
    handleDeleteTemplate,
    handleExport,
    handleImport,
  };
}
