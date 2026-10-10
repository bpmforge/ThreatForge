"use client";

/**
 * ExpertAnalysisResults — Displays results from the 6-pass expert analysis.
 */
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExpertAnalysisResult } from "../types";
import { ExpertThreatCard } from "./ExpertThreatCard";

interface ExpertAnalysisResultsProps {
  result: ExpertAnalysisResult | null;
  loading?: boolean;
}

export function ExpertAnalysisResults({
  result,
  loading,
}: ExpertAnalysisResultsProps) {
  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Expert analysis running in background...
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>No expert analysis results yet.</p>
        <p className="mt-1 text-xs">
          Use the <strong>Expert Analysis</strong> button in the toolbar to run
          a comprehensive 6-pass AI analysis.
        </p>
      </div>
    );
  }

  const { threats, summary } = result;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg border text-center">
            <div className="text-lg font-bold">{summary.totalThreats}</div>
            <div className="text-xs text-muted-foreground">Threats</div>
          </div>
          <div className="p-2 rounded-lg border text-center">
            <div className="text-lg font-bold">{summary.passesCompleted}</div>
            <div className="text-xs text-muted-foreground">Passes</div>
          </div>
          <div className="p-2 rounded-lg border text-center">
            <div className="text-lg font-bold">
              {summary.strideCoverage?.length ?? 0}/6
            </div>
            <div className="text-xs text-muted-foreground">STRIDE</div>
          </div>
        </div>

        {/* Duration */}
        {summary.duration > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Completed in {Math.round(summary.duration / 1000)}s with{" "}
            {summary.verificationLoops} verification loop(s)
          </p>
        )}

        {/* Threat list */}
        <div className="space-y-2">
          {threats.map((threat, i) => (
            <ExpertThreatCard key={`${threat.title}-${i}`} threat={threat} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
