"use client";

/**
 * TextPasteForm Component
 *
 * Form for importing documents by pasting text content.
 */

import React, { useState, useCallback } from "react";
import { FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TextPasteFormProps {
  onSubmit: (text: string, title?: string) => void;
  disabled?: boolean;
  className?: string;
}

const MIN_CHARS = 100;
const MAX_CHARS = 500000; // ~125k tokens

export function TextPasteForm({
  onSubmit,
  disabled = false,
  className,
}: TextPasteFormProps): React.ReactElement {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const charCount = text.length;
  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const validate = useCallback((): string | null => {
    if (charCount < MIN_CHARS) {
      return `Please enter at least ${MIN_CHARS} characters (currently ${charCount})`;
    }
    if (charCount > MAX_CHARS) {
      return `Text too long. Maximum ${MAX_CHARS.toLocaleString()} characters`;
    }
    return null;
  }, [charCount]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      onSubmit(text, title || undefined);
    },
    [text, title, validate, onSubmit],
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // Let the paste happen naturally, but check for HTML content
      const html = e.clipboardData.getData("text/html");
      if (html && html.length > 100) {
        // User might be pasting formatted content - let them know
        // But still allow the plain text paste
      }
    },
    [],
  );

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="paste-title">Document Title (optional)</Label>
        <Input
          id="paste-title"
          type="text"
          placeholder="Architecture Document"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paste-text">Document Content</Label>
        <Textarea
          id="paste-text"
          placeholder="Paste your architecture document, SRS, or SAD content here...

Example content:
- System overview and components
- Data flows between services
- Technology stack
- Security boundaries
- Authentication mechanisms"
          value={text}
          onChange={handleTextChange}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            "min-h-[200px] font-mono text-sm",
            error && "border-destructive focus-visible:ring-destructive",
          )}
          aria-invalid={!!error}
          aria-describedby="paste-info"
        />

        <div
          id="paste-info"
          className="flex items-center justify-between text-xs text-muted-foreground"
        >
          <span>
            {wordCount.toLocaleString()} words, {charCount.toLocaleString()}{" "}
            characters
          </span>
          <span>
            Min: {MIN_CHARS} chars | Max: {MAX_CHARS.toLocaleString()} chars
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>Tip: You can paste content from:</p>
        <ul className="list-disc list-inside pl-2 space-y-0.5">
          <li>Word documents (Ctrl+A, Ctrl+C)</li>
          <li>Confluence or Notion pages</li>
          <li>Email or chat messages</li>
          <li>Any text describing your system architecture</li>
        </ul>
      </div>

      <Button
        type="submit"
        disabled={disabled || charCount < MIN_CHARS}
        className="w-full"
      >
        <FileText className="mr-2 h-4 w-4" />
        Import Text
      </Button>
    </form>
  );
}
