"use client";

/**
 * Attack Paths Analytics Page
 *
 * Fetches the selected model's canvas state + threats, then runs the
 * graph-traversal algorithm locally. An optional AI Analysis button
 * calls the attack-tree endpoint for the highest-risk path's top threat.
 */
import { getErrorMessage } from "@/lib/errors";
import { useState, useCallback } from "react";
import { AppHeader } from "@/components/layout";
import { AttackPathPanel, AttackPathCanvas } from "@/features/attack-paths";
import { useAttackPaths } from "@/features/attack-paths";
import { useThreatModels } from "@/features/dashboard";
import { apiGet, apiPost } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Route, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { CanvasNode, CanvasEdge } from "@/stores/canvas";
import type { Threat } from "@/features/threats/types";

interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

interface ModelDetail {
  id: string;
  canvasState: CanvasState;
}

interface AiAttackTree {
  goal: string;
  operator?: string;
  children?: AiAttackTree[];
  label?: string;
  difficulty?: string;
  likelihood?: string;
  mitigation?: string;
  cwe?: string;
}

export default function AttackPathsPage() {
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [aiTree, setAiTree] = useState<AiAttackTree | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiTree, setShowAiTree] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");

  const { data: models } = useThreatModels();

  // Fetch model canvas state for selected model
  const { data: modelDetail } = useQuery({
    queryKey: ["model-detail", selectedModelId],
    queryFn: () => apiGet<ModelDetail>(`/api/threat-models/${selectedModelId}`),
    enabled: !!selectedModelId,
  });

  // Fetch threats for selected model
  const { data: threats = [] } = useQuery<Threat[]>({
    queryKey: ["threats", selectedModelId],
    queryFn: async () => {
      const res = await apiGet<{ data: Threat[] }>(
        `/api/threat-models/${selectedModelId}/threats`,
      );
      return res.data;
    },
    enabled: !!selectedModelId,
  });

  const canvasNodes = modelDetail?.canvasState?.nodes ?? [];
  const canvasEdges = modelDetail?.canvasState?.edges ?? [];

  const { attackPaths: paths } = useAttackPaths({
    threats: threats.map((t) => ({
      id: t.id,
      name: t.name,
      componentNodeId: t.componentNodeId,
      category: t.category,
      severity: t.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    })),
    nodes: canvasNodes,
    edges: canvasEdges,
  });

  const handleAiAnalysis = useCallback(async () => {
    if (!selectedModelId || paths.length === 0) return;
    const topPath = paths[0];
    const topStep = topPath.steps[0];
    if (!topStep) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiPost<{ attackTree: AiAttackTree }>(
        `/api/threat-models/${selectedModelId}/ai/attack-tree`,
        {
          threatName: topStep.threatName,
          strideCategory: topStep.category,
          componentName: topStep.nodeName,
        },
      );
      setAiTree(res.attackTree);
      setShowAiTree(true);
    } catch (e) {
      setAiError(getErrorMessage(e, "AI analysis failed"));
    } finally {
      setAiLoading(false);
    }
  }, [selectedModelId, paths]);

  const selectedModel = models?.find((m) => m.id === selectedModelId);

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Attack Path Analysis
              </h1>
              <p className="text-muted-foreground text-sm">
                Visualize potential attack chains through your threat models.
              </p>
            </div>
            {paths.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAiAnalysis}
                disabled={aiLoading}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {aiLoading ? "Analyzing…" : "AI Analysis"}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a threat model" />
              </SelectTrigger>
              <SelectContent>
                {models?.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModel && (
              <span className="text-sm text-muted-foreground">
                {threats.length} threats · {canvasNodes.length} components
              </span>
            )}
          </div>

          {!selectedModelId ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Route className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                Select a threat model to analyze attack paths.
              </p>
            </div>
          ) : (
            <>
              {/* AI attack tree result */}
              {aiTree && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
                    onClick={() => setShowAiTree((v) => !v)}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      AI Attack Chain: {aiTree.goal}
                    </span>
                    {showAiTree ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {showAiTree && (
                    <div className="px-4 pb-4">
                      <AttackTreeNode node={aiTree} depth={0} />
                    </div>
                  )}
                </div>
              )}
              {aiError && <p className="text-sm text-destructive">{aiError}</p>}

              {/* List / graph view toggle */}
              {paths.length > 0 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    List
                  </Button>
                  <Button
                    variant={viewMode === "graph" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("graph")}
                  >
                    Graph
                  </Button>
                </div>
              )}

              {/* Graph-traversal paths */}
              <div className="border rounded-lg bg-card min-h-[400px]">
                {viewMode === "graph" && paths.length > 0 ? (
                  <div className="h-[500px]">
                    <AttackPathCanvas path={paths[0]} className="h-full" />
                  </div>
                ) : (
                  <AttackPathPanel paths={paths} />
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function AttackTreeNode({
  node,
  depth,
}: {
  node: AiAttackTree;
  depth: number;
}) {
  const indent = depth * 16;
  const isLeaf = !node.children?.length;
  return (
    <div style={{ marginLeft: indent }} className="mt-2">
      <div
        className={`text-sm flex items-start gap-2 ${isLeaf ? "text-muted-foreground" : "font-medium"}`}
      >
        <span className="shrink-0 mt-0.5">
          {node.operator === "AND" ? "⊕" : isLeaf ? "→" : "⊘"}
        </span>
        <div>
          <span>{node.goal ?? node.label}</span>
          {node.difficulty && (
            <span className="ml-2 text-xs text-muted-foreground">
              [{node.difficulty}]
            </span>
          )}
          {node.mitigation && (
            <p className="text-xs text-green-600 mt-0.5">✓ {node.mitigation}</p>
          )}
        </div>
      </div>
      {node.children?.map((child, i) => (
        <AttackTreeNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
