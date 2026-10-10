"use client";

/**
 * DocumentTypeManager Component
 *
 * Manages document type configurations for automatic prompt selection.
 */

import React, { useState } from "react";
import { Plus, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useDocumentTypes,
  useDeleteDocumentType,
} from "../hooks/useDocumentTypes";
import type { DocumentTypeConfig } from "../types";
import { DocumentTypeCard } from "./DocumentTypeCard";
import { DocumentTypeDeleteDialog } from "./DocumentTypeDeleteDialog";

interface DocumentTypeManagerProps {
  orgId: string;
  onEdit?: (docType: DocumentTypeConfig) => void;
  onCreate?: () => void;
}

export function DocumentTypeManager({
  orgId,
  onEdit,
  onCreate,
}: DocumentTypeManagerProps): React.ReactElement {
  const [deleteDocTypeId, setDeleteDocTypeId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: docTypes, isLoading, error } = useDocumentTypes(orgId);
  const deleteMutation = useDeleteDocumentType(orgId);

  const handleDelete = async () => {
    if (deleteDocTypeId) {
      await deleteMutation.mutateAsync(deleteDocTypeId);
      setDeleteDocTypeId(null);
    }
  };

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Failed to load document types: {error.message}
      </div>
    );
  }

  const sortedDocTypes = docTypes
    ? [...docTypes].sort((a, b) => a.priority - b.priority)
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Document Types</h2>
          <p className="text-sm text-muted-foreground">
            Configure automatic document detection and prompt assignment
          </p>
        </div>
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Document Type
          </Button>
        )}
      </div>

      {/* Document Type List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="py-3">
                <div className="h-5 bg-muted rounded w-1/3" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : sortedDocTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileType className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No document types configured
            </p>
            {onCreate && (
              <Button onClick={onCreate} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Document Type
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedDocTypes.map((docType) => (
            <DocumentTypeCard
              key={docType.id}
              docType={docType}
              isExpanded={expandedId === docType.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === docType.id ? null : docType.id)
              }
              onEdit={onEdit}
              onDelete={(id) => setDeleteDocTypeId(id)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <DocumentTypeDeleteDialog
        open={!!deleteDocTypeId}
        onOpenChange={() => setDeleteDocTypeId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
