"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import type { AttackPath } from "../types";
import { AttackPathNode } from "./AttackPathNode";
import { AttackPathEdge } from "./AttackPathEdge";
import { cn } from "@/lib/utils";
import "@xyflow/react/dist/style.css";

interface AttackPathCanvasProps {
  path: AttackPath;
  onStepClick?: (nodeId: string) => void;
  className?: string;
}

const nodeTypes: NodeTypes = { attackPathNode: AttackPathNode };
const edgeTypes: EdgeTypes = { attackPathEdge: AttackPathEdge };

export function AttackPathCanvas({
  path,
  onStepClick,
  className,
}: AttackPathCanvasProps) {
  const nodes = useMemo<Node[]>(() => {
    return path.steps.map((step, index) => ({
      id: step.id,
      type: "attackPathNode",
      position: { x: index * 200, y: 100 },
      data: {
        step,
        stepNumber: index + 1,
        isFirst: index === 0,
        isLast: index === path.steps.length - 1,
      },
    }));
  }, [path.steps]);

  const edges = useMemo<Edge[]>(() => {
    return path.steps.slice(0, -1).map((_, index) => ({
      id: `edge-${index}`,
      source: path.steps[index].id,
      target: path.steps[index + 1].id,
      type: "attackPathEdge",
      data: { likelihood: path.likelihood },
    }));
  }, [path.steps, path.likelihood]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onStepClick?.(node.id),
    [onStepClick],
  );

  return (
    <div className={cn("w-full h-64", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#6b7280" gap={16} />
        <Controls className="bg-background/80 backdrop-blur-sm" />
      </ReactFlow>
    </div>
  );
}
