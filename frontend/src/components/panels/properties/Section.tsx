"use client";

/**
 * Section - Collapsible section component for properties panel.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
  action,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border-b border-border w-full"
    >
      <div className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 transition-colors w-full">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground flex-1 w-full">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <span className="flex-1">{title}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 -rotate-90",
              isOpen && "rotate-0",
            )}
          />
        </CollapsibleTrigger>
        {action && <div className="ml-1 shrink-0">{action}</div>}
      </div>
      <CollapsibleContent className="w-full">
        <div className="px-3 pb-3 space-y-3 w-full">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
