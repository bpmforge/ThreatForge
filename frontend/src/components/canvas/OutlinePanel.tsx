"use client";

/**
 * OutlinePanel - Sidebar showing all nodes and edges as a filterable tree.
 * Click any row to select it and center the viewport. Toggle with Ctrl+\.
 */
import { useState, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { Locate, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas";
import { componentConfigs, defaultConfig } from "./component-configs";

interface OutlinePanelProps {
  open: boolean;
  onClose: () => void;
}

/** Single row in the outline list. Uses CSS group-hover to show the locate icon. */
function OutlineRow({
  label,
  icon,
  onLocate,
}: {
  label: string;
  icon: React.ReactNode;
  onLocate: () => void;
}) {
  return (
    <button
      type="button"
      className="group w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-muted/60 rounded transition-colors"
      onClick={onLocate}
      aria-label={`Locate ${label}`}
    >
      {icon}
      <span className="truncate flex-1 text-foreground">{label}</span>
      <Locate
        className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />
    </button>
  );
}

export function OutlinePanel({ open, onClose }: OutlinePanelProps) {
  const [query, setQuery] = useState("");
  const { fitView } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setSelection = useCanvasStore((s) => s.setSelection);

  const q = query.trim().toLowerCase();
  const componentNodes = nodes.filter((n) => n.type === "component");
  const filteredNodes = q
    ? componentNodes.filter((n) =>
        String(n.data.label ?? "")
          .toLowerCase()
          .includes(q),
      )
    : componentNodes;
  const filteredEdges = q
    ? edges.filter((e) => {
        const src = nodes.find((n) => n.id === e.source);
        const tgt = nodes.find((n) => n.id === e.target);
        return `${String(src?.data?.label ?? "")} ${String(tgt?.data?.label ?? "")}`
          .toLowerCase()
          .includes(q);
      })
    : edges;

  const selectNode = useCallback(
    (nodeId: string) => {
      setSelection([nodeId], []);
      const node = nodes.find((n) => n.id === nodeId);
      if (node) fitView({ nodes: [node], padding: 0.3, duration: 300 });
    },
    [nodes, setSelection, fitView],
  );

  const selectEdge = useCallback(
    (edgeId: string) => setSelection([], [edgeId]),
    [setSelection],
  );

  if (!open) return null;

  return (
    <div className="absolute right-4 top-16 z-10 w-56 bg-background border border-border rounded-lg shadow-lg flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Outline
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onClose}
          aria-label="Close outline panel"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {/* Filter */}
      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter..."
          className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 px-1"
          aria-label="Filter outline"
        />
      </div>
      {/* Tree */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {filteredNodes.length > 0 && (
            <p className="px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              Nodes
            </p>
          )}
          {filteredNodes.map((node) => {
            const cfg =
              componentConfigs[
                node.data.type as keyof typeof componentConfigs
              ] ?? defaultConfig;
            return (
              <OutlineRow
                key={node.id}
                label={String(node.data.label ?? node.id)}
                icon={
                  <cfg.Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />
                }
                onLocate={() => selectNode(node.id)}
              />
            );
          })}
          {filteredEdges.length > 0 && (
            <p className="px-2 py-0.5 mt-1 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              Edges
            </p>
          )}
          {filteredEdges.map((edge) => {
            const src = nodes.find((n) => n.id === edge.source);
            const tgt = nodes.find((n) => n.id === edge.target);
            return (
              <OutlineRow
                key={edge.id}
                label={`${String(src?.data?.label ?? edge.source)} → ${String(tgt?.data?.label ?? edge.target)}`}
                icon={
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }
                onLocate={() => selectEdge(edge.id)}
              />
            );
          })}
          {filteredNodes.length === 0 && filteredEdges.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              {q ? "No matches" : "Canvas is empty"}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
