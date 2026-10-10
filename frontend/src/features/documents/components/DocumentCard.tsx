"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Eye, Trash2, RefreshCw, MoreHorizontal } from "lucide-react";
import type { DocumentSummary } from "../types";

const TYPE_LABELS: Record<string, string> = {
  PDF: "PDF",
  DOCX: "DOCX",
  MARKDOWN: "MD",
  TERRAFORM: "TF",
  DOCKER_COMPOSE: "Docker",
  OPENAPI: "API",
  YAML: "YAML",
  TEXT: "Text",
  SOURCE_CODE: "Code",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

interface DocumentCardProps {
  doc: DocumentSummary;
  onView?: () => void;
  onReExtract?: () => void;
  onDelete: () => void;
}

export function DocumentCard({
  doc,
  onView,
  onReExtract,
  onDelete,
}: DocumentCardProps) {
  return (
    <div className="px-3 py-2.5 hover:bg-muted/30 group">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-medium truncate" title={doc.name}>
              {doc.name}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1 shrink-0"
            >
              {TYPE_LABELS[doc.type] ?? doc.type}
            </Badge>
            {doc.version > 1 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 shrink-0 border-blue-400 text-blue-600"
                title={`Version ${doc.version} — prior versions preserved for citation traceability`}
              >
                v{doc.version}
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {formatDate(doc.createdAt)} · {formatSize(doc.sizeBytes)} ·{" "}
            {doc._count.requirements} req
            {doc._count.requirements !== 1 ? "s" : ""}
            {doc.extractedComponentCount > 0 &&
              ` · ${doc.extractedComponentCount} components`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-40 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
              aria-label="Document actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onView && (
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-3.5 w-3.5 mr-2" />
                View Content
              </DropdownMenuItem>
            )}
            {onReExtract && (
              <DropdownMenuItem onClick={onReExtract}>
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Re-extract Components
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
