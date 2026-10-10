"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { AIProviderBadge } from "@/features/ai/components/AIProviderBadge";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RightPanelType } from "@/stores/ui-store";
import {
  PRIMARY_RIGHT_TABS,
  SECONDARY_RIGHT_TABS,
  AI_PANELS,
  normalizeRightTab,
} from "./model-page-config";

interface RightPanelTabsProps {
  modelId: string;
  activeRightPanel: RightPanelType;
  onTabChange: (panel: RightPanelType) => void;
}

export function RightPanelTabs({
  modelId,
  activeRightPanel,
  onTabChange,
}: RightPanelTabsProps) {
  // Collapse AI/requirements sub-views to their parent tab so the correct
  // primary tab stays highlighted when a sub-view (e.g. "expert") is active.
  const normalizedActive = normalizeRightTab(activeRightPanel);
  const activeSecondary = SECONDARY_RIGHT_TABS.find(
    (t) => t.key === normalizedActive,
  );

  return (
    <div className="shrink-0">
      <ScrollableTabs
        tabs={PRIMARY_RIGHT_TABS}
        activeTab={activeSecondary ? "" : normalizedActive}
        onTabChange={(key) => onTabChange(key as RightPanelType)}
        ariaLabel="Panel tabs"
        suffix={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "shrink-0 flex items-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeSecondary
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground",
                )}
                aria-label="More panel tabs"
              >
                {activeSecondary ? activeSecondary.label : "More"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {SECONDARY_RIGHT_TABS.map((tab) => (
                <DropdownMenuItem
                  key={tab.key}
                  onClick={() => onTabChange(tab.key as RightPanelType)}
                  className={cn(
                    activeRightPanel === tab.key &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {AI_PANELS.has(activeRightPanel) && (
        <div className="px-3 py-1 border-b bg-muted/30">
          <AIProviderBadge modelId={modelId} />
        </div>
      )}
    </div>
  );
}
