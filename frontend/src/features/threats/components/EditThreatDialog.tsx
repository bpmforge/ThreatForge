"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Threat } from "../types";
import type { ThreatRiskScores } from "../types/risk-frameworks";
import type { StrideCategory, Severity } from "@/types/canvas";
import {
  STRIDE_CATEGORIES,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "../constants";
import { CategorySelect } from "./CategorySelect";
import { RiskScorePanel } from "./risk-scoring";
import { AssigneePicker } from "./AssigneePicker";
import { ThreatReviewActions } from "./ThreatReviewActions";
import { useEditThreatForm } from "../hooks/useEditThreatForm";

interface EditThreatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threat: Threat;
  existingCategories: string[];
  orgId?: string | null;
  hasBusinessContext?: boolean;
  onSubmit: (data: {
    name: string;
    description?: string;
    strideCategories: StrideCategory[];
    severity: Severity;
    status: string;
    category?: string | null;
    riskScores?: ThreatRiskScores;
    assigneeId?: string | null;
    likelihood?: number | null;
  }) => void;
  onReview?: (action: "accept" | "reject" | "modify", notes?: string) => void;
  onResetToAi?: () => void;
}

export function EditThreatDialog({
  open,
  onOpenChange,
  threat,
  existingCategories,
  orgId,
  hasBusinessContext,
  onSubmit,
  onReview,
  onResetToAi,
}: EditThreatDialogProps) {
  const f = useEditThreatForm({ threat, onOpenChange, onSubmit });

  return (
    <Dialog open={open} onOpenChange={f.handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Threat</DialogTitle>
          <DialogDescription>
            Update threat details, risk scores, and properties
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={f.activeTab}
          onValueChange={f.setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="risk-scoring">Risk Scoring</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-threat-name">Threat Name</Label>
              <Input
                id="edit-threat-name"
                value={f.name}
                onChange={(e) => f.setNameOverride(e.target.value)}
                placeholder="e.g., SQL Injection"
              />
            </div>

            <div className="space-y-2">
              <Label>STRIDE Categories</Label>
              <div className="grid grid-cols-2 gap-2">
                {STRIDE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => f.toggleStrideCategory(cat.value)}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      f.strideCategories.includes(cat.value)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                          f.strideCategories.includes(cat.value)
                            ? "bg-blue-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {cat.short}
                      </span>
                      <span className="text-sm font-medium">{cat.label}</span>
                    </div>
                  </button>
                ))}
              </div>
              {f.strideCategories.length === 0 && (
                <p className="text-xs text-amber-600">
                  Select at least one category
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-severity">Severity</Label>
                <Select
                  value={f.severity}
                  onValueChange={(v) => f.setSeverityOverride(v as Severity)}
                >
                  <SelectTrigger id="edit-severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((sev) => (
                      <SelectItem key={sev.value} value={sev.value}>
                        {sev.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={f.status} onValueChange={f.setStatusOverride}>
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasBusinessContext && (
              <div className="space-y-2">
                <Label htmlFor="edit-likelihood">
                  Likelihood{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    {f.likelihood !== null && f.likelihood !== undefined
                      ? `${Math.round(f.likelihood * 100)}%`
                      : "Not set"}
                  </span>
                </Label>
                <Slider
                  id="edit-likelihood"
                  min={0}
                  max={100}
                  step={5}
                  value={[
                    f.likelihood !== null && f.likelihood !== undefined
                      ? Math.round(f.likelihood * 100)
                      : 50,
                  ]}
                  onValueChange={([v]) => f.setLikelihoodOverride(v / 100)}
                  aria-label="Threat likelihood percentage"
                />
              </div>
            )}

            <CategorySelect
              value={f.category}
              onChange={f.setCategoryOverride}
              existingCategories={existingCategories}
              optional
            />

            {orgId && (
              <div className="space-y-2">
                <Label htmlFor="edit-assignee">Assignee</Label>
                <AssigneePicker
                  orgId={orgId}
                  value={f.assigneeId}
                  assignee={threat.assignee}
                  onChange={f.setAssigneeIdOverride}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={f.description}
                onChange={(e) => f.setDescriptionOverride(e.target.value)}
                placeholder="Describe the threat in detail, including attack vectors, prerequisites, and potential impact..."
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="risk-scoring" className="py-4">
            <RiskScorePanel
              value={f.riskScores}
              onChange={f.setRiskScoresOverride}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onResetToAi &&
            threat.manuallyEdited &&
            threat.source !== "MANUAL" && (
              <Button
                variant="outline"
                onClick={() => {
                  onResetToAi();
                  f.handleOpenChange(false);
                }}
                title="Clear your edits so the next AI run can update this threat"
              >
                Reset to AI
              </Button>
            )}
          {onReview &&
            threat.source &&
            threat.source !== "MANUAL" &&
            threat.reviewStatus === "PENDING" && (
              <ThreatReviewActions
                hasChanges={f.hasChanges}
                onAccept={() => {
                  onReview("accept");
                  f.handleOpenChange(false);
                }}
                onReject={() => {
                  onReview("reject");
                  f.handleOpenChange(false);
                }}
                onAcceptWithChanges={() => {
                  onReview("modify");
                  f.handleSubmit();
                }}
              />
            )}
          <Button variant="outline" onClick={() => f.handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={f.handleSubmit}
            disabled={
              !f.name.trim() || f.strideCategories.length === 0 || !f.hasChanges
            }
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
