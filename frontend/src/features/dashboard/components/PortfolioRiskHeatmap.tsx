"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModelSummary } from "../hooks/usePortfolioDashboard";

interface Props {
  models: ModelSummary[];
}

const SEVERITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const cellColor = (score: number) => {
  if (score >= 75) return "bg-red-500";
  if (score >= 50) return "bg-orange-400";
  if (score >= 25) return "bg-yellow-400";
  return "bg-green-400";
};

export function PortfolioRiskHeatmap({ models }: Props) {
  const sorted = [...models]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 12);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Risk Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No models to display.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Model Risk Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left pr-3 py-1 font-medium text-muted-foreground w-24">
                  Severity
                </th>
                {sorted.map((m) => (
                  <th
                    key={m.id}
                    className="px-1 py-1 font-medium text-muted-foreground text-center max-w-[60px]"
                    title={m.name}
                  >
                    <span className="block truncate max-w-[60px]">
                      {m.name.length > 8 ? m.name.slice(0, 8) + "…" : m.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEVERITY_LEVELS.map((level) => (
                <tr key={level}>
                  <td className="pr-3 py-1 font-medium text-muted-foreground">
                    {level}
                  </td>
                  {sorted.map((m) => (
                    <td key={m.id} className="px-1 py-1 text-center">
                      <div
                        className={`rounded w-8 h-6 mx-auto ${cellColor(m.riskScore)}`}
                        title={`${m.name}: risk score ${m.riskScore}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" />
            Critical (75+)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
            High (50-74)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-400 inline-block" />
            Medium (25-49)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-400 inline-block" />
            Low (&lt;25)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
