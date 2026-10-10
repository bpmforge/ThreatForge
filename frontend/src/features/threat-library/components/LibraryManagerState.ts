/**
 * Library Manager State Hook
 *
 * Manages state and operations for the library manager dialog.
 */
"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useThreatLibraries,
  useThreatLibraryDetails,
  useCreateThreatLibrary,
  useUpdateThreatLibrary,
  useDeleteThreatLibrary,
  useCreateThreatTemplate,
  useUpdateThreatTemplate,
  useDeleteThreatTemplate,
  useImportThreatLibrary,
  useExportThreatLibrary,
} from "../hooks/useThreatLibraryApi";
import type {
  ThreatLibrary,
  ThreatTemplate,
  CreateLibraryRequest,
  CreateTemplateRequest,
} from "../types";

export interface DeleteConfirmState {
  type: "library" | "template";
  id: string;
  name: string;
}

const defaultLibraryForm: CreateLibraryRequest = {
  name: "",
  description: "",
  isPublic: false,
};

const defaultTemplateForm: CreateTemplateRequest = {
  name: "",
  description: "",
  strideCategory: "SPOOFING",
  defaultSeverity: "MEDIUM",
  applicableComponentTypes: [],
  suggestedMitigations: [],
};

export function useLibraryManagerState() {
  // Selection state
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(
    null,
  );
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<ThreatLibrary | null>(
    null,
  );
  const [editingTemplate, setEditingTemplate] = useState<ThreatTemplate | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(
    null,
  );

  // Form state
  const [libraryForm, setLibraryForm] =
    useState<CreateLibraryRequest>(defaultLibraryForm);
  const [templateForm, setTemplateForm] =
    useState<CreateTemplateRequest>(defaultTemplateForm);
  const [mitigationInput, setMitigationInput] = useState("");

  // Queries
  const { data: libraries, isLoading } = useThreatLibraries();
  const { data: selectedLibrary } = useThreatLibraryDetails(
    selectedLibraryId || undefined,
  );

  // Mutations
  const createLibrary = useCreateThreatLibrary();
  const updateLibrary = useUpdateThreatLibrary(selectedLibraryId || "");
  const deleteLibrary = useDeleteThreatLibrary();
  const createTemplate = useCreateThreatTemplate(selectedLibraryId || "");
  const updateTemplate = useUpdateThreatTemplate(
    selectedLibraryId || "",
    editingTemplate?.id || "",
  );
  const deleteTemplate = useDeleteThreatTemplate(selectedLibraryId || "");
  const importLibrary = useImportThreatLibrary();
  const exportLibrary = useExportThreatLibrary();

  // Library handlers - use mutate() with onSuccess, errors handled by mutation hooks
  const handleCreateLibrary = useCallback(() => {
    if (!libraryForm.name.trim()) return;
    createLibrary.mutate(libraryForm, {
      onSuccess: () => {
        setShowLibraryForm(false);
        setLibraryForm(defaultLibraryForm);
      },
    });
  }, [libraryForm, createLibrary]);

  const handleUpdateLibrary = useCallback(() => {
    if (!editingLibrary || !libraryForm.name.trim()) return;
    updateLibrary.mutate(libraryForm, {
      onSuccess: () => {
        setEditingLibrary(null);
        setShowLibraryForm(false);
        setLibraryForm(defaultLibraryForm);
      },
    });
  }, [editingLibrary, libraryForm, updateLibrary]);

  const handleDeleteLibrary = useCallback(() => {
    if (!deleteConfirm || deleteConfirm.type !== "library") return;
    deleteLibrary.mutate(deleteConfirm.id, {
      onSuccess: () => {
        if (selectedLibraryId === deleteConfirm.id) {
          setSelectedLibraryId(null);
        }
        setDeleteConfirm(null);
      },
    });
  }, [deleteConfirm, deleteLibrary, selectedLibraryId]);

  const startEditLibrary = useCallback((library: ThreatLibrary) => {
    setEditingLibrary(library);
    setLibraryForm({
      name: library.name,
      description: library.description || "",
      isPublic: library.isPublic,
    });
    setShowLibraryForm(true);
  }, []);

  const startNewLibrary = useCallback(() => {
    setEditingLibrary(null);
    setLibraryForm(defaultLibraryForm);
    setShowLibraryForm(true);
  }, []);

  const cancelLibraryForm = useCallback(() => {
    setShowLibraryForm(false);
    setEditingLibrary(null);
  }, []);

  // Template handlers
  const resetTemplateForm = useCallback(() => {
    setTemplateForm(defaultTemplateForm);
    setMitigationInput("");
  }, []);

  const handleCreateTemplate = useCallback(() => {
    if (!selectedLibraryId || !templateForm.name.trim()) return;
    createTemplate.mutate(templateForm, {
      onSuccess: () => {
        setShowTemplateForm(false);
        resetTemplateForm();
      },
    });
  }, [selectedLibraryId, templateForm, createTemplate, resetTemplateForm]);

  const handleUpdateTemplate = useCallback(() => {
    if (!editingTemplate || !templateForm.name.trim()) return;
    updateTemplate.mutate(templateForm, {
      onSuccess: () => {
        setEditingTemplate(null);
        setShowTemplateForm(false);
        resetTemplateForm();
      },
    });
  }, [editingTemplate, templateForm, updateTemplate, resetTemplateForm]);

  const handleDeleteTemplate = useCallback(() => {
    if (!deleteConfirm || deleteConfirm.type !== "template") return;
    deleteTemplate.mutate(deleteConfirm.id, {
      onSuccess: () => {
        setDeleteConfirm(null);
      },
    });
  }, [deleteConfirm, deleteTemplate]);

  const startEditTemplate = useCallback((template: ThreatTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description,
      strideCategory: template.strideCategory,
      defaultSeverity: template.defaultSeverity,
      applicableComponentTypes: template.applicableComponentTypes,
      suggestedMitigations: template.suggestedMitigations,
    });
    setShowTemplateForm(true);
  }, []);

  const startNewTemplate = useCallback(() => {
    setEditingTemplate(null);
    resetTemplateForm();
    setShowTemplateForm(true);
  }, [resetTemplateForm]);

  const cancelTemplateForm = useCallback(() => {
    setShowTemplateForm(false);
    setEditingTemplate(null);
  }, []);

  const addMitigation = useCallback(() => {
    if (!mitigationInput.trim()) return;
    setTemplateForm((prev) => ({
      ...prev,
      suggestedMitigations: [
        ...(prev.suggestedMitigations || []),
        mitigationInput.trim(),
      ],
    }));
    setMitigationInput("");
  }, [mitigationInput]);

  const removeMitigation = useCallback((index: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      suggestedMitigations: prev.suggestedMitigations?.filter(
        (_, i) => i !== index,
      ),
    }));
  }, []);

  const updateTemplateField = useCallback(
    <K extends keyof CreateTemplateRequest>(
      field: K,
      value: CreateTemplateRequest[K],
    ) => {
      setTemplateForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Export handler - use mutate with onSuccess for download logic
  const handleExport = useCallback(
    (libraryId: string) => {
      exportLibrary.mutate(libraryId, {
        onSuccess: (data) => {
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${data.name.replace(/\s+/g, "-").toLowerCase()}-threats.json`;
          a.click();
          URL.revokeObjectURL(url);
        },
      });
    },
    [exportLibrary],
  );

  // Import handler - JSON.parse can legitimately throw, so keep try-catch for that only
  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        toast.error("Invalid JSON file");
        return;
      }

      importLibrary.mutate(data, {
        onSuccess: () => {
          event.target.value = "";
        },
      });
    },
    [importLibrary],
  );

  return {
    // Data
    libraries,
    selectedLibrary,
    isLoading,
    selectedLibraryId,
    setSelectedLibraryId,

    // Library state
    showLibraryForm,
    editingLibrary,
    libraryForm,
    setLibraryForm,

    // Library handlers
    handleCreateLibrary,
    handleUpdateLibrary,
    handleDeleteLibrary,
    startEditLibrary,
    startNewLibrary,
    cancelLibraryForm,
    createLibraryPending: createLibrary.isPending,
    updateLibraryPending: updateLibrary.isPending,

    // Template state
    showTemplateForm,
    editingTemplate,
    templateForm,
    mitigationInput,
    setMitigationInput,

    // Template handlers
    handleCreateTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    startEditTemplate,
    startNewTemplate,
    cancelTemplateForm,
    addMitigation,
    removeMitigation,
    updateTemplateField,
    createTemplatePending: createTemplate.isPending,
    updateTemplatePending: updateTemplate.isPending,

    // Delete confirmation
    deleteConfirm,
    setDeleteConfirm,

    // Import/Export
    handleExport,
    handleImport,
  };
}
