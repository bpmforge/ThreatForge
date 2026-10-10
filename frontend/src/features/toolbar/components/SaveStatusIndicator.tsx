"use client";

/**
 * SaveStatusIndicator - Visual indicator for save status.
 */
import {
  type SaveStatus,
  getSaveStatusText,
  getSaveStatusColor,
} from "@/features/auto-save";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  isDirty: boolean;
}

export function SaveStatusIndicator({
  status,
  isDirty,
}: SaveStatusIndicatorProps) {
  if (status === "idle" && !isDirty) return null;

  if (status === "idle" && isDirty) {
    return <span className="text-xs text-amber-700">(unsaved)</span>;
  }

  return (
    <span
      className={`text-xs ${getSaveStatusColor(status)} flex items-center gap-1`}
    >
      {status === "saving" && (
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {status === "saved" && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {status === "offline" && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656"
          />
        </svg>
      )}
      {status === "error" && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}
      {getSaveStatusText(status)}
    </span>
  );
}
