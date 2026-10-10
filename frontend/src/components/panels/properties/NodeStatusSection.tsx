"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeStatus } from "@/components/canvas/NodeStatusChip";

interface NodeStatusSectionProps {
  nodeId: string;
  status?: NodeStatus | null;
  onUpdate: (status: NodeStatus | null) => void;
}

const statusOptions: { value: NodeStatus | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "draft", label: "Draft" },
  { value: "in-review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "deprecated", label: "Deprecated" },
];

export function NodeStatusSection({
  status,
  onUpdate,
}: NodeStatusSectionProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="node-status" className="text-xs">
        Status
      </Label>
      <Select
        value={status ?? "none"}
        onValueChange={(v) => onUpdate(v === "none" ? null : (v as NodeStatus))}
      >
        <SelectTrigger id="node-status" className="h-8 text-xs">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
