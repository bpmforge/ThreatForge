"use client";

/**
 * DocumentViewerDialog — Full-screen dialog showing document content
 * and the requirements extracted from it.
 */
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useDocument } from "../hooks/useDocuments";

interface DocumentViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  documentId: string;
}

const TYPE_LABELS: Record<string, string> = {
  PDF: "PDF",
  DOCX: "DOCX",
  MARKDOWN: "Markdown",
  TERRAFORM: "Terraform",
  DOCKER_COMPOSE: "Docker Compose",
  OPENAPI: "OpenAPI",
  YAML: "YAML",
  TEXT: "Plain Text",
  SOURCE_CODE: "Source Code",
};

export function DocumentViewerDialog({
  open,
  onOpenChange,
  modelId,
  documentId,
}: DocumentViewerDialogProps) {
  const { data: doc, isLoading } = useDocument(
    open ? modelId : null,
    open ? documentId : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] p-0 overflow-hidden"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {isLoading || !doc ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader className="p-4 pb-3 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {doc.name}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {TYPE_LABELS[doc.type] ?? doc.type}
                </Badge>
                {doc.pageCount && (
                  <span className="text-xs">
                    {doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-xs">
                  {doc.requirements.length} requirement
                  {doc.requirements.length !== 1 ? "s" : ""} extracted
                </span>
                {doc.contentTruncated && (
                  <Badge
                    variant="outline"
                    className="text-xs text-amber-600 border-amber-300"
                  >
                    Truncated
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left — Document content */}
              <div className="flex-1 min-w-0 overflow-y-auto border-r">
                <div className="p-4">
                  <pre className="whitespace-pre-wrap break-words text-xs font-mono text-foreground leading-relaxed">
                    {doc.content}
                  </pre>
                </div>
              </div>

              {/* Right — Requirements from this document */}
              <div className="w-64 shrink-0 flex flex-col overflow-hidden">
                <div className="p-3 border-b shrink-0">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Requirements ({doc.requirements.length})
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {doc.requirements.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      No requirements extracted from this document.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {doc.requirements.map((req) => (
                        <div key={req.id} className="px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {req._count.mitigations > 0 ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                            )}
                            <span className="text-[10px] font-mono font-medium">
                              {req.reqId}
                            </span>
                            {req.category && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-3.5 px-1"
                              >
                                {req.category}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 pl-4.5">
                            {req.text}
                          </p>
                          <div className="pl-4.5 mt-0.5">
                            {req._count.mitigations > 0 ? (
                              <span className="text-[9px] text-emerald-600">
                                {req._count.mitigations} mitigation
                                {req._count.mitigations !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-[9px] text-red-500">
                                Uncovered
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
              <span>
                Imported{" "}
                {new Date(doc.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {doc.extractionSummary && (
                <span className="truncate ml-4">{doc.extractionSummary}</span>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
