"use client";

import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import type { Requirement } from "../types";

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  DOCUMENT: "Document",
  CSV: "CSV",
  FRAMEWORK: "Framework",
  AI_SUGGESTED: "AI Suggested",
};

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  DOCUMENT: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CSV: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  FRAMEWORK:
    "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  AI_SUGGESTED:
    "bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
};

function CoverageBadge({ req }: { req: Requirement }) {
  const count = req._count.mitigations;
  return count > 0 ? (
    <Badge
      variant="secondary"
      className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    >
      {count} mit.
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="text-[10px] h-4 px-1.5 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
    >
      uncovered
    </Badge>
  );
}

interface RequirementRowProps {
  req: Requirement;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  isUpdatePending: boolean;
}

export function RequirementRow({
  req,
  onAccept,
  onReject,
  onDelete,
  isUpdatePending,
}: RequirementRowProps) {
  const isPending =
    req.source === "AI_SUGGESTED" && req.reviewStatus === "PENDING";

  return (
    <div
      className={`px-3 py-2.5 hover:bg-muted/30 group ${isPending ? "bg-yellow-50/30 dark:bg-yellow-950/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-xs font-medium text-foreground truncate"
              title={req.reqId}
            >
              {req.reqId}
            </span>
            {req.version > 1 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 shrink-0 border-blue-400 text-blue-600"
                title={`Version ${req.version} — prior versions kept for traceability`}
              >
                v{req.version}
              </Badge>
            )}
            {req.docId && (
              <span className="text-[10px] text-muted-foreground truncate">
                [{req.docId}]
              </span>
            )}
          </div>
          <p
            className="text-xs text-muted-foreground line-clamp-2 mb-1.5"
            title={req.text}
          >
            {req.text}
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_COLORS[req.source] ?? "bg-muted text-muted-foreground"}`}
            >
              {SOURCE_LABELS[req.source] ?? req.source}
            </span>
            {isPending && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 border-yellow-400 text-yellow-800 dark:text-yellow-200"
              >
                Pending review
              </Badge>
            )}
            {req.reviewStatus === "REJECTED" && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 border-red-400 text-red-700 line-through dark:text-red-300"
              >
                Rejected
              </Badge>
            )}
            {req.category && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {req.category}
              </Badge>
            )}
            <CoverageBadge req={req} />
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
          {isPending && (
            <>
              <button
                onClick={() => onAccept(req.id)}
                disabled={isUpdatePending}
                className="p-1 rounded text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950 disabled:opacity-40"
                aria-label={`Accept requirement ${req.reqId}`}
                title="Accept"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onReject(req.id)}
                disabled={isUpdatePending}
                className="p-1 rounded text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-40"
                aria-label={`Reject requirement ${req.reqId}`}
                title="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(req.id)}
            className="opacity-40 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity text-xs p-1"
            aria-label={`Delete requirement ${req.reqId}`}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
