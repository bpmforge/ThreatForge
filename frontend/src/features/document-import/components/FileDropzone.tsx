"use client";

/**
 * FileDropzone Component
 *
 * Drag-and-drop file upload for documents.
 */

import React, { useCallback, useState } from "react";
import { Upload, File, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { dropzoneClassName, useDropzoneHandlers } from "../hooks/useDropzone";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = [".pdf", ".docx", ".doc", ".md", ".txt", ".html"];
const DEFAULT_MAX_SIZE_MB = 10;

export function FileDropzone({
  onFileSelect,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  disabled = false,
  className,
}: FileDropzoneProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!accept.includes(ext)) {
        return `Unsupported file type. Accepted: ${accept.join(", ")}`;
      }

      // Check file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        return `File too large. Maximum size: ${maxSizeMB}MB`;
      }

      return null;
    },
    [accept, maxSizeMB],
  );

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      onFileSelect(file);
    },
    [validateFile, onFileSelect],
  );

  const {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
  } = useDropzoneHandlers(!disabled, handleFile);

  const getFileIcon = (ext: string) => {
    if (ext === ".pdf") return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={dropzoneClassName(isDragging, disabled, !!error)}
      >
        <input
          type="file"
          accept={accept.join(",")}
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Upload document"
        />

        <div
          className={cn(
            "p-4 rounded-full bg-muted",
            isDragging && "bg-primary/10",
          )}
        >
          <Upload
            className={cn(
              "h-8 w-8 text-muted-foreground",
              isDragging && "text-primary",
            )}
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragging ? "Drop file here" : "Drag and drop a document"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to browse
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {accept.map((ext) => (
            <span
              key={ext}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground"
            >
              {getFileIcon(ext)}
              {ext.toUpperCase().replace(".", "")}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Maximum file size: {maxSizeMB}MB
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
