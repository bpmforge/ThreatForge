"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateMitigationsListProps {
  mitigations: string[];
  newMitigation: string;
  onNewMitigationChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function TemplateMitigationsList({
  mitigations,
  newMitigation,
  onNewMitigationChange,
  onAdd,
  onRemove,
}: TemplateMitigationsListProps) {
  return (
    <div className="space-y-2">
      <Label>Suggested Mitigations</Label>
      <div className="flex gap-2">
        <Input
          value={newMitigation}
          onChange={(e) => onNewMitigationChange(e.target.value)}
          placeholder="Add mitigation..."
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          Add
        </Button>
      </div>
      {mitigations.length > 0 && (
        <ul className="space-y-1 mt-2">
          {mitigations.map((m, i) => (
            <li
              key={i}
              className="text-xs flex items-center justify-between bg-muted px-2 py-1.5 rounded"
            >
              <span className="truncate flex-1">{m}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 shrink-0"
                onClick={() => onRemove(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
