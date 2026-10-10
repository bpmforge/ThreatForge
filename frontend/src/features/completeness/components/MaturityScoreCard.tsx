"use client";

import { cn } from "@/lib/utils";
import { useMaturityScore } from "../hooks/useMaturityScore";

interface MaturityScoreCardProps {
  modelId: string;
}

const GRADE_CONFIG = {
  A: {
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    label: "Excellent",
  },
  B: {
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    label: "Good",
  },
  C: {
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    label: "Fair",
  },
  D: {
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    label: "Needs Work",
  },
  F: {
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Incomplete",
  },
} as const;

const DIMENSION_LABELS: Record<string, string> = {
  architecture: "Architecture",
  threatCoverage: "Threat Coverage",
  mitigationRate: "Mitigations",
  compliance: "Compliance",
  review: "Peer Review",
  freshness: "Freshness",
  context: "Data Context",
};

export function MaturityScoreCard({ modelId }: MaturityScoreCardProps) {
  const { score, isLoading } = useMaturityScore(modelId);

  if (isLoading) {
    return <div className="h-24 rounded-lg bg-muted animate-pulse" />;
  }
  if (!score) return null;

  const cfg = GRADE_CONFIG[score.grade];

  return (
    <div className={cn("rounded-lg border p-3 space-y-3", cfg.bg)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">
            Maturity Score
          </p>
          <p className="text-2xl font-bold leading-none mt-0.5">
            <span className={cfg.color}>{score.grade}</span>
            <span className="text-sm font-normal text-muted-foreground ml-1.5">
              {score.overall}/100 · {cfg.label}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {Object.entries(score.breakdown).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {DIMENSION_LABELS[key] ?? key}
              </p>
              <div className="h-1 rounded-full bg-muted/60 mt-0.5">
                <div
                  className={cn(
                    "h-1 rounded-full transition-all",
                    cfg.color.replace("text-", "bg-"),
                  )}
                  style={{ width: `${val}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-medium tabular-nums w-6 text-right">
              {val}
            </span>
          </div>
        ))}
      </div>

      {score.suggestions.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-current/10">
          {score.suggestions.slice(0, 2).map((s, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              · {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
