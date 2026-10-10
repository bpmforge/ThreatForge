"use client";

import { severityDot } from "@/lib/severity";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { AttackStep } from "../types";
import { cn } from "@/lib/utils";

interface AttackStepNodeData extends Record<string, unknown> {
  step: AttackStep;
  stepNumber: number;
  isFirst?: boolean;
  isLast?: boolean;
}

type AttackPathNodeType = Node<AttackStepNodeData, "attackPathNode">;

export function AttackPathNode({ data }: NodeProps<AttackPathNodeType>) {
  const { step, stepNumber, isFirst, isLast } = data;
  const bg = severityDot(step.severity) || "bg-muted";

  return (
    <div
      className={cn(
        "relative w-[150px] h-[60px] rounded border border-border",
        bg,
        "text-white text-xs font-medium",
      )}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <Handle type="source" position={Position.Right} className="w-2 h-2" />

      <div
        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-background
        flex items-center justify-center"
      >
        <span className="text-xs text-foreground font-bold">{stepNumber}</span>
      </div>

      <div className="ml-7 mt-1 truncate px-1">{step.threatName}</div>
      <div className="ml-7 text-[10px] truncate px-1 opacity-90">
        {step.nodeName}
      </div>

      {isFirst && (
        <div
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-3
          rounded-full bg-green-500 border border-white"
        />
      )}
      {isLast && (
        <div
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-3
          rounded-full bg-red-500 border border-white"
        />
      )}
    </div>
  );
}
