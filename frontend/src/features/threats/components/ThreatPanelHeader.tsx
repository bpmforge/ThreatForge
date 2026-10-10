"use client";

/**
 * ThreatPanelHeader - Header with title and add threat buttons.
 */
import { AddThreatDialog } from "./AddThreatDialog";
import { ThreatLibraryDialog } from "@/features/threat-library";
import { Badge } from "@/components/ui/badge";
import type { StrideCategory, Severity, ComponentType } from "@/types/canvas";

interface ThreatPanelHeaderProps {
  modelId: string | null;
  selectedLabel?: string;
  selectedComponentType?: ComponentType;
  showAddDialog: boolean;
  showLibraryDialog: boolean;
  /** Existing categories for autocomplete */
  existingCategories?: string[];
  /** Number of AI_SUGGESTED threats awaiting review */
  pendingSuggestionsCount?: number;
  onShowAddDialogChange: (show: boolean) => void;
  onShowLibraryDialogChange: (show: boolean) => void;
  onAddThreat: (data: {
    name: string;
    description?: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    category?: string;
  }) => void;
  onLibrarySelect: (data: {
    name: string;
    description: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    libraryId: string;
  }) => void;
}

export function ThreatPanelHeader({
  modelId,
  selectedLabel,
  selectedComponentType,
  showAddDialog,
  showLibraryDialog,
  existingCategories,
  pendingSuggestionsCount = 0,
  onShowAddDialogChange,
  onShowLibraryDialogChange,
  onAddThreat,
  onLibrarySelect,
}: ThreatPanelHeaderProps) {
  return (
    <div className="p-3 border-b flex items-center justify-between shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground text-sm">Threats</h2>
          {pendingSuggestionsCount > 0 && (
            <Badge
              variant="secondary"
              className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              aria-label={`${pendingSuggestionsCount} AI suggestions pending review`}
            >
              {pendingSuggestionsCount} pending review
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedLabel ? `For: ${selectedLabel}` : "All threats"}
        </p>
      </div>
      {modelId && (
        <div className="flex items-center gap-1">
          <ThreatLibraryDialog
            open={showLibraryDialog}
            onOpenChange={onShowLibraryDialogChange}
            componentType={selectedComponentType}
            selectedLabel={selectedLabel}
            onSelectThreat={onLibrarySelect}
          />
          <AddThreatDialog
            open={showAddDialog}
            onOpenChange={onShowAddDialogChange}
            selectedLabel={selectedLabel}
            existingCategories={existingCategories}
            onSubmit={onAddThreat}
          />
        </div>
      )}
    </div>
  );
}
