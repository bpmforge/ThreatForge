"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { HelpCircle, Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { STRIDE_CATEGORIES } from "@/features/threats/constants";
import { StrideContextualHelp } from "@/features/threat-assist";
import type { StrideCategory, ComponentType } from "@/types/canvas";
import type { ChecklistItem, ChecklistResponse } from "../types";

const STRIDE_COLORS: Record<StrideCategory, string> = {
  SPOOFING: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  TAMPERING: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  REPUDIATION: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  INFORMATION_DISCLOSURE: "bg-red-500/20 text-red-700 dark:text-red-400",
  DENIAL_OF_SERVICE: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  ELEVATION_OF_PRIVILEGE: "bg-green-500/20 text-green-700 dark:text-green-400",
};

/** Map STRIDE category from UPPER_SNAKE_CASE to camelCase for help content */
const STRIDE_HELP_CATEGORY_MAP: Record<StrideCategory, string> = {
  SPOOFING: "spoofing",
  TAMPERING: "tampering",
  REPUDIATION: "repudiation",
  INFORMATION_DISCLOSURE: "informationDisclosure",
  DENIAL_OF_SERVICE: "denialOfService",
  ELEVATION_OF_PRIVILEGE: "elevationOfPrivilege",
};

interface StrideChecklistItemProps {
  item: ChecklistItem;
  componentType?: ComponentType;
  onResponseChange: (itemId: string, response: ChecklistResponse) => void;
  onAddThreat?: (category: StrideCategory) => void;
}

export function StrideChecklistItem({
  item,
  componentType,
  onResponseChange,
  onAddThreat,
}: StrideChecklistItemProps): React.ReactElement {
  const [response, setResponse] = useState<ChecklistResponse | null>(
    item.response,
  );
  const [showHelp, setShowHelp] = useState(false);

  const handleResponseChange = (value: ChecklistResponse) => {
    setResponse(value);
    onResponseChange(item.id, value);
  };

  const strideInfo = STRIDE_CATEGORIES.find((s) => s.value === item.category);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <Badge className={STRIDE_COLORS[item.category]}>
            {strideInfo?.short || item.category.charAt(0)}
          </Badge>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{item.question}</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">{item.helpText}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <RadioGroup
          value={response || ""}
          onValueChange={(value) =>
            handleResponseChange(value as ChecklistResponse)
          }
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id={`${item.id}-yes`} />
            <Label htmlFor={`${item.id}-yes`} className="text-sm font-normal">
              Yes
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id={`${item.id}-no`} />
            <Label htmlFor={`${item.id}-no`} className="text-sm font-normal">
              No
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="na" id={`${item.id}-na`} />
            <Label htmlFor={`${item.id}-na`} className="text-sm font-normal">
              N/A
            </Label>
          </div>
        </RadioGroup>

        {response === "yes" && onAddThreat && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddThreat(item.category)}
            className="w-fit gap-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Add Threat
          </Button>
        )}

        {/* Contextual help - collapsible */}
        <Collapsible open={showHelp} onOpenChange={setShowHelp}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
            >
              {showHelp ? (
                <ChevronDown className="h-3 w-3 mr-1" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1" />
              )}
              Learn more about {strideInfo?.label || item.category}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <StrideContextualHelp
              category={STRIDE_HELP_CATEGORY_MAP[item.category]}
              componentType={componentType}
              onAddThreat={
                onAddThreat ? () => onAddThreat(item.category) : undefined
              }
            />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
}
