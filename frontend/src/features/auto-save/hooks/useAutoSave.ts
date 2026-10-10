/**
 * Auto-save hook for threat models.
 *
 * Primary storage: Database (via API)
 * Fallback: Local storage (only used when offline or API unavailable)
 *
 * This is a SaaS-first approach - data is always saved to the server
 * when available. Local storage is only used as an emergency backup.
 */
import { useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas";
import { apiPost, ApiError } from "@/lib/api-client";
import type { SaveStatus, AutoSaveOptions } from "../types";
import {
  saveToLocalStorage,
  restoreFromLocalStorage,
  clearLocalStorageBackup,
} from "../services/local-storage";

const AUTO_SAVE_DELAY = 2000;

export function useAutoSave({
  modelId,
  modelName,
  onStatusChange,
  enabled = true,
}: AutoSaveOptions) {
  // nodes/edges are read at save time (getState) and watched through a
  // store subscription below — subscribing to them here re-rendered the
  // whole model page on every drag frame.
  const isDirty = useCanvasStore((s) => s.isDirty);
  const markSaved = useCanvasStore((s) => s.markSaved);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>("");
  const statusRef = useRef<SaveStatus>("idle");

  const setStatus = useCallback(
    (status: SaveStatus) => {
      statusRef.current = status;
      onStatusChange?.(status);
    },
    [onStatusChange],
  );

  // Local storage backup - only used as offline fallback
  const saveBackup = useCallback(() => {
    const { nodes, edges } = useCanvasStore.getState();
    saveToLocalStorage({
      modelId,
      modelName,
      nodes,
      edges,
      savedAt: new Date().toISOString(),
    });
  }, [modelId, modelName]);

  // Primary save method - always tries database first
  const saveToServer = useCallback(async (): Promise<boolean> => {
    // Model must have an ID to save - this is required for SaaS
    if (!modelId) {
      console.warn("Cannot save: No model ID. Model must be created first.");
      setStatus("error");
      return false;
    }

    setStatus("saving");
    const { nodes, edges } = useCanvasStore.getState();

    try {
      await apiPost(`/api/threat-models/${modelId}/save-canvas`, {
        nodes,
        edges,
      });
      markSaved();
      setStatus("saved");
      // Clear any local backup since server save succeeded
      clearLocalStorageBackup();
      return true;
    } catch (err) {
      // Non-2xx responses are server errors, not offline
      if (err instanceof ApiError) {
        const status = err.statusCode;
        if (status === 401) {
          console.error("Auto-save failed: Unauthorized - please log in again");
        } else if (status === 403) {
          console.error("Auto-save failed: Permission denied");
        } else if (status === 404) {
          console.error("Auto-save failed: Model not found");
        } else if (status >= 400 && status < 500) {
          // Client errors - something wrong with the request, not offline
          console.error(`Auto-save failed: Client error ${status}`);
        } else if (status >= 500) {
          // Server errors - save backup but show error status
          console.error(`Auto-save failed: Server error ${status}`);
          saveBackup();
        } else {
          console.error(`Auto-save failed: Unexpected status ${status}`);
        }
        setStatus("error");
        return false;
      }
      // Network errors or fetch failures - likely offline
      console.error("Auto-save failed (network error):", err);
      saveBackup();
      setStatus("offline");
      return false;
    }
  }, [modelId, markSaved, saveBackup, setStatus]);

  // Debounce: every canvas change while dirty restarts the timer; the save
  // reads the store when it fires. Serialising the canvas once per save
  // rather than once per change keeps drag frames cheap.
  useEffect(() => {
    if (!enabled) return;

    const schedule = () => {
      if (!useCanvasStore.getState().isDirty) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        const { nodes, edges } = useCanvasStore.getState();
        const stateHash = JSON.stringify({ nodes, edges });
        if (stateHash === lastSavedRef.current) return;
        const success = await saveToServer();
        if (success) lastSavedRef.current = stateHash;
      }, AUTO_SAVE_DELAY);
    };

    schedule();
    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      // Becoming clean (markSaved / loadCanvas) cancels a pending save, as
      // the effect-based debounce did.
      if (prev.isDirty && !state.isDirty && timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        return;
      }
      if (
        state.nodes !== prev.nodes ||
        state.edges !== prev.edges ||
        state.isDirty !== prev.isDirty
      ) {
        schedule();
      }
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, saveToServer]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        saveBackup();
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, saveBackup]);

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    return saveToServer();
  }, [saveToServer]);

  return {
    status: statusRef.current,
    saveNow,
    restoreFromLocalStorage,
    clearLocalStorageBackup,
  };
}
