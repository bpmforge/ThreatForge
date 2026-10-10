"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FactorSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  avgScore: number;
  children: React.ReactNode;
}

export function FactorSection({
  title,
  expanded,
  onToggle,
  avgScore,
  children,
}: FactorSectionProps) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-2 py-1 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span className="text-xs font-medium">{title}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {avgScore.toFixed(1)}/9
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2 pt-1 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
