"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";

interface AcceptanceCriteriaSectionProps {
  criteria: string[];
  newCriterion: string;
  onNewCriterionChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function AcceptanceCriteriaSection({
  criteria,
  newCriterion,
  onNewCriterionChange,
  onAdd,
  onRemove,
}: AcceptanceCriteriaSectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Acceptance Criteria
      </h4>
      {criteria.length > 0 && (
        <div className="space-y-2">
          {criteria.map((criterion, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-2 bg-muted/50 rounded"
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
              <span className="flex-1 text-sm">{criterion}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={newCriterion}
          onChange={(e) => onNewCriterionChange(e.target.value)}
          placeholder="Add acceptance criterion..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
