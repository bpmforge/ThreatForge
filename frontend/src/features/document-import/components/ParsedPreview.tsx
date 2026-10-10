"use client";

/**
 * ParsedPreview Component
 *
 * Shows a preview of the imported and parsed document.
 */

import React, { useState } from "react";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ImportedDocument } from "../types";
import { estimateProcessingTime } from "../services/document-parser";

interface ParsedPreviewProps {
  document: ImportedDocument;
  className?: string;
  showFullText?: boolean;
}

export function ParsedPreview({
  document,
  className,
  showFullText = false,
}: ParsedPreviewProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(showFullText);
  const [copied, setCopied] = useState(false);

  const { metadata, extractedText, format, source, filename, url } = document;
  const previewText = extractedText.slice(0, 500);
  const hasMore = extractedText.length > 500;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sourceLabel = {
    file: filename || "Uploaded file",
    url: url || "Imported URL",
    paste: "Pasted text",
  }[source];

  const formatLabel = {
    pdf: "PDF",
    docx: "Word",
    md: "Markdown",
    html: "HTML",
    txt: "Text",
    terraform: "Terraform",
    "docker-compose": "Docker Compose",
    unknown: "Unknown",
  }[format];

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-muted/30 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">
            {metadata.title || "Imported Document"}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {sourceLabel}
          </p>
        </div>
        <Badge variant="secondary">{formatLabel}</Badge>
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 border-b bg-muted/10">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Words:</span>{" "}
            <span className="font-medium">
              {metadata.wordCount.toLocaleString()}
            </span>
          </div>
          {metadata.pageCount && (
            <div>
              <span className="text-muted-foreground">Pages:</span>{" "}
              <span className="font-medium">{metadata.pageCount}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Est. processing:</span>{" "}
            <span className="font-medium">
              {estimateProcessingTime(metadata.wordCount)}
            </span>
          </div>
        </div>

        {metadata.sections && metadata.sections.length > 0 && (
          <div className="mt-2">
            <span className="text-sm text-muted-foreground">Sections: </span>
            <span className="text-sm">
              {metadata.sections.slice(0, 5).join(", ")}
              {metadata.sections.length > 5 &&
                ` +${metadata.sections.length - 5} more`}
            </span>
          </div>
        )}
      </div>

      {/* Content Preview */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Content Preview</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2"
              >
                {copied ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              {hasMore && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        More
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>

          {!isExpanded && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 p-3 rounded-md">
              {previewText}
              {hasMore && "..."}
            </div>
          )}

          <CollapsibleContent>
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono p-3">
                {extractedText}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Info footer */}
      <div className="px-4 py-3 border-t bg-muted/10">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            This text will be analyzed by AI to extract components, data flows,
            and suggest threats. Ensure sensitive information is appropriate for
            AI processing.
          </p>
        </div>
      </div>
    </div>
  );
}
