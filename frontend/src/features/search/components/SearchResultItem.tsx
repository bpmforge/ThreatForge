"use client";

import { SearchResult } from "../types";
import { AlertTriangle, Box, Shield } from "lucide-react";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface SearchResultItemProps {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}

export function SearchResultItem({ result, onSelect }: SearchResultItemProps) {
  const getIcon = () => {
    if (result.type === "threat")
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    if (result.type === "component")
      return <Box className="h-4 w-4 text-blue-500" />;
    if (result.type === "mitigation")
      return <Shield className="h-4 w-4 text-green-500" />;
    return null;
  };

  return (
    <CommandItem
      onSelect={() => onSelect(result)}
      className="flex items-center gap-2"
      aria-label={`Select ${result.name}`}
    >
      {getIcon()}
      <div className="flex flex-col">
        <span className="font-medium">{result.name}</span>
        <span
          className={cn(
            "text-sm text-muted-foreground",
            result.componentName && "truncate",
          )}
        >
          {result.componentName || result.severity}
        </span>
      </div>
    </CommandItem>
  );
}
