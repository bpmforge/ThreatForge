/**
 * Collaborative Canvas Hook
 *
 * Combines collaboration with canvas sync.
 */
import { useEffect, useRef } from "react";
import { useCollaboration } from "./useCollaboration";
import { useCanvasSync } from "./useCanvasSync";
import type { CollaborationOptions, Collaborator } from "../types";

interface UseCollaborativeCanvasReturn {
  isConnected: boolean;
  collaborators: Collaborator[];
  updateCursor: (x: number, y: number) => void;
  updateSelection: (nodeIds: string[]) => void;
}

/**
 * Hook that syncs canvas store with Yjs for real-time collaboration.
 */
export function useCollaborativeCanvas(
  options: CollaborationOptions,
): UseCollaborativeCanvasReturn {
  const modelIdRef = useRef(options.modelId);

  const {
    doc,
    isConnected,
    collaborators,
    updateCursor,
    updateSelection,
    getNodesArray,
    getEdgesArray,
  } = useCollaboration(options);

  useCanvasSync({ doc, isConnected, getNodesArray, getEdgesArray });

  // Reset when modelId changes
  useEffect(() => {
    if (options.modelId !== modelIdRef.current) {
      modelIdRef.current = options.modelId;
    }
  }, [options.modelId]);

  return {
    isConnected,
    collaborators,
    updateCursor,
    updateSelection,
  };
}
