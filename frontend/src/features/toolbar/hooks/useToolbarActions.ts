/**
 * Toolbar actions hook - handles save/load operations.
 */
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useCanvasStore } from "@/stores/canvas";
import * as api from "../services/api";
import type { ThreatModel } from "../types";
import { useExportActions } from "./useExportActions";

interface UseToolbarActionsOptions {
  currentModelId: string | null;
  currentModelName: string;
  onModelChange: (id: string | null, name: string) => void;
}

export function useToolbarActions({
  currentModelId,
  currentModelName,
  onModelChange,
}: UseToolbarActionsOptions) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const markSaved = useCanvasStore((s) => s.markSaved);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<ThreatModel[]>([]);

  const exportActions = useExportActions(currentModelId, currentModelName);

  const fetchModels = useCallback(async () => {
    try {
      const data = await api.fetchModels();
      setModels(data);
    } catch {
      toast.error("Failed to fetch models");
    }
  }, []);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!currentModelId) return false;
    setSaving(true);
    try {
      await api.saveCanvas(currentModelId, nodes, edges);
      markSaved();
      return true;
    } catch {
      toast.error("Failed to save model");
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentModelId, nodes, edges, markSaved]);

  const handleCreate = useCallback(
    async (name: string) => {
      setSaving(true);
      try {
        const model = await api.createModel(name, nodes, edges);
        onModelChange(model.id, model.name);
        markSaved();
        return true;
      } catch {
        toast.error("Failed to create model");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [nodes, edges, onModelChange, markSaved],
  );

  const handleLoad = useCallback(
    async (modelId: string) => {
      setLoading(true);
      try {
        const model = await api.loadModel(modelId);
        loadCanvas(
          (model.canvasState.nodes || []) as Parameters<typeof loadCanvas>[0],
          (model.canvasState.edges || []) as Parameters<typeof loadCanvas>[1],
        );
        onModelChange(model.id, model.name);
        return true;
      } catch {
        toast.error("Failed to load model");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadCanvas, onModelChange],
  );

  const handleNew = useCallback(() => {
    clearCanvas();
    onModelChange(null, "Untitled");
  }, [clearCanvas, onModelChange]);

  return {
    saving,
    loading,
    models,
    fetchModels,
    handleSave,
    handleCreate,
    handleLoad,
    handleNew,
    ...exportActions,
  };
}
