"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  HelpCircle,
  Lightbulb,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentType } from "@/types/canvas";
import { getStrideHelpForCategory } from "../data/stride-help-content";

interface StrideContextualHelpProps {
  category: string;
  componentType?: ComponentType;
  onAddThreat?: (title: string, description: string, category: string) => void;
  className?: string;
}

export function StrideContextualHelp({
  category,
  componentType,
  onAddThreat,
  className,
}: StrideContextualHelpProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const helpContent = getStrideHelpForCategory(category);
  if (!helpContent) return null;

  const componentHelp = componentType
    ? helpContent.componentSpecificHelp[componentType]
    : null;

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Expandable header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <HelpCircle className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium">What is {helpContent.name}?</span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Definition */}
          <div>
            <p className="text-sm text-muted-foreground">
              {helpContent.definition}
            </p>
          </div>

          {/* Component-specific help */}
          {componentHelp && (
            <div className="p-2 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-800 mb-1">
                    For {componentType?.replace(/_/g, " ").toLowerCase()}:
                  </p>
                  <p className="text-xs text-blue-700">{componentHelp}</p>
                </div>
              </div>
            </div>
          )}

          {/* Example attacks */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Example Attacks
            </p>
            <ul className="space-y-1">
              {helpContent.exampleAttacks.slice(0, 3).map((attack, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground flex items-start gap-1.5"
                >
                  <span className="text-muted-foreground/50">•</span>
                  <span>{attack}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Questions to ask */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Questions to Consider
            </p>
            <ul className="space-y-1">
              {helpContent.questionsToAsk.slice(0, 3).map((question, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground flex items-start gap-1.5"
                >
                  <span className="text-muted-foreground/50">?</span>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick add common threat */}
          {onAddThreat && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={() =>
                  onAddThreat(
                    `${helpContent.name} Threat`,
                    `Potential ${helpContent.name.toLowerCase()} vulnerability affecting this component.`,
                    category,
                  )
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                Add {helpContent.name} Threat
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
