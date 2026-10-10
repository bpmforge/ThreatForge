import { useCallback, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas";

interface UseMultiSelectReturn {
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  select: (id: string, additive?: boolean) => void;
  deselect: (id: string) => void;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectCount: number;
}

export function useMultiSelect(): UseMultiSelectReturn {
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const setSelection = useCanvasStore((s) => s.setSelection);

  const isSelected = useCallback(
    (id: string) => selectedNodeIds.includes(id),
    [selectedNodeIds],
  );

  const select = useCallback(
    (id: string, additive = false) => {
      if (additive) {
        setSelection([...selectedNodeIds, id], []);
      } else {
        setSelection([id], []);
      }
    },
    [selectedNodeIds, setSelection],
  );

  const deselect = useCallback(
    (id: string) => {
      setSelection(
        selectedNodeIds.filter((nodeId) => nodeId !== id),
        [],
      );
    },
    [selectedNodeIds, setSelection],
  );

  const toggle = useCallback(
    (id: string) => {
      if (isSelected(id)) {
        deselect(id);
      } else {
        select(id, true);
      }
    },
    [isSelected, deselect, select],
  );

  const selectAll = useCallback(() => {
    const nodes = useCanvasStore.getState().nodes;
    const selectableNodes = nodes.filter((node) => node.type !== "boundary");
    setSelection(
      selectableNodes.map((node) => node.id),
      [],
    );
  }, [setSelection]);

  const clearSelection = useCallback(() => {
    setSelection([], []);
  }, [setSelection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        selectAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectAll, clearSelection]);

  return {
    selectedIds: selectedNodeIds,
    isSelected,
    select,
    deselect,
    toggle,
    selectAll,
    clearSelection,
    selectCount: selectedNodeIds.length,
  };
}
