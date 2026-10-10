"use client";

/**
 * DocumentTypeCard Component
 *
 * Renders a single document type with expandable detection rules and formats.
 */

import React from "react";
import {
  Trash2,
  Pencil,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DocumentTypeConfig } from "../types";
import { DocumentTypeCardDetails } from "./DocumentTypeCardDetails";

interface DocumentTypeCardProps {
  docType: DocumentTypeConfig;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit?: (docType: DocumentTypeConfig) => void;
  onDelete: (id: string) => void;
}

export function DocumentTypeCard({
  docType,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: DocumentTypeCardProps): React.ReactElement {
  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <Badge variant="outline" className="text-xs">
            Priority {docType.priority}
          </Badge>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {docType.isBuiltIn && (
                <Badge variant="secondary" className="text-xs">
                  Built-in
                </Badge>
              )}
              {docType.name}
            </CardTitle>
            {docType.description && (
              <CardDescription className="mt-1 line-clamp-1">
                {docType.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            {!docType.isBuiltIn && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(docType)}
                aria-label="Edit document type"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {!docType.isBuiltIn && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(docType.id)}
                aria-label="Delete document type"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && <DocumentTypeCardDetails docType={docType} />}
    </Card>
  );
}
