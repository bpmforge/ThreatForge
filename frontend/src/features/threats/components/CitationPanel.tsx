"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCitations } from "../hooks/useCitations";
import { CitationOverrideDialog } from "./CitationOverrideDialog";
import type { Citation, VerificationStatus } from "../types";

interface Props {
  modelId: string;
  threatId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const STATUS_ICON: Record<VerificationStatus, string> = {
  VERIFIED: "✓",
  UNVERIFIED: "⚠",
  PHANTOM: "✗",
  PENDING: "…",
  EXEMPT: "—",
};

function citationLabel(c: Citation): string {
  if (c.citationType === "DOCUMENT") {
    if (c.section?.anchor) return `§${c.section.anchor}`;
    if (c.documentId) return `Doc: ${c.documentId}`;
    return "Document citation";
  }
  if (c.citationType === "REFERENCE") {
    return `${c.referenceKind ?? "Ref"}-${c.referenceId ?? "?"}`;
  }
  if (c.citationType === "COMPONENT") {
    return `Component: ${c.componentNodeId ?? "?"}`;
  }
  if (c.citationType === "REQUIREMENT") {
    return `Req: ${c.requirementId ?? "?"}`;
  }
  return "Citation";
}

export function CitationPanel({
  modelId,
  threatId,
  open,
  onOpenChange,
}: Props) {
  const { citations, isLoading, override } = useCitations(
    modelId,
    "threat",
    threatId,
    open,
  );
  const [overridingId, setOverridingId] = useState<string | null>(null);

  const overridingCitation = citations.find((c) => c.id === overridingId);

  function handleOverrideConfirm(
    status: VerificationStatus,
    rationale: string,
  ) {
    if (!overridingId) return;
    override.mutate(
      { citationId: overridingId, status, rationale },
      {
        onSuccess: () => {
          toast.success("Citation override saved.");
          setOverridingId(null);
        },
        onError: () => toast.error("Failed to save override."),
      },
    );
  }

  if (!open) return null;

  return (
    <div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-muted-foreground">Citations</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-xs"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </div>
      <Separator className="mb-2" />

      {isLoading && (
        <p className="text-muted-foreground text-xs">Loading citations…</p>
      )}
      {!isLoading && citations.length === 0 && (
        <p className="text-muted-foreground text-xs">
          No citations found for this threat.
        </p>
      )}

      {citations.length > 0 && (
        <ScrollArea className="max-h-64">
          <ul className="space-y-3" role="list">
            {citations.map((c) => {
              const label = citationLabel(c);
              const canOverride =
                c.verificationStatus === "UNVERIFIED" ||
                c.verificationStatus === "PHANTOM";
              return (
                <li key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-muted-foreground"
                      >
                        {STATUS_ICON[c.verificationStatus]}
                      </span>
                      <span className="truncate font-medium">{label}</span>
                      {c.verifierConfidence != null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {Math.round(c.verifierConfidence * 100)}%
                        </span>
                      )}
                    </div>
                    {canOverride && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 shrink-0 px-2 text-xs"
                        aria-label={`Override citation: ${label}`}
                        onClick={() => setOverridingId(c.id)}
                      >
                        Override
                      </Button>
                    )}
                  </div>
                  {c.excerpt && (
                    <blockquote className="ml-5 border-l-2 pl-2 text-xs text-muted-foreground italic">
                      {c.excerpt.length > 200
                        ? `${c.excerpt.slice(0, 200)}…`
                        : c.excerpt}
                    </blockquote>
                  )}
                  {c.overriddenAt && (
                    <p className="ml-5 text-xs text-muted-foreground">
                      Overridden by reviewer
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {overridingCitation && (
        <CitationOverrideDialog
          open={!!overridingId}
          onOpenChange={(o) => {
            if (!o) setOverridingId(null);
          }}
          citationId={overridingCitation.id}
          currentStatus={overridingCitation.verificationStatus}
          citationLabel={citationLabel(overridingCitation)}
          onConfirm={handleOverrideConfirm}
          isPending={override.isPending}
        />
      )}
    </div>
  );
}
