import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared drag/drop/input handlers for the document and image dropzones.
 * `enabled` gates drag highlighting and drops; `onFile` receives the first file.
 */
export function useDropzoneHandlers(
  enabled: boolean,
  onFile: (file: File) => void,
) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (enabled) {
        setIsDragging(true);
      }
    },
    [enabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!enabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFile(files[0]);
      }
    },
    [enabled, onFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFile(files[0]);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [onFile],
  );

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
  };
}

export function dropzoneClassName(
  isDragging: boolean,
  disabled: boolean,
  hasError: boolean,
): string {
  return cn(
    "relative border-2 border-dashed rounded-lg p-8 transition-colors",
    "flex flex-col items-center justify-center gap-4",
    "cursor-pointer hover:border-primary/50 hover:bg-muted/50",
    isDragging && "border-primary bg-primary/5",
    disabled &&
      "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent",
    hasError && "border-destructive",
  );
}
