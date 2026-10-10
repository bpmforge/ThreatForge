"use client";

import { AddMitigationDialog } from "./AddMitigationDialog";
import { EditThreatDialog } from "./EditThreatDialog";
import { ThreatRefinementSheet } from "./ThreatRefinementSheet";
import { EditMitigationDialog } from "./EditMitigationDialog";
import { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";
import { MoveMitigationDialog } from "./MoveMitigationDialog";
import type { Threat, Mitigation, MitigationStrategy } from "../types";
import type { StrideCategory, Severity } from "@/types/canvas";

interface ThreatPanelDialogsProps {
  modelId: string | null;
  orgId: string | null;
  threats: Threat[];
  mitigationThreatId: string | null;
  movingMitigation: { threatId: string; mitigationId: string } | null;
  editThreat: Threat | null;
  editMitigation: { threatId: string; mitigation: Mitigation } | null;
  templateThreat: Threat | null;
  refineThreat: Threat | null;
  uniqueCategories: string[];
  onMitigationThreatIdChange: (id: string | null) => void;
  onMovingMitigationChange: (
    v: { threatId: string; mitigationId: string } | null,
  ) => void;
  onEditThreatChange: (t: Threat | null) => void;
  onEditMitigationChange: (
    v: { threatId: string; mitigation: Mitigation } | null,
  ) => void;
  onTemplateThreatChange: (t: Threat | null) => void;
  onRefineThreatChange: (t: Threat | null) => void;
  onAddMitigation: (data: {
    description: string;
    priority: string;
    strategy: MitigationStrategy;
    notes?: string;
  }) => Promise<void>;
  onEditThreat: (data: {
    name: string;
    description?: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    status: string;
    category?: string | null;
    assigneeId?: string | null;
  }) => Promise<void>;
  onEditMitigation: (data: {
    description: string;
    status: string;
    priority: string;
    strategy: MitigationStrategy;
    notes?: string | null;
    controlCategory?: string | null;
    testCriteria?: string | null;
    testResult?: string | null;
    evidenceLinks?: Array<{ type: string; url: string; title: string }> | null;
    requirementRefs?: Array<{
      docId: string;
      reqId: string;
      text: string;
    }> | null;
    requirementIds?: string[] | null;
    effectivenessScore?: number | null;
    verified?: boolean;
    obligation?: "REQUIRED" | "RECOMMENDED";
  }) => Promise<void>;
  onApplyRefinement: (
    threatId: string,
    updates: Partial<{ name: string; description: string; severity: Severity }>,
  ) => void;
  onResetThreatToAi: (threatId: string) => void;
}

export function ThreatPanelDialogs({
  modelId,
  orgId,
  threats,
  mitigationThreatId,
  movingMitigation,
  editThreat,
  editMitigation,
  templateThreat,
  refineThreat,
  uniqueCategories,
  onMitigationThreatIdChange,
  onMovingMitigationChange,
  onEditThreatChange,
  onEditMitigationChange,
  onTemplateThreatChange,
  onRefineThreatChange,
  onAddMitigation,
  onEditThreat,
  onEditMitigation,
  onApplyRefinement,
  onResetThreatToAi,
}: ThreatPanelDialogsProps) {
  const movingSource = movingMitigation
    ? threats.find((t) => t.id === movingMitigation.threatId)
    : null;
  const movingMit = movingSource?.mitigations.find(
    (m) => m.id === movingMitigation?.mitigationId,
  );

  return (
    <>
      <AddMitigationDialog
        open={mitigationThreatId !== null}
        onOpenChange={(open) => !open && onMitigationThreatIdChange(null)}
        onSubmit={onAddMitigation}
      />

      {movingSource && movingMit && modelId && (
        <MoveMitigationDialog
          open
          onOpenChange={(v) => !v && onMovingMitigationChange(null)}
          modelId={modelId}
          sourceThreat={movingSource}
          mitigationId={movingMit.id}
          mitigationDescription={movingMit.description}
        />
      )}

      {editThreat && (
        <EditThreatDialog
          open={editThreat !== null}
          onOpenChange={(open) => !open && onEditThreatChange(null)}
          threat={editThreat}
          existingCategories={uniqueCategories}
          orgId={orgId}
          onSubmit={onEditThreat}
          onReview={
            editThreat.source && editThreat.source !== "MANUAL"
              ? async (action, notes) => {
                  try {
                    const { reviewThreat } = await import("../services/api");
                    if (modelId) {
                      await reviewThreat(modelId, editThreat.id, {
                        action,
                        notes,
                      });
                      window.location.reload();
                    }
                  } catch (err) {
                    console.error("Review failed:", err);
                  }
                }
              : undefined
          }
          onResetToAi={
            editThreat.manuallyEdited && editThreat.source !== "MANUAL"
              ? () => onResetThreatToAi(editThreat.id)
              : undefined
          }
        />
      )}

      {editMitigation && (
        <EditMitigationDialog
          open={editMitigation !== null}
          onOpenChange={(open) => !open && onEditMitigationChange(null)}
          mitigation={editMitigation.mitigation}
          modelId={modelId}
          onSubmit={onEditMitigation}
        />
      )}

      {templateThreat && (
        <SaveAsTemplateDialog
          open={templateThreat !== null}
          onOpenChange={(open) => !open && onTemplateThreatChange(null)}
          threat={templateThreat}
        />
      )}

      <ThreatRefinementSheet
        open={refineThreat !== null}
        threat={refineThreat}
        modelId={modelId ?? ""}
        onClose={() => onRefineThreatChange(null)}
        onApplyUpdates={onApplyRefinement}
      />
    </>
  );
}
