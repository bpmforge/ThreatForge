/**
 * Version history panel component
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, RotateCcw, Eye, GitCompare } from "lucide-react";
import {
  useVersionHistory,
  useRestoreVersion,
} from "../hooks/useVersionHistory";
import { CreateVersionDialog } from "./CreateVersionDialog";
import { EditVersionDialog } from "./EditVersionDialog";
import { VersionCompareDialog } from "./VersionCompareDialog";
import { formatRelativeTime, type ThreatModelVersion } from "../types";

interface Props {
  modelId: string | null;
  onPreview?: (versionId: string) => void;
  onRestore?: () => void;
}

export function VersionHistoryPanel({ modelId, onPreview, onRestore }: Props) {
  const [restoreVersion, setRestoreVersion] =
    useState<ThreatModelVersion | null>(null);
  const [editVersion, setEditVersion] = useState<ThreatModelVersion | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareBaseId, setCompareBaseId] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const { data: versions, isLoading, error } = useVersionHistory(modelId);
  const restoreMutation = useRestoreVersion(modelId || "");

  if (!modelId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Save your model to enable version history.
      </div>
    );
  }

  function handleRestore() {
    if (!restoreVersion) return;
    restoreMutation.mutate(restoreVersion.id, {
      onSuccess: () => {
        setRestoreVersion(null);
        onRestore?.();
      },
    });
  }

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading history...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">Failed to load version history</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Button
          onClick={() => setShowCreateDialog(true)}
          size="sm"
          className="w-full"
        >
          Create Snapshot
        </Button>
        {versions && versions.length >= 2 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              // Pre-select latest two versions for comparison
              setCompareBaseId(versions[1]?.id || null);
              setCompareTargetId(versions[0]?.id || null);
              setShowCompareDialog(true);
            }}
          >
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Versions
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {!versions || versions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No versions yet. Create a snapshot to start tracking history.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className="p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {version.name || `Version ${version.version}`}
                      {index === 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (current)
                        </span>
                      )}
                    </p>
                    <p
                      className="text-xs text-muted-foreground"
                      suppressHydrationWarning
                    >
                      {formatRelativeTime(version.createdAt)}
                      {version.createdBy && ` by ${version.createdBy.name}`}
                    </p>
                    {version.changesSummary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {version.changesSummary}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onPreview && (
                        <DropdownMenuItem onClick={() => onPreview(version.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setEditVersion(version)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      {index > 0 && (
                        <DropdownMenuItem
                          onClick={() => setRestoreVersion(version)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create Version Dialog */}
      <CreateVersionDialog
        modelId={modelId}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Edit Version Dialog */}
      <EditVersionDialog
        modelId={modelId}
        version={editVersion}
        open={!!editVersion}
        onOpenChange={(open) => !open && setEditVersion(null)}
      />

      {/* Restore Confirmation Dialog */}
      <AlertDialog
        open={!!restoreVersion}
        onOpenChange={() => setRestoreVersion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore your model to{" "}
              {restoreVersion?.name || `Version ${restoreVersion?.version}`}. A
              new version will be created with your current state before
              restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? "Restoring..." : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version Compare Dialog */}
      {versions && versions.length >= 2 && (
        <VersionCompareDialog
          modelId={modelId}
          versions={versions}
          baseVersionId={compareBaseId}
          compareVersionId={compareTargetId}
          open={showCompareDialog}
          onOpenChange={setShowCompareDialog}
          onBaseVersionChange={setCompareBaseId}
          onCompareVersionChange={setCompareTargetId}
        />
      )}
    </div>
  );
}
