/**
 * Collaboration feature type definitions.
 */

/** Collaborator cursor/awareness state */
export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[];
}

/** Collaboration connection options */
export interface CollaborationOptions {
  modelId: string;
  userId: string;
  userName: string;
  /** JWT token for authentication */
  token?: string;
  enabled?: boolean;
  serverUrl?: string;
}

/** Connection status for collaboration */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";
