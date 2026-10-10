"use client";

/**
 * GapAnalysisPanel — Shows threat coverage vs gaps, with GitHub code scan.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Github, Layers, Download, Upload, MoreHorizontal } from "lucide-react";
import { gapAnalysisApi } from "../services/gap-analysis-api";
import { ScanGithubDialog } from "./ScanGithubDialog";
import { UploadFilesDialog } from "./UploadFilesDialog";
import { GapThreatRow } from "./GapThreatRow";
import { downloadGapCsv } from "../utils/gap-csv";

interface GapAnalysisPanelProps {
  modelId: string;
}

export function GapAnalysisPanel({ modelId }: GapAnalysisPanelProps) {
  const [showScan, setShowScan] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<"gaps" | "covered">("gaps");

  const { data, isLoading, error } = useQuery({
    queryKey: ["gap-analysis", modelId],
    queryFn: () => gapAnalysisApi.getGapAnalysis(modelId),
    staleTime: 30_000,
  });

  if (isLoading)
    return <div className="p-4 text-xs text-muted-foreground">Analysing…</div>;

  if (error || !data)
    return (
      <div className="p-4 text-xs text-red-500">
        {(error as Error)?.message ?? "Failed to load gap analysis"}
      </div>
    );

  const { summary, gaps, covered } = data;
  const pctColor =
    summary.coveragePct >= 75
      ? "text-emerald-600"
      : summary.coveragePct >= 40
        ? "text-yellow-600"
        : "text-red-500";
  const displayList = activeTab === "gaps" ? gaps : covered;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Gap Analysis</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                aria-label="Actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadGapCsv(data)}>
                <Download className="h-3.5 w-3.5 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowUpload(true)}>
                <Upload className="h-3.5 w-3.5 mr-2" />
                Upload Files
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowScan(true)}>
                <Github className="h-3.5 w-3.5 mr-2" />
                Scan GitHub
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {summary.covered}/{summary.total} threats mitigated
            </span>
            <span className={pctColor}>{summary.coveragePct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${summary.coveragePct >= 75 ? "bg-emerald-500" : summary.coveragePct >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${summary.coveragePct}%` }}
            />
          </div>
        </div>
        {summary.missingControlCategories.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">
              No coverage for:
            </p>
            <div className="flex flex-wrap gap-1">
              {summary.missingControlCategories.map((c) => (
                <span
                  key={c}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("gaps")}
            className={`flex-1 text-xs py-1 rounded transition-colors ${activeTab === "gaps" ? "bg-red-50 text-red-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {summary.gaps} gap{summary.gaps !== 1 ? "s" : ""}
          </button>
          <button
            onClick={() => setActiveTab("covered")}
            className={`flex-1 text-xs py-1 rounded transition-colors ${activeTab === "covered" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {summary.covered} covered
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {displayList.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {activeTab === "gaps"
              ? "No gaps — all threats have effective mitigations."
              : "No threats have been mitigated yet."}
          </div>
        ) : (
          <div>
            {displayList.map((threat) => (
              <GapThreatRow
                key={threat.id}
                threat={threat}
                covered={activeTab === "covered"}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <Layers className="h-3 w-3" />
        <span>{summary.total} threats</span>
        {summary.gapsByStrideCategory &&
          Object.keys(summary.gapsByStrideCategory).length > 0 && (
            <>
              <span>·</span>
              <span>
                Gaps:{" "}
                {Object.entries(summary.gapsByStrideCategory)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([cat, n]) => `${cat} (${n})`)
                  .join(", ")}
              </span>
            </>
          )}
      </div>

      <ScanGithubDialog
        open={showScan}
        onOpenChange={setShowScan}
        modelId={modelId}
      />
      <UploadFilesDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        modelId={modelId}
      />
    </div>
  );
}
