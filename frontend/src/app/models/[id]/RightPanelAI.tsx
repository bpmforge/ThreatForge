"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AIThreatSuggestions,
  StreamingChatPanel,
  ExpertAnalysisResults,
  RefinementQuestionsPanel,
} from "@/features/ai";
import type { RightPanelType } from "@/stores/ui-store";
import type { ExpertAnalysisResult } from "@/features/ai";

/**
 * Consolidated AI panel. The four AI surfaces (Suggestions / Chat / Expert /
 * Refine) used to be four separate right-panel tabs; they are now sub-views of a
 * single "AI" tab. The active sub-view is driven by the global `activeRightPanel`
 * key (still one of "ai" | "chat" | "expert" | "refine"), so existing deep-links
 * such as useExpertAnalysis's setActiveRightPanel("expert") keep working and land
 * here with the right sub-view selected.
 */
const AI_SUBTABS: { key: RightPanelType; label: string }[] = [
  { key: "ai", label: "Suggestions" },
  { key: "chat", label: "Chat" },
  { key: "expert", label: "Expert" },
  { key: "refine", label: "Refine" },
];

interface RightPanelAIProps {
  modelId: string;
  activeRightPanel: RightPanelType;
  expertResult: ExpertAnalysisResult | null;
  setActiveRightPanel: (panel: RightPanelType) => void;
}

export function RightPanelAI({
  modelId,
  activeRightPanel,
  expertResult,
  setActiveRightPanel,
}: RightPanelAIProps) {
  const value = AI_SUBTABS.some((t) => t.key === activeRightPanel)
    ? activeRightPanel
    : "ai";

  return (
    <div className="flex flex-col h-full min-h-0">
      <Tabs
        value={value}
        onValueChange={(v) => setActiveRightPanel(v as RightPanelType)}
        className="shrink-0 px-2 pt-2"
      >
        <TabsList className="w-full">
          {AI_SUBTABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1 text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex-1 min-h-0 overflow-hidden">
        {value === "ai" && (
          <ErrorBoundary
            section="AIThreatSuggestions"
            fallback="Failed to load AI suggestions"
          >
            <AIThreatSuggestions
              modelId={modelId}
              onAddThreat={() => setActiveRightPanel("threats")}
            />
          </ErrorBoundary>
        )}
        {value === "chat" && (
          <ErrorBoundary
            section="StreamingChatPanel"
            fallback="Failed to load chat panel"
          >
            <StreamingChatPanel
              modelId={modelId}
              onClose={() => setActiveRightPanel("properties")}
            />
          </ErrorBoundary>
        )}
        {value === "expert" && (
          <ErrorBoundary
            section="ExpertAnalysisResults"
            fallback="Failed to load expert analysis"
          >
            <ExpertAnalysisResults result={expertResult} />
          </ErrorBoundary>
        )}
        {value === "refine" && (
          <ErrorBoundary
            section="RefinementQuestionsPanel"
            fallback="Failed to load refinement questions"
          >
            <RefinementQuestionsPanel modelId={modelId} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
