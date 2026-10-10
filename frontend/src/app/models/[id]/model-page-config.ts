import {
  Settings,
  ShieldAlert,
  ClipboardCheck,
  Sparkles,
  FileText,
  ListChecks,
  BarChart3,
  CheckSquare,
  Lightbulb,
  Scale,
  AlertTriangle,
  Layers,
} from "lucide-react";
import type { RightPanelType } from "@/stores/ui-store";

export const TAB_LABELS: Record<string, string> = {
  properties: "Properties",
  threats: "Threats",
  checklist: "Checklist",
  suggest: "Suggest",
  score: "Risk Score",
  compliance: "Compliance",
  review: "Review",
  ai: "AI",
  chat: "Chat",
  similar: "Similar",
  docs: "Docs",
  expert: "Expert",
  refine: "Refine",
  requirements: "Requirements",
  gaps: "Gaps",
  coverage: "Coverage",
  chains: "Attack Chains",
};

export const PRIMARY_RIGHT_TABS = [
  { key: "properties", label: TAB_LABELS["properties"], icon: Settings },
  { key: "threats", label: TAB_LABELS["threats"], icon: ShieldAlert },
  { key: "review", label: TAB_LABELS["review"], icon: ClipboardCheck },
  { key: "ai", label: TAB_LABELS["ai"], icon: Sparkles },
  { key: "docs", label: TAB_LABELS["docs"], icon: FileText },
  { key: "requirements", label: TAB_LABELS["requirements"], icon: ListChecks },
  { key: "score", label: TAB_LABELS["score"], icon: BarChart3 },
];

// Chat/Expert/Refine are now sub-views of the "ai" tab (RightPanelAI); Gaps/
// Coverage are sub-views of the "requirements" tab (RightPanelRequirements).
// They are intentionally absent here so the strip shows 12 tabs, not 17, while
// their keys remain valid RightPanelType values for deep-linking into the
// merged panels (see AI_PANELS / REQUIREMENTS_PANELS below).
export const SECONDARY_RIGHT_TABS = [
  { key: "checklist", label: TAB_LABELS["checklist"], icon: CheckSquare },
  { key: "suggest", label: TAB_LABELS["suggest"], icon: Lightbulb },
  { key: "compliance", label: TAB_LABELS["compliance"], icon: Scale },
  { key: "similar", label: TAB_LABELS["similar"], icon: Layers },
  { key: "chains", label: TAB_LABELS["chains"], icon: AlertTriangle },
];

/** Sub-view keys that live under the single "ai" tab. */
export const AI_PANELS = new Set<RightPanelType>([
  "ai",
  "chat",
  "expert",
  "refine",
]);

/** Sub-view keys that live under the single "requirements" tab. */
export const REQUIREMENTS_PANELS = new Set<RightPanelType>([
  "requirements",
  "gaps",
  "coverage",
]);

/**
 * Collapse a panel key to the tab that represents it in the strip: any AI
 * sub-view maps to "ai", any requirements sub-view maps to "requirements",
 * everything else is its own tab. Used for active-tab highlighting.
 */
export function normalizeRightTab(panel: RightPanelType): RightPanelType {
  if (AI_PANELS.has(panel)) return "ai";
  if (REQUIREMENTS_PANELS.has(panel)) return "requirements";
  return panel;
}
