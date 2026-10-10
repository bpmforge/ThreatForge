"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { Layers, FolderOpen } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentOrgId } from "@/stores/org-store";
import { useOrganizations } from "@/features/organizations/hooks/useOrganization";
import {
  useSystemicPatterns,
  type PatternKind,
} from "@/features/reports/hooks/useSystemicPatterns";

const MIN_MODEL_OPTIONS = [2, 3, 5, 10];
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const KIND_LABEL: Record<PatternKind, string> = {
  name: "Threat",
  category: "Category",
  cwe: "CWE",
};

function SeverityMix({ mix }: { mix: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {SEVERITIES.filter((s) => mix[s]).map((s) => (
        <Badge
          key={s}
          variant={s === "CRITICAL" || s === "HIGH" ? "destructive" : "outline"}
          className="text-[10px]"
        >
          {s} {mix[s]}
        </Badge>
      ))}
    </div>
  );
}

export default function SystemicPatternsPage() {
  const orgId = useCurrentOrgId();
  const { data: orgs } = useOrganizations();
  const effectiveOrgId = orgId || orgs?.[0]?.id || null;
  const [minModels, setMinModels] = useState(2);

  const { data, isLoading, error } = useSystemicPatterns(
    effectiveOrgId,
    minModels,
  );

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="h-6 w-6" />
              Systemic Patterns
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Threats that recur across models in this organization — fix them
              once, at the platform level.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Appears in at least</span>
            <Select
              value={String(minModels)}
              onValueChange={(v) => setMinModels(Number(v))}
            >
              <SelectTrigger className="w-20" aria-label="Minimum models">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIN_MODEL_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">models</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {getErrorMessage(error, "Failed to load patterns")}
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Analysing portfolio…</p>
        )}

        {data && data.patterns.length === 0 && (
          <div className="text-center space-y-3 max-w-sm mx-auto py-12">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">No recurring patterns</h2>
            <p className="text-sm text-muted-foreground">
              No threat, category or CWE appears in {minModels} or more of the{" "}
              {data.totalModels} models in this organization.
            </p>
          </div>
        )}

        {data && data.patterns.length > 0 && (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold">Pattern</th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Models
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Threats
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Unmitigated
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">
                    Severity mix
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">
                    Affected models
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.patterns.map((p, i) => (
                  <tr
                    key={`${p.kind}:${p.key}`}
                    className={i % 2 === 0 ? "" : "bg-muted/20"}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.label}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {KIND_LABEL[p.kind]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">
                      {p.modelCount}
                      <span className="text-muted-foreground font-normal">
                        /{data.totalModels}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{p.threatCount}</td>
                    <td className="px-4 py-3 text-center">
                      {p.unmitigatedCount > 0 ? (
                        <span className="text-red-600 font-medium">
                          {p.unmitigatedCount}
                        </span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SeverityMix mix={p.severityMix} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.affectedModels.map((m) => (
                        <p key={m.id} className="truncate max-w-xs">
                          {m.name}
                          <span className="text-muted-foreground">
                            {" "}
                            · {m.projectName}
                            {m.unmitigatedCount > 0 &&
                              ` · ${m.unmitigatedCount} open`}
                          </span>
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
