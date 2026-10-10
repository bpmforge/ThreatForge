"use client";

import { Label } from "@/components/ui/label";

interface Requirement {
  id: string;
  reqId: string;
  text: string;
  category: string | null;
  docId: string | null;
}

interface RequirementLinksSectionProps {
  dbRequirements: Requirement[];
  selectedIds: Set<string>;
  aiCitedReqIds: Set<string>;
  onToggle: (id: string) => void;
}

export function RequirementLinksSection({
  dbRequirements,
  selectedIds,
  aiCitedReqIds,
  onToggle,
}: RequirementLinksSectionProps) {
  if (dbRequirements.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>Link Requirements</Label>
      <p className="text-xs text-muted-foreground">
        Select requirements this mitigation satisfies.
        {aiCitedReqIds.size > 0 && (
          <span className="ml-1 text-amber-600">
            AI highlighted {aiCitedReqIds.size} suggestion
            {aiCitedReqIds.size > 1 ? "s" : ""}.
          </span>
        )}
      </p>
      <div className="space-y-1 max-h-36 overflow-y-auto">
        {dbRequirements.map((req) => {
          const selected = selectedIds.has(req.id);
          const aiSuggested = aiCitedReqIds.has(req.reqId);
          return (
            <button
              key={req.id}
              onClick={() => onToggle(req.id)}
              className={`w-full text-left p-2 rounded border text-xs transition-colors ${
                selected
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : aiSuggested
                    ? "bg-amber-50 border-amber-300 text-foreground hover:bg-amber-100"
                    : "bg-background border-border text-foreground hover:bg-muted"
              }`}
            >
              <span className="font-medium">
                {req.docId ? `[${req.docId}] ` : ""}
                {req.reqId}
              </span>{" "}
              — {req.text}
              {aiSuggested && !selected && (
                <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
