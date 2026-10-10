"use client";

import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FrameworkCoverage } from "./useComplianceFrameworkCoverage";

interface FrameworkCardProps {
  coverage: FrameworkCoverage;
  onClick: () => void;
}

export function FrameworkCard({ coverage, onClick }: FrameworkCardProps) {
  const {
    framework,
    coveredControls,
    openThreats,
    coverage: coveragePercent,
  } = coverage;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
      onClick={onClick}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: framework.color
                  .replace("bg-", "#")
                  .replace("-500", ""),
              }}
            />
            <CardTitle className="text-sm">{framework.shortName}</CardTitle>
          </div>
          {openThreats === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <CardDescription className="text-xs">{framework.name}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Coverage</span>
          <span className="font-medium">{coveragePercent}%</span>
        </div>
        <Progress value={coveragePercent} className="h-1.5" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{coveredControls.length} controls mapped</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1 hover:text-foreground">
                  <Info className="h-3 w-3" />
                  View
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="font-medium mb-1">Mapped Controls:</p>
                <p className="text-xs">
                  {coveredControls.slice(0, 10).join(", ")}
                  {coveredControls.length > 10 &&
                    ` +${coveredControls.length - 10} more`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
