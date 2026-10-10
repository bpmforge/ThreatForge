"use client";

import React from "react";
import { AlertTriangle, Shield, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImprovementSuggestion } from "../types";

interface ImprovementSuggestionsProps {
  suggestions: ImprovementSuggestion[];
  onSuggestionClick?: (suggestion: ImprovementSuggestion) => void;
  maxItems?: number;
}

export function ImprovementSuggestions({
  suggestions,
  onSuggestionClick,
  maxItems = 5,
}: ImprovementSuggestionsProps): React.ReactElement {
  const displayedSuggestions = suggestions.slice(0, maxItems);

  const getIcon = (type: ImprovementSuggestion["type"]) => {
    switch (type) {
      case "missing_stride":
        return <AlertTriangle className="h-4 w-4" />;
      case "no_mitigation":
        return <Shield className="h-4 w-4" />;
      case "uncovered_component":
        return <HelpCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getPriorityClass = (priority: ImprovementSuggestion["priority"]) => {
    switch (priority) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-blue-500";
      default:
        return "";
    }
  };

  const getIconColor = (priority: ImprovementSuggestion["priority"]) => {
    switch (priority) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-blue-500";
      default:
        return "text-muted-foreground";
    }
  };

  if (displayedSuggestions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No improvement suggestions - great job!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayedSuggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className={`flex items-start p-3 rounded-lg border ${
            onSuggestionClick ? "cursor-pointer hover:bg-muted" : ""
          }`}
          onClick={() => onSuggestionClick?.(suggestion)}
          role={onSuggestionClick ? "button" : undefined}
          tabIndex={onSuggestionClick ? 0 : undefined}
          onKeyDown={(e) => {
            if (onSuggestionClick && (e.key === "Enter" || e.key === " ")) {
              onSuggestionClick(suggestion);
            }
          }}
        >
          <div
            className={`flex-shrink-0 mt-0.5 ${getIconColor(suggestion.priority)}`}
          >
            {getIcon(suggestion.type)}
          </div>
          <div className="ml-3 flex-1">
            <p
              className={`text-sm font-medium ${getPriorityClass(suggestion.priority)}`}
            >
              {suggestion.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {suggestion.details}
            </p>
            {onSuggestionClick && (
              <Button
                variant="link"
                size="sm"
                className="mt-1 p-0 h-auto text-xs"
              >
                View details
              </Button>
            )}
          </div>
        </div>
      ))}
      {suggestions.length > maxItems && (
        <p className="text-xs text-muted-foreground text-center">
          +{suggestions.length - maxItems} more suggestions
        </p>
      )}
    </div>
  );
}
