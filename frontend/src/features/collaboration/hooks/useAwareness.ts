/**
 * Yjs Awareness Hook
 *
 * Manages cursor and selection awareness for collaboration.
 */
import { useCallback } from "react";
import type { WebsocketProvider } from "y-websocket";

interface UseAwarenessReturn {
  updateCursor: (x: number, y: number) => void;
  updateSelection: (nodeIds: string[]) => void;
}

/**
 * Hook for updating awareness state (cursor, selection).
 */
export function useAwareness(
  provider: WebsocketProvider | null,
): UseAwarenessReturn {
  const updateCursor = useCallback(
    (x: number, y: number) => {
      provider?.awareness.setLocalStateField("cursor", { x, y });
    },
    [provider],
  );

  const updateSelection = useCallback(
    (nodeIds: string[]) => {
      provider?.awareness.setLocalStateField("selection", nodeIds);
    },
    [provider],
  );

  return { updateCursor, updateSelection };
}
