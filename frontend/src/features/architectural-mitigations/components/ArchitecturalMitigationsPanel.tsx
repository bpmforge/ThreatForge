"use client";

/**
 * ArchitecturalMitigationsPanel
 *
 * Reviews AI-proposed architecture changes (WAF, trust boundary, encrypted
 * connection, component split) that address clusters of threats. Same review
 * loop as threats/chains: Accept / Reject / Edit (an edit becomes MODIFIED and
 * is human-owned — AI re-analysis never overwrites it).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Check, Pencil, Play, X } from "lucide-react";
import { JobProgressCard } from "@/features/ai-jobs";
import {
  useArchitecturalMitigationAnalysis,
  useArchitecturalMitigations,
  useUpdateArchitecturalMitigation,
} from "../hooks/useArchitecturalMitigations";
import {
  KIND_LABELS,
  STATUS_BADGE_CLASSES,
  type ArchitecturalMitigation,
} from "../types";

function MitigationCard({
  item,
  onAccept,
  onReject,
  onSaveEdit,
}: {
  item: ArchitecturalMitigation;
  onAccept: () => void;
  onReject: () => void;
  onSaveEdit: (proposedChange: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.proposedChange);

  return (
    <div className="rounded-md border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            {KIND_LABELS[item.kind] ?? item.kind}
          </div>
          <div className="text-sm font-medium">{item.title}</div>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${STATUS_BADGE_CLASSES[item.status] ?? ""}`}
        >
          {item.status.replace("_", " ")}
        </Badge>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Proposed change"
            rows={4}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!draft.trim()}
              onClick={() => {
                onSaveEdit(draft.trim());
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(item.proposedChange);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm">{item.proposedChange}</p>
      )}

      {item.rationale && (
        <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Addresses {item.threatIds.length} threat
        {item.threatIds.length === 1 ? "" : "s"} ·{" "}
        {item.affectedComponentIds.length} component
        {item.affectedComponentIds.length === 1 ? "" : "s"} ·{" "}
        {item.affectedConnectionIds.length} connection
        {item.affectedConnectionIds.length === 1 ? "" : "s"}
      </p>

      {!editing && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onAccept}
            disabled={item.status === "ACCEPTED"}
            aria-label={`Accept ${item.title}`}
          >
            <Check className="mr-1 h-3 w-3" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            aria-label={`Modify ${item.title}`}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Modify
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={item.status === "REJECTED"}
            aria-label={`Reject ${item.title}`}
          >
            <X className="mr-1 h-3 w-3" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export function ArchitecturalMitigationsPanel({
  modelId,
}: {
  modelId: string;
}) {
  const { data: items, isLoading } = useArchitecturalMitigations(modelId);
  const update = useUpdateArchitecturalMitigation(modelId);
  const { analyze, jobId, isStarting, onJobComplete, dismissJob } =
    useArchitecturalMitigationAnalysis(modelId);

  return (
    <div className="flex flex-col border-t">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            Architectural Mitigations
          </span>
          {items && items.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {items.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void analyze()}
          disabled={isStarting || !!jobId}
          aria-label="Suggest architectural mitigations"
        >
          <Play className="mr-1 h-3 w-3" />
          Suggest
        </Button>
      </div>

      {jobId && (
        <div className="border-b p-2">
          <JobProgressCard
            jobId={jobId}
            type="ARCHITECTURAL_MITIGATIONS"
            onComplete={onJobComplete}
            onDismiss={dismissJob}
          />
        </div>
      )}

      <div className="space-y-2 p-2">
        {isLoading && (
          <p className="px-2 py-4 text-sm text-muted-foreground" aria-busy>
            Loading...
          </p>
        )}
        {!isLoading && (!items || items.length === 0) && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No architectural proposals yet. Run threat analysis first, then
            click Suggest.
          </p>
        )}
        {items?.map((item) => (
          <MitigationCard
            key={item.id}
            item={item}
            onAccept={() =>
              update.mutate({ id: item.id, patch: { status: "ACCEPTED" } })
            }
            onReject={() =>
              update.mutate({ id: item.id, patch: { status: "REJECTED" } })
            }
            onSaveEdit={(proposedChange) =>
              update.mutate({ id: item.id, patch: { proposedChange } })
            }
          />
        ))}
      </div>
    </div>
  );
}
