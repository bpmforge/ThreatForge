"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Plus, GitCompare, Layers, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DocumentCard } from "./DocumentCard";
import { useDocumentsState } from "./useDocumentsState";

interface DocumentsPanelProps {
  modelId: string;
  onViewDocument?: (docId: string) => void;
  onImportDocument?: () => void;
  onGapAnalysis?: () => void;
  onReExtract?: (docId: string) => void;
}

export function DocumentsPanel({
  modelId,
  onViewDocument,
  onImportDocument,
  onGapAnalysis,
  onReExtract,
}: DocumentsPanelProps) {
  const {
    documents,
    isLoading,
    deleteId,
    setDeleteId,
    search,
    setSearch,
    filtered,
    reqCount,
    deleteMutation,
  } = useDocumentsState(modelId);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">Documents</h3>
          <div className="flex gap-1">
            {onGapAnalysis && documents.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={onGapAnalysis}
                aria-label="Document gap analysis"
              >
                <GitCompare className="h-3.5 w-3.5" />
              </Button>
            )}
            {onImportDocument && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={onImportDocument}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>
        </div>
        {documents.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {documents.length} doc{documents.length !== 1 ? "s" : ""} ·{" "}
            {reqCount} req{reqCount !== 1 ? "s" : ""} extracted
          </p>
        )}
      </div>

      {documents.length > 3 && (
        <div className="px-3 py-1.5 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter documents..."
              className="h-7 text-xs pl-7"
              aria-label="Filter documents"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-xs text-muted-foreground">
              No documents imported.
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Import an SRS, architecture spec, or Terraform file to populate
              requirements automatically.
            </p>
            {onImportDocument && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-7 text-xs"
                onClick={onImportDocument}
              >
                <Plus className="h-3 w-3 mr-1" />
                Import Document
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onView={
                  onViewDocument ? () => onViewDocument(doc.id) : undefined
                }
                onReExtract={
                  onReExtract ? () => onReExtract(doc.id) : undefined
                }
                onDelete={() => setDeleteId(doc.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {documents.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Layers className="h-3 w-3" />
          <span>
            {documents.length} doc{documents.length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>{reqCount} requirements</span>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the document record. Requirements extracted from
              it will be kept but will no longer link to this document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
