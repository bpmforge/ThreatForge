"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useEditMitigationForm,
  CONTROL_CATEGORIES,
} from "../hooks/useEditMitigationForm";
import { EvidenceLinksSection } from "./EvidenceLinksSection";
import { RequirementLinksSection } from "./RequirementLinksSection";
import type { Mitigation, MitigationStrategy, EvidenceLink } from "../types";
import {
  PRIORITY_OPTIONS,
  MITIGATION_STATUS_OPTIONS,
  MITIGATION_STRATEGY_OPTIONS,
} from "../constants";

interface EditMitigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mitigation: Mitigation;
  modelId?: string | null;
  onSubmit: (data: {
    description: string;
    status: string;
    priority: string;
    strategy: MitigationStrategy;
    notes?: string | null;
    controlCategory?: string | null;
    testCriteria?: string | null;
    testResult?: string | null;
    evidenceLinks?: EvidenceLink[] | null;
    requirementIds?: string[] | null;
    effectivenessScore?: number | null;
    verified?: boolean;
    obligation?: "REQUIRED" | "RECOMMENDED";
  }) => void;
}

export function EditMitigationDialog({
  open,
  onOpenChange,
  mitigation,
  modelId,
  onSubmit,
}: EditMitigationDialogProps) {
  const f = useEditMitigationForm({
    mitigation,
    modelId,
    onOpenChange,
    onSubmit,
  });

  return (
    <Dialog open={open} onOpenChange={f.handleOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-hidden"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit Mitigation</DialogTitle>
          <DialogDescription>Update mitigation details</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-mit-desc">Description</Label>
              <Textarea
                id="edit-mit-desc"
                value={f.description}
                onChange={(e) => f.setDescription(e.target.value)}
                placeholder="High-level control statement..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-mit-status">Status</Label>
                <Select value={f.status} onValueChange={f.setStatus}>
                  <SelectTrigger id="edit-mit-status" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MITIGATION_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mit-priority">Priority</Label>
                <Select value={f.priority} onValueChange={f.setPriority}>
                  <SelectTrigger id="edit-mit-priority" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-mit-strategy">Strategy</Label>
                <Select
                  value={f.strategy}
                  onValueChange={(v) => f.setStrategy(v as MitigationStrategy)}
                >
                  <SelectTrigger id="edit-mit-strategy" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MITIGATION_STRATEGY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mit-obligation">Obligation</Label>
                <Select value={f.obligation} onValueChange={f.setObligation}>
                  <SelectTrigger id="edit-mit-obligation" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REQUIRED">Required</SelectItem>
                    <SelectItem value="RECOMMENDED">Recommended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {f.status === "IMPLEMENTED" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-mit-verified"
                  checked={f.verified}
                  onChange={(e) => f.setVerified(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label
                  htmlFor="edit-mit-verified"
                  className="text-sm font-normal cursor-pointer"
                >
                  Implementation verified
                </Label>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-mit-effectiveness">
                Effectiveness ({Math.round((f.effectivenessScore ?? 0) * 100)}%)
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  id="edit-mit-effectiveness"
                  min="0"
                  max="85"
                  value={Math.round((f.effectivenessScore ?? 0) * 100)}
                  onChange={(e) =>
                    f.setEffectivenessScore(parseInt(e.target.value) / 100)
                  }
                  className="flex-1 h-2 accent-primary"
                />
                <span className="text-sm text-muted-foreground w-10 text-right">
                  {Math.round((f.effectivenessScore ?? 0) * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                How much this mitigation reduces the threat risk (max 85%)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mit-category">Control Category</Label>
              <Select
                value={f.controlCategory || "ACCESS_CONTROL"}
                onValueChange={f.setControlCategory}
              >
                <SelectTrigger id="edit-mit-category" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTROL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mit-test">Test Criteria</Label>
              <Textarea
                id="edit-mit-test"
                value={f.testCriteria}
                onChange={(e) => f.setTestCriteria(e.target.value)}
                placeholder="Confirm that [testable condition]..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mit-result">Test Result</Label>
              <Select
                value={f.testResult || "UNTESTED"}
                onValueChange={f.setTestResult}
              >
                <SelectTrigger id="edit-mit-result" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNTESTED">Untested</SelectItem>
                  <SelectItem value="PASS">Pass</SelectItem>
                  <SelectItem value="FAIL">Fail</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mit-notes">Implementation Notes</Label>
              <Textarea
                id="edit-mit-notes"
                value={f.notes}
                onChange={(e) => f.setNotes(e.target.value)}
                placeholder="What was actually implemented..."
                rows={2}
              />
            </div>

            <EvidenceLinksSection
              evidenceLinks={f.evidenceLinks}
              newLinkType={f.newLinkType}
              newLinkUrl={f.newLinkUrl}
              newLinkTitle={f.newLinkTitle}
              onTypeChange={f.setNewLinkType}
              onUrlChange={f.setNewLinkUrl}
              onTitleChange={f.setNewLinkTitle}
              onAdd={f.addEvidenceLink}
              onRemove={f.removeEvidenceLink}
            />

            <RequirementLinksSection
              dbRequirements={f.dbRequirements}
              selectedIds={f.selectedIds}
              aiCitedReqIds={f.aiCitedReqIds}
              onToggle={f.toggleRequirement}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => f.handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={f.handleSubmit} disabled={!f.description.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
