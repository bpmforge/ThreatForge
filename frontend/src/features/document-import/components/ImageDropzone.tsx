"use client";

/**
 * ImageDropzone Component
 *
 * Drag-and-drop image upload for diagram extraction via Vision AI.
 */

import React, { useCallback, useState } from "react";
import { Image, Upload, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { dropzoneClassName, useDropzoneHandlers } from "../hooks/useDropzone";

interface ImageDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  className?: string;
  visionSupported?: boolean;
  supportedProviders?: string[];
}

const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const MAX_SIZE_MB = 20;

export function ImageDropzone({
  onFileSelect,
  disabled = false,
  className,
  visionSupported = true,
  supportedProviders = ["Claude", "OpenAI", "Gemini"],
}: ImageDropzoneProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      return `Unsupported image type. Use PNG, JPEG, GIF, or WebP.`;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_SIZE_MB) {
      return `Image too large. Maximum size: ${MAX_SIZE_MB}MB`;
    }

    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      setPreview(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

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
  } = useDropzoneHandlers(!disabled && visionSupported, handleFile);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  // Vision not supported warning
  if (!visionSupported) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="border-2 border-dashed border-amber-500/50 rounded-lg p-8 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <EyeOff className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Vision AI Not Available
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Your current AI provider does not support image analysis.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supported providers: {supportedProviders.join(", ")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Preview */}
      {preview && (
        <div className="relative rounded-lg overflow-hidden border bg-muted/50">
          <img
            src={preview}
            alt="Diagram preview"
            className="w-full max-h-48 object-contain"
          />
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1 rounded bg-background/80 hover:bg-background text-xs"
            aria-label="Clear preview"
          >
            Clear
          </button>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={dropzoneClassName(isDragging, disabled, !!error)}
      >
        <input
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Upload diagram image"
        />

        <div
          className={cn(
            "p-4 rounded-full bg-muted",
            isDragging && "bg-primary/10",
          )}
        >
          {isDragging ? (
            <Upload className="h-8 w-8 text-primary" />
          ) : (
            <Image className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragging ? "Drop diagram here" : "Drag and drop a diagram image"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to browse
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {ACCEPTED_EXTENSIONS.map((ext) => (
            <span
              key={ext}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground"
            >
              {ext.toUpperCase().replace(".", "")}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="h-3 w-3" />
          <span>Vision AI will analyze your diagram</span>
        </div>
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
