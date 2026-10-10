/**
 * useDocumentImport Hook
 *
 * Orchestrates document import from files, URLs, or pasted text.
 */

import { useState, useCallback } from "react";
import type {
  ImportedDocument,
  ImportProgress,
  DocumentFormat,
  DocumentMetadata,
} from "../types";
import {
  parseFile,
  parseDocument,
  createImportedDocument,
  detectFormat,
} from "../services/document-parser";
import { fetchAndParseUrl } from "../services/url-fetcher";
import { apiPost } from "@/lib/api-client";

interface UseDocumentImportOptions {
  onSuccess?: (document: ImportedDocument) => void;
  onError?: (error: Error) => void;
}

interface UseDocumentImportReturn {
  importedDocument: ImportedDocument | null;
  progress: ImportProgress;
  error: Error | null;
  importFile: (file: File) => Promise<void>;
  importUrl: (url: string) => Promise<void>;
  importText: (text: string, title?: string) => Promise<void>;
  reset: () => void;
  isImporting: boolean;
}

const initialProgress: ImportProgress = {
  stage: "idle",
  progress: 0,
  message: "",
};

export function useDocumentImport(
  options: UseDocumentImportOptions = {},
): UseDocumentImportReturn {
  const { onSuccess, onError } = options;

  const [importedDocument, setImportedDocument] =
    useState<ImportedDocument | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(initialProgress);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setImportedDocument(null);
    setProgress(initialProgress);
    setError(null);
  }, []);

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      setProgress({
        stage: "error",
        progress: 0,
        message: err.message,
        error: err.message,
      });
      onError?.(err);
    },
    [onError],
  );

  const handleSuccess = useCallback(
    (doc: ImportedDocument) => {
      setImportedDocument(doc);
      setProgress({
        stage: "complete",
        progress: 100,
        message: "Import complete",
      });
      onSuccess?.(doc);
    },
    [onSuccess],
  );

  /**
   * Import from file
   */
  const importFile = useCallback(
    async (file: File) => {
      reset();
      setProgress({
        stage: "uploading",
        progress: 20,
        message: `Reading ${file.name}...`,
      });

      try {
        const format = detectFormat(file.name, file.type);

        // Check if we need server-side parsing
        if (format === "pdf" || format === "docx") {
          setProgress({
            stage: "parsing",
            progress: 40,
            message: `Parsing ${format.toUpperCase()} file...`,
          });

          // Upload to server for parsing
          const formData = new FormData();
          formData.append("file", file);

          const result = await apiPost<{
            text: string;
            metadata: DocumentMetadata;
            rawContent?: string;
          }>("/api/documents/parse", formData);

          setProgress({
            stage: "extracting",
            progress: 80,
            message: "Processing content...",
          });

          const doc = createImportedDocument(
            {
              text: result.text,
              metadata: result.metadata,
              format,
            },
            "file",
            { filename: file.name, rawContent: result.rawContent },
          );

          handleSuccess(doc);
          return;
        }

        // Client-side parsing for text-based formats
        setProgress({
          stage: "parsing",
          progress: 50,
          message: "Parsing content...",
        });

        const parseResult = await parseFile(file);

        if (!parseResult) {
          throw new Error("Unable to parse file");
        }

        setProgress({
          stage: "extracting",
          progress: 80,
          message: "Processing content...",
        });

        const rawContent = await file.text();
        const doc = createImportedDocument(parseResult, "file", {
          filename: file.name,
          rawContent,
        });

        handleSuccess(doc);
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [reset, handleSuccess, handleError],
  );

  /**
   * Import from URL
   */
  const importUrl = useCallback(
    async (url: string) => {
      reset();
      setProgress({
        stage: "uploading",
        progress: 20,
        message: "Fetching URL...",
      });

      try {
        setProgress({
          stage: "parsing",
          progress: 50,
          message: "Parsing content...",
        });

        const parseResult = await fetchAndParseUrl(url);

        setProgress({
          stage: "extracting",
          progress: 80,
          message: "Processing content...",
        });

        const doc = createImportedDocument(parseResult, "url", {
          url,
          rawContent: parseResult.text,
        });

        handleSuccess(doc);
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [reset, handleSuccess, handleError],
  );

  /**
   * Import from pasted text
   */
  const importText = useCallback(
    async (text: string, title?: string) => {
      reset();

      if (!text.trim()) {
        handleError(new Error("Please enter some text to import"));
        return;
      }

      setProgress({
        stage: "parsing",
        progress: 50,
        message: "Processing text...",
      });

      try {
        // Detect if it looks like markdown or HTML
        let format: DocumentFormat = "txt";
        if (text.includes("```") || /^#{1,6}\s/m.test(text)) {
          format = "md";
        } else if (/<[a-z][\s\S]*>/i.test(text)) {
          format = "html";
        }

        const parseResult = parseDocument(text, format, title);

        setProgress({
          stage: "extracting",
          progress: 80,
          message: "Processing content...",
        });

        const doc = createImportedDocument(parseResult, "paste", {
          filename: title,
          rawContent: text,
        });

        handleSuccess(doc);
      } catch (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [reset, handleSuccess, handleError],
  );

  return {
    importedDocument,
    progress,
    error,
    importFile,
    importUrl,
    importText,
    reset,
    isImporting:
      progress.stage !== "idle" &&
      progress.stage !== "complete" &&
      progress.stage !== "error",
  };
}
