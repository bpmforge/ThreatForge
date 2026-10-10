"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, RefreshCw, Link2, Box } from "lucide-react";
import type { DiffResult } from "../utils/compareVersions";
import { getNodeLabel, getEdgeLabel } from "../utils/compareVersions";

interface VersionDiffViewProps {
  isLoading: boolean;
  baseVersionId: string | null;
  compareVersionId: string | null;
  diff: DiffResult | null;
}

export function VersionDiffView({
  isLoading,
  baseVersionId,
  compareVersionId,
  diff,
}: VersionDiffViewProps) {
  return (
    <ScrollArea className="h-[380px]">
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">
          Loading versions...
        </div>
      ) : !baseVersionId || !compareVersionId ? (
        <div className="p-8 text-center text-muted-foreground">
          Select two versions to compare
        </div>
      ) : !diff ? (
        <div className="p-8 text-center text-muted-foreground">
          Could not compare versions
        </div>
      ) : diff.summary.totalChanges === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No differences found between these versions
        </div>
      ) : (
        <div className="space-y-4 p-1">
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
            <Badge variant="outline" className="gap-1">
              <Plus className="h-3 w-3 text-green-500" />
              {diff.summary.nodesAdded} added
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Minus className="h-3 w-3 text-red-500" />
              {diff.summary.nodesRemoved} removed
            </Badge>
            <Badge variant="outline" className="gap-1">
              <RefreshCw className="h-3 w-3 text-blue-500" />
              {diff.summary.nodesModified} modified
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Link2 className="h-3 w-3 text-purple-500" />
              {diff.summary.edgesAdded + diff.summary.edgesRemoved} connections
            </Badge>
          </div>

          {diff.nodesAdded.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-500" />
                Components Added
              </h4>
              <div className="space-y-1">
                {diff.nodesAdded.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded text-sm"
                  >
                    <Box className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{getNodeLabel(node)}</span>
                    {node.type && (
                      <Badge variant="outline" className="text-xs">
                        {node.type}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff.nodesRemoved.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Minus className="h-4 w-4 text-red-500" />
                Components Removed
              </h4>
              <div className="space-y-1">
                {diff.nodesRemoved.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm"
                  >
                    <Box className="h-4 w-4 text-red-600" />
                    <span className="font-medium line-through">
                      {getNodeLabel(node)}
                    </span>
                    {node.type && (
                      <Badge variant="outline" className="text-xs">
                        {node.type}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff.nodesModified.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                Components Modified
              </h4>
              <div className="space-y-1">
                {diff.nodesModified.map(({ before, after, changes }) => (
                  <div
                    key={before.id}
                    className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Box className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{getNodeLabel(after)}</span>
                    </div>
                    <ul className="ml-6 text-xs text-muted-foreground">
                      {changes.map((change, i) => (
                        <li key={i}>• {change}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff.edgesAdded.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-green-500" />
                Connections Added
              </h4>
              <div className="space-y-1">
                {diff.edgesAdded.map((edge) => (
                  <div
                    key={edge.id}
                    className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded text-sm"
                  >
                    <span>{getEdgeLabel(edge)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff.edgesRemoved.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-red-500" />
                Connections Removed
              </h4>
              <div className="space-y-1">
                {diff.edgesRemoved.map((edge) => (
                  <div
                    key={edge.id}
                    className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm line-through"
                  >
                    <span>{getEdgeLabel(edge)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );
}
