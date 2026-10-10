/**
 * Main Collaboration Hook
 *
 * Combines Yjs connection, awareness, and shared data access.
 * Provides access to canvas, threats, and mitigations shared state.
 */
import { useCallback } from "react";
import * as Y from "yjs";
import { useYjsConnection } from "./useYjsConnection";
import { useAwareness } from "./useAwareness";
import type {
  CollaborationOptions,
  Collaborator,
  ConnectionStatus,
} from "../types";

interface UseCollaborationReturn {
  doc: Y.Doc | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  collaborators: Collaborator[];
  reconnectAttempts: number;
  lastSyncedAt: Date | null;
  updateCursor: (x: number, y: number) => void;
  updateSelection: (nodeIds: string[]) => void;
  reconnect: () => void;
  // Canvas data
  getNodesArray: () => Y.Array<unknown> | null;
  getEdgesArray: () => Y.Array<unknown> | null;
  getViewportMap: () => Y.Map<unknown> | null;
  // Threats and mitigations data
  getThreatsMap: () => Y.Map<unknown> | null;
  getMitigationsMap: () => Y.Map<unknown> | null;
}

/**
 * Hook for real-time collaboration on a threat model canvas.
 * Provides shared access to canvas state, threats, and mitigations.
 */
export function useCollaboration(
  options: CollaborationOptions,
): UseCollaborationReturn {
  const {
    doc,
    provider,
    isConnected,
    connectionStatus,
    collaborators,
    reconnectAttempts,
    lastSyncedAt,
    reconnect,
  } = useYjsConnection(options);
  const { updateCursor, updateSelection } = useAwareness(provider);

  // Canvas data accessors
  const getNodesArray = useCallback(() => {
    return doc?.getArray("nodes") || null;
  }, [doc]);

  const getEdgesArray = useCallback(() => {
    return doc?.getArray("edges") || null;
  }, [doc]);

  const getViewportMap = useCallback(() => {
    return doc?.getMap("viewport") || null;
  }, [doc]);

  // Threats and mitigations accessors
  const getThreatsMap = useCallback(() => {
    return doc?.getMap("threats") || null;
  }, [doc]);

  const getMitigationsMap = useCallback(() => {
    return doc?.getMap("mitigations") || null;
  }, [doc]);

  return {
    doc,
    isConnected,
    connectionStatus,
    collaborators,
    reconnectAttempts,
    lastSyncedAt,
    updateCursor,
    updateSelection,
    reconnect,
    getNodesArray,
    getEdgesArray,
    getViewportMap,
    getThreatsMap,
    getMitigationsMap,
  };
}
