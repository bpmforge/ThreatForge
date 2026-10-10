/**
 * Local storage service for auto-save backup.
 */
import type { LocalStorageBackup } from "../types";

const LOCAL_STORAGE_KEY = "flow-threat-model-autosave";

/** Save backup to localStorage */
export function saveToLocalStorage(backup: LocalStorageBackup): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backup));
  } catch (err) {
    console.warn("Failed to save to localStorage:", err);
  }
}

/** Restore backup from localStorage */
export function restoreFromLocalStorage(): LocalStorageBackup | null {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as LocalStorageBackup;
    }
  } catch (err) {
    console.warn("Failed to read localStorage backup:", err);
  }
  return null;
}

/** Clear localStorage backup */
export function clearLocalStorageBackup(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}
