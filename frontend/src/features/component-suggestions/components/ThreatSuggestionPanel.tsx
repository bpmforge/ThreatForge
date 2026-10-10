"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "@/types/canvas";
import { useComponentSuggestions } from "../hooks/useComponentSuggestions";
import { STRIDE_CATEGORIES } from "@/features/threats/constants";
import type { ThreatSuggestion } from "../types";

interface ThreatSuggestionPanelProps {
  componentType: ComponentType;
  componentLabel: string;
  existingThreatIds?: string[];
  onAddThreat?: (suggestion: ThreatSuggestion) => void;
  onDismiss?: () => void;
  className?: string;
}

export function ThreatSuggestionPanel({
  componentType,
  componentLabel,
  existingThreatIds = [],
  onAddThreat,
  onDismiss,
  className,
}: ThreatSuggestionPanelProps): React.ReactElement {
  const { suggestions, groupedByStride, dismiss } = useComponentSuggestions(
    componentType,
    existingThreatIds,
  );

  if (suggestions.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="py-8 text-center text-muted-foreground">
          No suggestions available for this component type
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">
          {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}{" "}
          for {componentLabel}
        </CardTitle>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
            aria-label="Dismiss suggestions"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {groupedByStride.map(
            ({ category, suggestions: categorySuggestions }) => {
              const strideInfo = STRIDE_CATEGORIES.find(
                (s) => s.value === category,
              );
              return (
                <Collapsible key={category} defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {strideInfo?.short || category.charAt(0)}
                      </Badge>
                      <span className="font-medium">
                        {strideInfo?.label || category}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        ({categorySuggestions.length})
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 pl-2">
                    {categorySuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {suggestion.name}
                            </span>
                            <Badge
                              variant={
                                suggestion.severity === "CRITICAL"
                                  ? "destructive"
                                  : suggestion.severity === "HIGH"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {suggestion.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.description}
                          </p>
                          {suggestion.mitigation && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              Mitigation: {suggestion.mitigation}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismiss(suggestion.id)}
                            className="h-7 w-7 p-0"
                            aria-label="Dismiss suggestion"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          {onAddThreat && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => onAddThreat(suggestion)}
                              className="h-7 w-7 p-0"
                              aria-label="Add threat"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            },
          )}
        </div>
      </CardContent>
    </Card>
  );
}
