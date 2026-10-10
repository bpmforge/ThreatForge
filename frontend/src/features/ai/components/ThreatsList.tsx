"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AISuggestedThreat } from "../types";
import { ThreatCard } from "./ThreatCard";

interface ThreatsListProps {
  threats: AISuggestedThreat[];
  loading: boolean;
  onAddThreat: (threat: AISuggestedThreat) => void;
  onClear: () => void;
}

export function ThreatsList({
  threats,
  loading,
  onAddThreat,
  onClear,
}: ThreatsListProps) {
  return (
    <>
      <ScrollArea className="flex-1 min-h-0">
        {threats.length === 0 && !loading && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Click &quot;Analyze&quot; to get AI-powered threat suggestions based
            on your model.
          </div>
        )}

        <div className="p-2 space-y-2">
          {threats.map((threat, idx) => (
            <ThreatCard key={idx} threat={threat} onAdd={onAddThreat} />
          ))}
        </div>
      </ScrollArea>

      {threats.length > 0 && (
        <div className="p-3 border-t shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="w-full"
          >
            Clear Suggestions
          </Button>
        </div>
      )}
    </>
  );
}
