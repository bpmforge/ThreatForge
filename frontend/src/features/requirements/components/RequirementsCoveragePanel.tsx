"use client";

/**
 * RequirementsCoveragePanel — Per-requirement mitigation traceability.
 * Shows which requirements have effective (COMPLETED/VERIFIED) mitigations.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, FileText } from "lucide-react";
import {
  gapAnalysisApi,
  type CoverageRequirement,
} from "../services/gap-analysis-api";

interface RequirementsCoveragePanelProps {
  modelId: string;
}

function RequirementRow({ req }: { req: CoverageRequirement }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="px-4 py-2.5 hover:bg-muted/30 border-b last:border-0 cursor-pointer"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {req.isCovered ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              {req.reqId}
            </span>
            <span className="text-xs truncate" title={req.text}>
              {req.text}
            </span>
          </div>
          {expanded && (
            <div className="mt-1.5 space-y-1">
              {req.threats.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {req.threats.map((t) => (
                    <Badge
                      key={t.id}
                      variant="secondary"
                      className="text-[9px] h-3.5 px-1 py-0"
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
              {req.controlCategories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {req.controlCategories.map((c) => (
                    <span
                      key={c}
                      className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {!req.isCovered && (
                <p className="text-[10px] text-red-500">
                  No completed mitigations — requirement not addressed.
                </p>
              )}
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {req.completedCount}/{req.mitigationCount}
        </span>
      </div>
    </div>
  );
}

export function RequirementsCoveragePanel({
  modelId,
}: RequirementsCoveragePanelProps) {
  const [filter, setFilter] = useState<"all" | "uncovered">("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["requirements-coverage", modelId],
    queryFn: () => gapAnalysisApi.getRequirementsCoverage(modelId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="p-4 text-xs text-red-500">
        {(error as Error)?.message ?? "Failed to load coverage"}
      </div>
    );
  }

  const { summary, requirements } = data;
  const displayList =
    filter === "uncovered"
      ? requirements.filter((r) => !r.isCovered)
      : requirements;

  const pctColor =
    summary.coveragePct >= 75
      ? "text-emerald-600"
      : summary.coveragePct >= 40
        ? "text-yellow-600"
        : "text-red-500";

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2 shrink-0">
        <h3 className="text-sm font-semibold">Requirements Coverage</h3>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {summary.covered}/{summary.total} requirements addressed
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
        <div className="flex gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 text-xs py-1 rounded transition-colors ${filter === "all" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            All ({summary.total})
          </button>
          <button
            onClick={() => setFilter("uncovered")}
            className={`flex-1 text-xs py-1 rounded transition-colors ${filter === "uncovered" ? "bg-red-50 text-red-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Uncovered ({summary.uncovered})
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {displayList.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {filter === "uncovered"
              ? "All requirements have effective mitigations."
              : "No requirements defined yet."}
          </div>
        ) : (
          <div>
            {displayList.map((req) => (
              <RequirementRow key={req.id} req={req} />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <FileText className="h-3 w-3" />
        <span>{summary.total} requirements</span>
        {summary.uncovered > 0 && (
          <>
            <span>·</span>
            <span className="text-red-500">{summary.uncovered} uncovered</span>
          </>
        )}
      </div>
    </div>
  );
}
