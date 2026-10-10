/**
 * Save status utilities.
 */
import type { SaveStatus } from "../types";

/** Get human-readable status text */
export function getSaveStatusText(status: SaveStatus): string {
  switch (status) {
    case "idle":
      return "";
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    case "offline":
      return "Saved locally";
    default:
      return "";
  }
}

/** Get status color class */
export function getSaveStatusColor(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "text-blue-600";
    case "saved":
      return "text-green-600";
    case "error":
      return "text-red-600";
    case "offline":
      return "text-amber-700";
    default:
      return "text-muted-foreground";
  }
}
