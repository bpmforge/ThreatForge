"use client";

/**
 * CollapsibleSection - Collapsible category section for palette.
 */

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CollapsibleSectionProps {
  title: string;
  Icon: LucideIcon;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  matchCount?: number;
}

export function CollapsibleSection({
  title,
  Icon,
  color,
  defaultOpen = true,
  children,
  matchCount,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 hover:bg-muted/50 rounded-md transition-colors group">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Icon className={cn("h-3.5 w-3.5", color)} />
          {title}
          {matchCount !== undefined && matchCount > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {matchCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90",
            isOpen && "rotate-0",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
