"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirementsPanel } from "@/features/requirements/components/RequirementsPanel";
import { GapAnalysisPanel } from "@/features/requirements/components/GapAnalysisPanel";
import { RequirementsCoveragePanel } from "@/features/requirements/components/RequirementsCoveragePanel";
import type { RightPanelType } from "@/stores/ui-store";

/**
 * Consolidated Requirements panel. Requirements / Gaps / Coverage used to be
 * three separate right-panel tabs; they are now sub-views of a single
 * "Requirements" tab, driven by the global `activeRightPanel` key
 * ("requirements" | "gaps" | "coverage") so any existing navigation to those
 * keys still resolves here with the correct sub-view.
 */
const REQ_SUBTABS: { key: RightPanelType; label: string }[] = [
  { key: "requirements", label: "Requirements" },
  { key: "gaps", label: "Gaps" },
  { key: "coverage", label: "Coverage" },
];

interface RightPanelRequirementsProps {
  modelId: string;
  activeRightPanel: RightPanelType;
  setActiveRightPanel: (panel: RightPanelType) => void;
}

export function RightPanelRequirements({
  modelId,
  activeRightPanel,
  setActiveRightPanel,
}: RightPanelRequirementsProps) {
  const value = REQ_SUBTABS.some((t) => t.key === activeRightPanel)
    ? activeRightPanel
    : "requirements";

  return (
    <div className="flex flex-col h-full min-h-0">
      <Tabs
        value={value}
        onValueChange={(v) => setActiveRightPanel(v as RightPanelType)}
        className="shrink-0 px-2 pt-2"
      >
        <TabsList className="w-full">
          {REQ_SUBTABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1 text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex-1 min-h-0 overflow-hidden">
        {value === "requirements" && <RequirementsPanel modelId={modelId} />}
        {value === "gaps" && <GapAnalysisPanel modelId={modelId} />}
        {value === "coverage" && (
          <RequirementsCoveragePanel modelId={modelId} />
        )}
      </div>
    </div>
  );
}
