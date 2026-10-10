"use client";

import { useState, useCallback } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import {
  useCreateSequenceDiagram,
  useDeleteSequenceDiagram,
  useUpdateSequenceDiagram,
} from "./useSequenceDiagrams";
import { useCreateDFD, useDeleteDFD, useUpdateDFD } from "@/features/dfd";
import type { DiagramTab } from "../types";

export type NewDiagramType = "sequence" | "dfd";

export function useDiagramTabs(threatModelId: string | null) {
  const tabs = useDiagramStore((s) => s.tabs);
  const activeTabId = useDiagramStore((s) => s.activeTabId);
  const setActiveTab = useDiagramStore((s) => s.setActiveTab);
  const addSequenceTab = useDiagramStore((s) => s.addSequenceTab);
  const addDfdTab = useDiagramStore((s) => s.addDfdTab);
  const removeTab = useDiagramStore((s) => s.removeTab);
  const renameTab = useDiagramStore((s) => s.renameTab);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newDiagramType, setNewDiagramType] =
    useState<NewDiagramType>("sequence");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState<DiagramTab | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<DiagramTab | null>(null);

  const createSequence = useCreateSequenceDiagram(threatModelId || "");
  const deleteSequence = useDeleteSequenceDiagram(threatModelId || "");
  const updateSequence = useUpdateSequenceDiagram(
    threatModelId || "",
    selectedTab?.sequenceDiagramId || "",
  );
  const createDfd = useCreateDFD(threatModelId || "");
  const deleteDfd = useDeleteDFD(threatModelId || "");
  const updateDfd = useUpdateDFD(threatModelId || "", selectedTab?.dfdId || "");

  const handleAddDiagram = useCallback(async () => {
    if (!threatModelId || !inputValue.trim()) return;
    try {
      if (newDiagramType === "sequence") {
        const diagram = await createSequence.mutateAsync({
          name: inputValue.trim(),
        });
        addSequenceTab(`sequence-${diagram.id}`, diagram.name, diagram.id);
      } else {
        const dfd = await createDfd.mutateAsync({
          name: inputValue.trim(),
          level: "CONTEXT",
        });
        addDfdTab(`dfd-${dfd.id}`, dfd.name, dfd.id);
      }
      setShowNewDialog(false);
      setInputValue("");
    } catch (error) {
      console.error(`Failed to create ${newDiagramType} diagram:`, error);
    }
  }, [
    threatModelId,
    inputValue,
    newDiagramType,
    createSequence,
    createDfd,
    addSequenceTab,
    addDfdTab,
  ]);

  const handleRename = useCallback(async () => {
    if (!selectedTab || !inputValue.trim()) return;
    try {
      if (selectedTab.type === "sequence" && selectedTab.sequenceDiagramId) {
        await updateSequence.mutateAsync({ name: inputValue.trim() });
      } else if (selectedTab.type === "dfd" && selectedTab.dfdId) {
        await updateDfd.mutateAsync({ name: inputValue.trim() });
      }
      renameTab(selectedTab.id, inputValue.trim());
      setShowRenameDialog(false);
      setSelectedTab(null);
      setInputValue("");
    } catch (error) {
      console.error("Failed to rename diagram:", error);
    }
  }, [selectedTab, inputValue, updateSequence, updateDfd, renameTab]);

  const handleDeleteClick = (tab: DiagramTab) => setDeleteConfirm(tab);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm || !threatModelId) return;
    try {
      if (
        deleteConfirm.type === "sequence" &&
        deleteConfirm.sequenceDiagramId
      ) {
        await deleteSequence.mutateAsync(deleteConfirm.sequenceDiagramId);
      } else if (deleteConfirm.type === "dfd" && deleteConfirm.dfdId) {
        await deleteDfd.mutateAsync(deleteConfirm.dfdId);
      }
      removeTab(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete diagram:", error);
    }
  }, [deleteConfirm, threatModelId, deleteSequence, deleteDfd, removeTab]);

  const openRenameDialog = (tab: DiagramTab) => {
    setSelectedTab(tab);
    setInputValue(tab.label);
    setShowRenameDialog(true);
  };

  return {
    tabs,
    activeTabId,
    setActiveTab,
    showNewDialog,
    setShowNewDialog,
    newDiagramType,
    setNewDiagramType,
    showRenameDialog,
    setShowRenameDialog,
    selectedTab,
    inputValue,
    setInputValue,
    deleteConfirm,
    setDeleteConfirm,
    handleAddDiagram,
    handleRename,
    handleDeleteClick,
    handleDeleteConfirm,
    openRenameDialog,
    isCreating: createSequence.isPending || createDfd.isPending,
    isRenaming: updateSequence.isPending || updateDfd.isPending,
  };
}
