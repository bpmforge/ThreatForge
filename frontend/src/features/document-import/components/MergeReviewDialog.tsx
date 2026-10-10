"use client";

/**
 * MergeReviewDialog Component
 *
 * Shows users what the merge engine found when importing a second (or third)
 * document into a canvas that already has components. Lets them confirm
 * which items to add, update, or skip before anything touches the canvas.
 */

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  RefreshCw,
  SkipForward,
  ArrowRight,
  GitMerge,
} from "lucide-react";
import type {
  MergePlan,
  MergeCandidate,
  FlowMergeCandidate,
} from "../services/merge-engine";

interface MergeReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mergePlan: MergePlan;
  onConfirm: (plan: MergePlan) => void;
  onCancel: () => void;
}

const ACTION_CONFIG = {
  add: {
    label: "New",
    icon: Plus,
    className: "bg-green-100 text-green-800 border-green-200",
    badgeVariant: "outline" as const,
  },
  update: {
    label: "Exists",
    icon: RefreshCw,
    className: "bg-blue-100 text-blue-800 border-blue-200",
    badgeVariant: "outline" as const,
  },
  skip: {
    label: "Skip",
    icon: SkipForward,
    className: "bg-gray-100 text-gray-600 border-gray-200",
    badgeVariant: "outline" as const,
  },
};

export function MergeReviewDialog({
  open,
  onOpenChange,
  mergePlan,
  onConfirm,
  onCancel,
}: MergeReviewDialogProps): React.ReactElement {
  const [plan, setPlan] = useState<MergePlan>(mergePlan);

  const toggleComponentAction = useCallback((index: number) => {
    setPlan((prev) => {
      const updated = { ...prev, components: [...prev.components] };
      const item = updated.components[index];
      // Cycle: add → skip, update → add → skip
      if (item.action === "add") {
        updated.components[index] = { ...item, action: "skip" };
      } else if (item.action === "update") {
        updated.components[index] = { ...item, action: "add" };
      } else {
        updated.components[index] = {
          ...item,
          action: item.matchedNodeId ? "update" : "add",
        };
      }
      return recalcStats(updated);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(plan);
  }, [plan, onConfirm]);

  const { stats } = plan;
  const totalNew = stats.newComponents + stats.newFlows + stats.newBoundaries;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge Review
          </DialogTitle>
          <DialogDescription>
            Your canvas already has components. Review how new extractions map
            to existing ones.
          </DialogDescription>
        </DialogHeader>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <StatCard label="New" count={stats.newComponents} color="green" />
          <StatCard
            label="Already Exist"
            count={stats.updatedComponents}
            color="blue"
          />
          <StatCard label="New Flows" count={stats.newFlows} color="amber" />
        </div>

        {/* Component list */}
        <ScrollArea className="flex-1 max-h-[400px] rounded-md border">
          <div className="p-3 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">
              Components ({plan.components.length})
            </h4>
            {plan.components.map((candidate, idx) => (
              <ComponentRow
                key={candidate.extracted.id}
                candidate={candidate}
                onClick={() => toggleComponentAction(idx)}
              />
            ))}

            {plan.dataFlows.length > 0 && (
              <>
                <h4 className="text-sm font-semibold text-muted-foreground mt-4 mb-2">
                  Data Flows ({plan.dataFlows.length})
                </h4>
                {plan.dataFlows.map((flow) => (
                  <FlowRow key={flow.extracted.id} flow={flow} />
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Add {totalNew} New Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComponentRow({
  candidate,
  onClick,
}: {
  candidate: MergeCandidate;
  onClick: () => void;
}) {
  const config = ACTION_CONFIG[candidate.action];
  const Icon = config.icon;

  return (
    <button
      type="button"
      className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 ${config.className}`}
      onClick={onClick}
      aria-label={`Toggle merge action for ${candidate.extracted.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="font-medium text-sm truncate">
              {candidate.extracted.name}
            </span>
          </div>
          {candidate.extracted.technology && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              {candidate.extracted.technology}
            </p>
          )}
          {candidate.matchedNodeLabel && candidate.action === "update" && (
            <p className="text-xs mt-1 ml-6">
              Matches existing: <strong>{candidate.matchedNodeLabel}</strong>
              {candidate.matchReason && (
                <span className="text-muted-foreground">
                  {" "}
                  ({candidate.matchReason})
                </span>
              )}
            </p>
          )}
        </div>
        <Badge variant={config.badgeVariant} className="shrink-0 text-xs">
          {config.label}
        </Badge>
      </div>
    </button>
  );
}

function FlowRow({ flow }: { flow: FlowMergeCandidate }) {
  const config = ACTION_CONFIG[flow.action];
  const Icon = config.icon;

  return (
    <div className={`p-2 rounded-lg border text-sm ${config.className}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {flow.extracted.label ||
            `${flow.extracted.sourceId} → ${flow.extracted.targetId}`}
        </span>
        <Badge
          variant={config.badgeVariant}
          className="ml-auto shrink-0 text-xs"
        >
          {config.label}
        </Badge>
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "green" | "blue" | "amber";
}) {
  const colors = {
    green: "bg-green-50 border-green-200 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

/** Recalculate stats after user toggles actions */
function recalcStats(plan: MergePlan): MergePlan {
  return {
    ...plan,
    stats: {
      newComponents: plan.components.filter((c) => c.action === "add").length,
      updatedComponents: plan.components.filter((c) => c.action === "update")
        .length,
      skippedComponents: plan.components.filter((c) => c.action === "skip")
        .length,
      newFlows: plan.dataFlows.filter((f) => f.action === "add").length,
      skippedFlows: plan.dataFlows.filter((f) => f.action === "skip").length,
      newBoundaries: plan.boundaries.filter((b) => b.action === "add").length,
      mergedBoundaries: plan.boundaries.filter((b) => b.action === "update")
        .length,
    },
  };
}
