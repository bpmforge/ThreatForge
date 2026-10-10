/**
 * Auto-save feature types.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

export interface AutoSaveOptions {
  modelId: string | null;
  modelName: string;
  onStatusChange?: (status: SaveStatus) => void;
  enabled?: boolean;
}

export interface LocalStorageBackup {
  modelId: string | null;
  modelName: string;
  nodes: unknown[];
  edges: unknown[];
  savedAt: string;
}
