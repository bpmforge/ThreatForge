"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  GitCompare,
} from "lucide-react";

interface ModelSummary {
  id: string;
  name: string;
  projectName?: string;
}

interface ModelRiskSummary {
  id: string;
  name: string;
  projectName: string;
  metrics: {
    totalThreats: number;
    openThreats: number;
    criticalCount: number;
    highCount: number;
    mitigationRate: number;
    riskScore: number;
    componentCount: number;
  };
}

interface ComparisonResult {
  models: ModelRiskSummary[];
  averages: {
    riskScore: number;
    mitigationRate: number;
    threatsPerModel: number;
  };
  highestRisk: ModelRiskSummary | null;
  needsAttention: ModelRiskSummary[];
}

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-red-100 text-red-700 border-red-200"
      : score >= 30
        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
        : "bg-green-100 text-green-700 border-green-200";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {score}
    </span>
  );
}

function MitRate({ rate }: { rate: number }) {
  const color =
    rate >= 70
      ? "text-green-600"
      : rate >= 40
        ? "text-yellow-600"
        : "text-red-600";
  return <span className={`font-medium ${color}`}>{rate}%</span>;
}

export default function ModelComparePage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: models = [] } = useQuery({
    queryKey: ["threat-models-list"],
    queryFn: () => apiGet<ModelSummary[]>("/api/threat-models"),
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const compare = async () => {
    if (selected.size < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<ComparisonResult>("/api/reporting/compare", {
        modelIds: Array.from(selected),
      });
      setResult(data);
    } catch (e) {
      setError(getErrorMessage(e, "Comparison failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GitCompare className="h-6 w-6" />
              Model Comparison
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Select 2–10 models to compare risk metrics side-by-side
            </p>
          </div>
          <Button onClick={compare} disabled={selected.size < 2 || loading}>
            {loading
              ? "Comparing…"
              : `Compare ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </Button>
        </div>

        {/* Model picker */}
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-3">Select Models</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {models.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selected.has(m.id)}
                  onCheckedChange={() => toggle(m.id)}
                  disabled={!selected.has(m.id) && selected.size >= 10}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  {m.projectName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {m.projectName}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        {/* Comparison table */}
        {result && (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold text-center">
                    <span className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> Risk Score
                    </span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    <span className="flex items-center justify-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Mitigated
                    </span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    <span className="flex items-center justify-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Open
                    </span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Critical
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">Total</th>
                  <th className="px-4 py-3 font-semibold text-center">
                    <span className="flex items-center justify-center gap-1">
                      <ArrowUpDown className="h-3.5 w-3.5" /> Components
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.models.map((m, i) => (
                  <tr key={m.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.projectName}
                      </p>
                      {result.highestRisk?.id === m.id && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] mt-0.5"
                        >
                          Highest Risk
                        </Badge>
                      )}
                      {result.needsAttention.some((n) => n.id === m.id) && (
                        <Badge
                          variant="outline"
                          className="text-[10px] mt-0.5 border-red-300 text-red-600"
                        >
                          Needs Attention
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RiskBadge score={m.metrics.riskScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MitRate rate={m.metrics.mitigationRate} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.metrics.openThreats}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.metrics.criticalCount > 0 ? (
                        <span className="text-red-600 font-medium">
                          {m.metrics.criticalCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.metrics.totalThreats}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.metrics.componentCount}
                    </td>
                  </tr>
                ))}
                {/* Averages row */}
                <tr className="border-t bg-muted/40 font-medium">
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    Avg across selected
                  </td>
                  <td className="px-4 py-2 text-center">
                    <RiskBadge score={result.averages.riskScore} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <MitRate rate={result.averages.mitigationRate} />
                  </td>
                  <td className="px-4 py-2 text-center text-muted-foreground">
                    —
                  </td>
                  <td className="px-4 py-2 text-center text-muted-foreground">
                    —
                  </td>
                  <td className="px-4 py-2 text-center">
                    {result.averages.threatsPerModel}
                  </td>
                  <td className="px-4 py-2 text-center text-muted-foreground">
                    —
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
