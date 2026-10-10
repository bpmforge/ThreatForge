"use client";

import {
  Loader2,
  Zap,
  Layers,
  RotateCcw,
  ChevronDown,
  Sigma,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const METHODOLOGY_LABELS: Record<string, string> = {
  stride: "STRIDE",
  pasta: "PASTA",
  kill_chain: "Kill Chain",
  mitre_attack: "MITRE ATT&CK",
};

interface AnalysisStatus {
  dirty: number;
  total: number;
  hasEverBeenAnalyzed: boolean;
}

interface AIAnalysisButtonsProps {
  methodology: string;
  analysisStatus: AnalysisStatus | undefined;
  quickMode: boolean;
  loading: boolean;
  jobId: string | null | undefined;
  rescoring: boolean;
  onAnalyze: (opts?: { fullAnalysis?: boolean }) => void;
  onToggleQuickMode: () => void;
  onRegenerateMitigations: () => void;
  onRescoreOnly: () => void;
}

export function AIAnalysisButtons({
  methodology,
  analysisStatus,
  quickMode,
  loading,
  jobId,
  rescoring,
  onAnalyze,
  onToggleQuickMode,
  onRegenerateMitigations,
  onRescoreOnly,
}: AIAnalysisButtonsProps) {
  const methodLabel = METHODOLOGY_LABELS[methodology] ?? "STRIDE";

  const mainLabel = (() => {
    if (loading && !jobId) return null;
    if (
      analysisStatus?.hasEverBeenAnalyzed &&
      analysisStatus.dirty > 0 &&
      analysisStatus.dirty < analysisStatus.total
    ) {
      const n = analysisStatus.dirty;
      return `Analyze ${n} Changed Component${n !== 1 ? "s" : ""}`;
    }
    if (analysisStatus?.dirty === 0 && analysisStatus.total > 0) {
      return `Re-Analyze (${analysisStatus.total} components up to date)`;
    }
    return `Analyze with ${methodLabel}`;
  })();

  return (
    <div className="flex gap-1.5">
      <Button
        onClick={() => onAnalyze()}
        disabled={loading}
        className="flex-1"
        size="sm"
      >
        {loading && !jobId ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          mainLabel
        )}
      </Button>

      {analysisStatus?.hasEverBeenAnalyzed && !quickMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAnalyze({ fullAnalysis: true })}
              disabled={loading}
              aria-label="Force full re-analysis of all components"
              className="h-9 w-9 shrink-0 p-0"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Force full re-analysis — ignores incremental cache, re-analyzes all
            components
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={quickMode ? "default" : "outline"}
            onClick={onToggleQuickMode}
            disabled={loading}
            aria-label={
              quickMode ? "Switch to deep analysis" : "Switch to quick analysis"
            }
            className="h-9 w-9 shrink-0 p-0"
          >
            {quickMode ? (
              <Zap className="h-4 w-4" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {quickMode
            ? "Quick mode — single-pass STRIDE (~60s), results inline"
            : "Deep mode — multi-pass per-component analysis (background job)"}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || rescoring}
            aria-label="More analysis options"
            className="h-9 w-9 shrink-0 p-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onAnalyze()} disabled={loading}>
            Run full analysis
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onAnalyze({ fullAnalysis: true })}
            disabled={loading}
          >
            Force full re-analysis
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onRegenerateMitigations}
            disabled={loading}
          >
            Just regenerate mitigations
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRescoreOnly} disabled={rescoring}>
            {rescoring ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sigma className="h-3.5 w-3.5 mr-1.5" />
            )}
            Just recalculate scores
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
