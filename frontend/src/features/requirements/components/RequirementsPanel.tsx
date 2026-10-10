"use client";

/**
 * RequirementsPanel — Lists all requirements for a threat model,
 * shows traceability coverage, and provides import/add actions.
 */
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers } from "lucide-react";
import {
  useRequirements,
  useDeleteRequirement,
  useUpdateRequirement,
} from "../hooks/useRequirements";
import { AddRequirementDialog } from "./AddRequirementDialog";
import { CsvImportDialog } from "./CsvImportDialog";
import { FrameworkImportDialog } from "./FrameworkImportDialog";
import { RequirementRow } from "./RequirementRow";
import { RequirementsPanelHeader } from "./RequirementsPanelHeader";
import { FileText } from "lucide-react";

interface RequirementsPanelProps {
  modelId: string;
}

export function RequirementsPanel({ modelId }: RequirementsPanelProps) {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [showFramework, setShowFramework] = useState(false);

  const { data: requirements = [], isLoading } = useRequirements(
    modelId,
    sourceFilter !== "all" ? { source: sourceFilter } : undefined,
  );
  const deleteReq = useDeleteRequirement(modelId);
  const updateReq = useUpdateRequirement(modelId);

  const pendingCount = requirements.filter(
    (r) => r.source === "AI_SUGGESTED" && r.reviewStatus === "PENDING",
  ).length;

  const filtered = search.trim()
    ? requirements.filter(
        (r) =>
          r.reqId.toLowerCase().includes(search.toLowerCase()) ||
          r.text.toLowerCase().includes(search.toLowerCase()),
      )
    : requirements;

  const covered = requirements.filter((r) => r._count.mitigations > 0).length;
  const coveragePct =
    requirements.length > 0
      ? Math.round((covered / requirements.length) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full">
      <RequirementsPanelHeader
        totalCount={requirements.length}
        covered={covered}
        coveragePct={coveragePct}
        pendingCount={pendingCount}
        sourceFilter={sourceFilter}
        search={search}
        onSourceFilterChange={setSourceFilter}
        onSearchChange={setSearch}
        onAddManual={() => setShowAdd(true)}
        onAddCsv={() => setShowCsv(true)}
        onAddFramework={() => setShowFramework(true)}
      />

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading...</div>
        ) : requirements.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              No requirements yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Import from CSV, a compliance framework, or add manually.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((req) => (
              <RequirementRow
                key={req.id}
                req={req}
                onAccept={(id) =>
                  updateReq.mutate({ id, input: { reviewStatus: "ACCEPTED" } })
                }
                onReject={(id) =>
                  updateReq.mutate({ id, input: { reviewStatus: "REJECTED" } })
                }
                onDelete={(id) => deleteReq.mutate(id)}
                isUpdatePending={updateReq.isPending}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {requirements.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Layers className="h-3 w-3" />
          <span>
            {requirements.length} req{requirements.length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span
            className={coveragePct < 50 ? "text-red-500" : "text-emerald-600"}
          >
            {coveragePct}% covered
          </span>
        </div>
      )}

      <AddRequirementDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        modelId={modelId}
      />
      <CsvImportDialog
        open={showCsv}
        onOpenChange={setShowCsv}
        modelId={modelId}
      />
      <FrameworkImportDialog
        open={showFramework}
        onOpenChange={setShowFramework}
        modelId={modelId}
      />
    </div>
  );
}
