"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LibraryThreatCard } from "./LibraryThreatCard";
import type { LibraryThreat } from "@/features/threat-library";

interface SourceGroupProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  threats: LibraryThreat[];
  onSelect: (threat: LibraryThreat) => void;
}

export function SourceGroup({
  icon,
  label,
  description,
  color,
  threats,
  onSelect,
}: SourceGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color} text-white`}>{icon}</div>
              <div className="flex-1">
                <CardTitle className="text-base">{label}</CardTitle>
                <CardDescription className="text-xs">
                  {description}
                </CardDescription>
              </div>
              <Badge variant="secondary">{threats.length}</Badge>
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="h-[250px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {threats.map((threat) => (
                  <LibraryThreatCard
                    key={threat.id}
                    threat={threat}
                    onSelect={onSelect}
                    compact
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
