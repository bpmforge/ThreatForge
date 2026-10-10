"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { ThreatPanel, ComplianceReport } from "@/features/threats";
import { ReviewPanel } from "@/features/review";
import { CompletenessPanel } from "@/features/completeness";
import { ChecklistPanel } from "@/features/threat-checklist";
import { SuggestionsPanel } from "@/features/component-suggestions";
import { DocumentsPanel } from "@/features/documents";
import { Layers } from "lucide-react";
import { AttackChainsPanel } from "@/features/attack-chains";
import { ArchitecturalMitigationsPanel } from "@/features/architectural-mitigations";
import { RightPanelAI } from "./RightPanelAI";
import { RightPanelRequirements } from "./RightPanelRequirements";
import { AI_PANELS, REQUIREMENTS_PANELS } from "./model-page-config";
import type { RightPanelType } from "@/stores/ui-store";
import type { ThreatModelSummary } from "@/features/dashboard/types";
import type { ExpertAnalysisResult } from "@/features/ai";

interface RightPanelContentProps {
  activeRightPanel: RightPanelType;
  modelId: string;
  mounted: boolean;
  allModels: ThreatModelSummary[] | undefined;
  expertResult: ExpertAnalysisResult | null;
  triggerImport: (() => void) | null;
  handleReExtract: (docId: string) => Promise<void>;
  setGapAnalysisOpen: (open: boolean) => void;
  setViewingDocId: (id: string | null) => void;
  setActiveRightPanel: (panel: RightPanelType) => void;
  onNavigateToModel: (id: string) => void;
}

export function RightPanelContent({
  activeRightPanel,
  modelId,
  mounted,
  allModels,
  expertResult,
  triggerImport,
  handleReExtract,
  setGapAnalysisOpen,
  setViewingDocId,
  setActiveRightPanel,
  onNavigateToModel,
}: RightPanelContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {activeRightPanel === "properties" && (
        <PropertiesPanel modelId={modelId} />
      )}
      {activeRightPanel === "threats" && (
        <ErrorBoundary
          section="ThreatPanel"
          fallback="Failed to load threat panel"
        >
          <ThreatPanel modelId={modelId} />
        </ErrorBoundary>
      )}
      {activeRightPanel === "checklist" && <ChecklistPanel />}
      {activeRightPanel === "suggest" && <SuggestionsPanel />}
      {activeRightPanel === "score" && <CompletenessPanel modelId={modelId} />}
      {activeRightPanel === "compliance" && (
        <ComplianceReport modelId={modelId} />
      )}
      {activeRightPanel === "review" && <ReviewPanel modelId={modelId} />}
      {AI_PANELS.has(activeRightPanel) && (
        <RightPanelAI
          modelId={modelId}
          activeRightPanel={activeRightPanel}
          expertResult={expertResult}
          setActiveRightPanel={setActiveRightPanel}
        />
      )}
      {REQUIREMENTS_PANELS.has(activeRightPanel) && (
        <RightPanelRequirements
          modelId={modelId}
          activeRightPanel={activeRightPanel}
          setActiveRightPanel={setActiveRightPanel}
        />
      )}
      {activeRightPanel === "chains" && (
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="min-h-[50%] flex-1">
            <AttackChainsPanel modelId={modelId} />
          </div>
          <ArchitecturalMitigationsPanel modelId={modelId} />
        </div>
      )}
      {activeRightPanel === "similar" && (
        <div className="h-full overflow-y-auto p-3 space-y-2">
          <h4 className="text-sm font-semibold">Other Models</h4>
          <p className="text-[10px] text-muted-foreground mb-2">
            Browse models in your organization to compare patterns.
          </p>
          {mounted &&
            (allModels ?? [])
              .filter((m) => m.id !== modelId)
              .sort(
                (a, b) =>
                  new Date(b.lastModified).getTime() -
                  new Date(a.lastModified).getTime(),
              )
              .slice(0, 15)
              .map((m) => (
                <button
                  key={m.id}
                  className="w-full p-2.5 border rounded-lg text-left hover:bg-muted/30 transition-colors"
                  onClick={() => onNavigateToModel(m.id)}
                >
                  <p className="text-xs font-medium truncate" title={m.name}>
                    {m.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>
                      {m.threatCount} threat{m.threatCount !== 1 ? "s" : ""}
                    </span>
                    {m.openThreatCount > 0 && (
                      <span className="text-amber-600">
                        {m.openThreatCount} open
                      </span>
                    )}
                    <span>
                      {new Date(m.lastModified).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {m.projectName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {m.projectName}
                    </p>
                  )}
                </button>
              ))}
          {mounted &&
            (allModels ?? []).filter((m) => m.id !== modelId).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Layers className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-xs">
                  No other models in this organization yet.
                </p>
              </div>
            )}
        </div>
      )}
      {activeRightPanel === "docs" && (
        <DocumentsPanel
          modelId={modelId}
          onViewDocument={(docId) => setViewingDocId(docId)}
          onImportDocument={() => triggerImport?.()}
          onGapAnalysis={() => setGapAnalysisOpen(true)}
          onReExtract={handleReExtract}
        />
      )}
    </div>
  );
}
