"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AISuggestedThreat } from "../types";
import { useAIThreatActions } from "../hooks/useAIThreatActions";
import { AnalysisQueue } from "./AnalysisQueue";
import { ThreatsList } from "./ThreatsList";
import { AIAnalysisButtons } from "./AIAnalysisButtons";

const METHODOLOGY_OPTIONS = [
  {
    value: "stride",
    label: "STRIDE",
    description:
      "Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation",
  },
  {
    value: "pasta",
    label: "PASTA",
    description:
      "Risk-centric: Business Logic, Data Exposure, Access Control, Injection",
  },
  {
    value: "kill_chain",
    label: "Kill Chain",
    description:
      "Attack lifecycle: Recon, Delivery, Exploitation, Installation, C2",
  },
  {
    value: "mitre_attack",
    label: "MITRE ATT&CK",
    description:
      "11 tactics: Initial Access, Execution, Persistence, Lateral Movement",
  },
];

interface AIThreatSuggestionsProps {
  modelId: string | null;
  onAddThreat: (threat: AISuggestedThreat) => void;
}

export function AIThreatSuggestions({
  modelId,
  onAddThreat,
}: AIThreatSuggestionsProps) {
  const a = useAIThreatActions(modelId);

  if (!modelId) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Save your threat model to use AI suggestions.
      </div>
    );
  }

  if (a.checking) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Checking AI availability...
      </div>
    );
  }

  if (!a.available) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>AI features not available.</p>
        <p className="mt-1">
          <a href="/organization" className="text-primary underline">
            Configure AI in Settings
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2 shrink-0">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Framework
          </label>
          <Select value={a.methodology} onValueChange={a.setMethodology}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODOLOGY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground ml-1 text-[10px]">
                      {opt.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {a.analysisStatus &&
          a.analysisStatus.dirty > 0 &&
          a.analysisStatus.hasEverBeenAnalyzed && (
            <div className="flex items-center gap-1.5 px-1 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>
                {a.analysisStatus.dirty} of {a.analysisStatus.total} component
                {a.analysisStatus.total !== 1 ? "s" : ""} changed since last
                analysis
              </span>
            </div>
          )}

        <AIAnalysisButtons
          methodology={a.methodology}
          analysisStatus={a.analysisStatus}
          quickMode={a.quickMode}
          loading={a.loading}
          jobId={a.jobId}
          rescoring={a.rescoring}
          onAnalyze={(opts) => {
            a.suggestThreats({ methodology: a.methodology, ...opts });
            void a.refetchStatus();
          }}
          onToggleQuickMode={() => a.setQuickMode(!a.quickMode)}
          onRegenerateMitigations={a.handleRegenerateMitigations}
          onRescoreOnly={a.handleRescoreOnly}
        />

        {a.mitigationsStale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                onClick={a.handleRefreshMitigations}
                disabled={a.refreshingMitigations || a.loading}
                aria-label="Refresh mitigations using updated requirements"
              >
                {a.refreshingMitigations ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {a.refreshingMitigations
                  ? "Refreshing…"
                  : "Refresh Mitigations (requirements updated)"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Re-generate mitigations for pending threats using the latest
              uploaded requirements document
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={a.handleVerifyCitations}
              disabled={a.verifying || a.loading}
              aria-label="Verify all citations"
            >
              {a.verifying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              )}
              {a.verifying ? "Verifying…" : "Verify All Citations"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Re-run citation cross-check on all pending threats and mitigations
          </TooltipContent>
        </Tooltip>
      </div>

      <AnalysisQueue
        jobs={a.jobs ?? []}
        activeJobId={a.jobId}
        busyIds={a.busy}
        dismissedIds={a.dismissed}
        onCancel={a.handleCancel}
        onPause={a.handlePause}
        onRetry={a.handleRetry}
        onDismiss={a.handleDismiss}
      />

      {a.error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm">{a.error}</div>
      )}

      <ThreatsList
        threats={a.threats}
        loading={a.loading}
        onAddThreat={onAddThreat}
        onClear={a.clearSuggestions}
      />
    </div>
  );
}
