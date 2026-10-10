"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useThreatLibraries,
  useCreateThreatLibrary,
  useCreateThreatTemplate,
} from "@/features/threat-library";
import type { Threat } from "../types";
import type { StrideCategory, Severity } from "@/types/canvas";
import { toast } from "sonner";

export function useSaveAsTemplateForm(
  threat: Threat,
  onOpenChange: (open: boolean) => void,
) {
  const { data: libraries, isLoading: librariesLoading } = useThreatLibraries();
  const createLibrary = useCreateThreatLibrary();

  const ownedLibraries = useMemo(
    () => libraries?.filter((l) => l.isOwned && !l.isDefault) ?? [],
    [libraries],
  );

  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [showNewLibrary, setShowNewLibrary] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState("");

  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [descriptionOverride, setDescriptionOverride] = useState<string | null>(
    null,
  );
  const [strideCategoryOverride, setStrideCategoryOverride] =
    useState<StrideCategory | null>(null);
  const [severityOverride, setSeverityOverride] = useState<Severity | null>(
    null,
  );
  const [mitigationsOverride, setMitigationsOverride] = useState<
    string[] | null
  >(null);
  const [newMitigation, setNewMitigation] = useState("");

  const name = nameOverride ?? threat.name;
  const description = descriptionOverride ?? (threat.description || "");
  const strideCategory =
    strideCategoryOverride ?? (threat.strideCategories[0] || "TAMPERING");
  const severity = severityOverride ?? (threat.severity as Severity);
  const mitigations =
    mitigationsOverride ?? threat.mitigations.map((m) => m.description);

  const createTemplate = useCreateThreatTemplate(selectedLibraryId);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setNameOverride(null);
        setDescriptionOverride(null);
        setStrideCategoryOverride(null);
        setSeverityOverride(null);
        setMitigationsOverride(null);
        setSelectedLibraryId("");
        setShowNewLibrary(false);
        setNewLibraryName("");
        setNewMitigation("");
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (ownedLibraries.length > 0 && !selectedLibraryId) {
      queueMicrotask(() => setSelectedLibraryId(ownedLibraries[0].id));
    }
  }, [ownedLibraries, selectedLibraryId]);

  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim()) return;
    try {
      const newLib = await createLibrary.mutateAsync({
        name: newLibraryName.trim(),
        description: "Custom threat templates",
      });
      setSelectedLibraryId(newLib.id);
      setShowNewLibrary(false);
      setNewLibraryName("");
      toast.success("Library created");
    } catch {
      toast.error("Failed to create library");
    }
  };

  const handleAddMitigation = () => {
    if (!newMitigation.trim()) return;
    const current =
      mitigationsOverride ?? threat.mitigations.map((m) => m.description);
    setMitigationsOverride([...current, newMitigation.trim()]);
    setNewMitigation("");
  };

  const handleRemoveMitigation = (index: number) => {
    const current =
      mitigationsOverride ?? threat.mitigations.map((m) => m.description);
    setMitigationsOverride(current.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedLibraryId || !name.trim() || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        strideCategory,
        defaultSeverity: severity,
        suggestedMitigations: mitigations,
        applicableComponentTypes: [],
      });
      toast.success("Threat saved as template");
      handleOpenChange(false);
    } catch {
      toast.error("Failed to save template");
    }
  };

  return {
    ownedLibraries,
    librariesLoading,
    selectedLibraryId,
    setSelectedLibraryId,
    showNewLibrary,
    setShowNewLibrary,
    newLibraryName,
    setNewLibraryName,
    name,
    setNameOverride,
    description,
    setDescriptionOverride,
    strideCategory,
    setStrideCategoryOverride,
    severity,
    setSeverityOverride,
    mitigations,
    newMitigation,
    setNewMitigation,
    handleOpenChange,
    handleCreateLibrary,
    handleAddMitigation,
    handleRemoveMitigation,
    handleSave,
    isCreatingLibrary: createLibrary.isPending,
    isSaving: createTemplate.isPending,
  };
}
