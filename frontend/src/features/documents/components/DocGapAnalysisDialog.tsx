"use client";

/**
 * DocGapAnalysisDialog — Shows requirements from documents that have no
 * mitigations, grouped by source document.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  ChevronDown,
  FileText,
  Loader2,
  Download,
} from "lucide-react";
import { useDocumentGaps } from "../hooks/useDocuments";
import type { DocumentGapGroup } from "../types";

interface DocGapAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
}

function exportGapCsv(gaps: DocumentGapGroup[], modelId: string) {
  const rows = [["Document", "Requirement ID", "Text", "Category", "Status"]];
  for (const group of gaps) {
    for (const req of group.requirements) {
      rows.push([
        group.documentName,
        req.reqId,
        `"${req.text.replace(/"/g, '""')}"`,
        req.category ?? "",
        "Uncovered",
      ]);
    }
  }
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gap-report-${modelId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function DocGapAnalysisDialog({
  open,
  onOpenChange,
  modelId,
}: DocGapAnalysisDialogProps) {
  const { data, isLoading } = useDocumentGaps(open ? modelId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] p-0 overflow-hidden"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {isLoading || !data ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader className="p-4 pb-3 border-b shrink-0">
              <DialogTitle>Document Gap Analysis</DialogTitle>
              <DialogDescription>
                Requirements from imported documents with no mitigation
                coverage.
              </DialogDescription>
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {data.summary.covered}/{data.summary.totalRequirements}{" "}
                    requirements addressed
                  </span>
                  <span
                    className={
                      data.summary.coveragePct >= 75
                        ? "text-emerald-600 font-medium"
                        : data.summary.coveragePct >= 40
                          ? "text-yellow-600 font-medium"
                          : "text-red-500 font-medium"
                    }
                  >
                    {data.summary.coveragePct}%
                  </span>
                </div>
                <Progress value={data.summary.coveragePct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {data.summary.documentCount} document
                  {data.summary.documentCount !== 1 ? "s" : ""} ·{" "}
                  {data.summary.uncovered} uncovered requirement
                  {data.summary.uncovered !== 1 ? "s" : ""}
                </p>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {data.gaps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    No gaps found
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All document requirements have mitigation coverage.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {data.gaps.map((group) => (
                    <DocumentGapSection key={group.documentId} group={group} />
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
              <span>
                {data.summary.totalRequirements} total ·{" "}
                {data.summary.uncovered} gaps
              </span>
              {data.gaps.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => exportGapCsv(data.gaps, modelId)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export CSV
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DocumentGapSection({ group }: { group: DocumentGapGroup }) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="group flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{group.documentName}</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1">
            {group.documentType}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 text-red-600 border-red-200"
          >
            {group.requirements.length} gap
            {group.requirements.length !== 1 ? "s" : ""}
          </Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 space-y-1.5">
          {group.requirements.map((req) => (
            <div
              key={req.id}
              className="flex items-start gap-2 pl-6 py-1.5 rounded hover:bg-muted/20"
            >
              <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-medium">
                    {req.reqId}
                  </span>
                  {req.category && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                      {req.category}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {req.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
