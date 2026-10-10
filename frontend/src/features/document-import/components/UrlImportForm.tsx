"use client";

/**
 * UrlImportForm Component
 *
 * Form for importing documents from URLs.
 */

import React, { useState, useCallback } from "react";
import { Link, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isKnownDocPlatform, extractDomain } from "../services/url-fetcher";

interface UrlImportFormProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
  className?: string;
}

export function UrlImportForm({
  onSubmit,
  disabled = false,
  className,
}: UrlImportFormProps): React.ReactElement {
  const [url, setUrl] = useState("");
  const [isValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUrl = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return "Please enter a URL";
    }

    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "URL must start with http:// or https://";
      }
    } catch {
      return "Please enter a valid URL";
    }

    return null;
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const validationError = validateUrl(url);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      onSubmit(url);
    },
    [url, validateUrl, onSubmit],
  );

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setUrl(value);

      // Clear error when user starts typing
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  const platform = url ? isKnownDocPlatform(url) : null;
  const domain = url ? extractDomain(url) : null;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="url-input">Document URL</Label>
        <div className="relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="url-input"
            type="url"
            placeholder="https://docs.example.com/architecture"
            value={url}
            onChange={handleUrlChange}
            disabled={disabled}
            className={cn(
              "pl-10",
              error && "border-destructive focus-visible:ring-destructive",
            )}
            aria-invalid={!!error}
            aria-describedby={error ? "url-error" : undefined}
          />
        </div>

        {error && (
          <div
            id="url-error"
            className="flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {url && !error && platform && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>
              Detected: {platform.platform} ({platform.type})
            </span>
          </div>
        )}

        {url && !error && !platform && domain && (
          <div className="text-xs text-muted-foreground">
            Will fetch content from: {domain}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>Supported sources:</p>
        <ul className="list-disc list-inside pl-2 space-y-0.5">
          <li>Public web pages (HTML)</li>
          <li>GitHub files and wikis</li>
          <li>Confluence pages (public)</li>
          <li>Notion pages (public)</li>
          <li>Direct links to .md, .txt files</li>
        </ul>
      </div>

      <Button
        type="submit"
        disabled={disabled || !url.trim()}
        className="w-full"
      >
        {isValidating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Validating...
          </>
        ) : (
          "Import from URL"
        )}
      </Button>
    </form>
  );
}
