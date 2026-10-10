"use client";

import { useState } from "react";
import type { AttackSurfaceComponent } from "../types";
import { ComponentCard } from "./ComponentCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface AttackSurfaceListProps {
  components: AttackSurfaceComponent[];
  onSelectComponent?: (id: string) => void;
}

export function AttackSurfaceList({
  components,
  onSelectComponent,
}: AttackSurfaceListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredComponents = components
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.type.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[400px]">
        {filteredComponents.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery
              ? "No components match your search"
              : "No components found"}
          </div>
        ) : (
          <div className="space-y-2 pr-3">
            {filteredComponents.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                onClick={onSelectComponent}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
