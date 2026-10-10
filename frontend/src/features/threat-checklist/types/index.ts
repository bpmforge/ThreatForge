/**
 * Threat Checklist feature types.
 */
import type { StrideCategory } from "@/types/canvas";

export type ChecklistResponse = "yes" | "no" | "na";

export interface ChecklistItem {
  id: string;
  category: StrideCategory;
  question: string;
  helpText: string;
  response: ChecklistResponse | null;
  linkedThreatId?: string;
}

export interface ComponentChecklist {
  componentId: string;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
}
