"use client";

import { Share2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Mitigation } from "../types";

interface MitigationBadgesProps {
  mitigation: Mitigation;
}

export function MitigationBadges({ mitigation }: MitigationBadgesProps) {
  return (
    <div className="flex items-center gap-1.5 mb-0.5">
      {mitigation.inheritedFromModel && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                <Share2 className="h-2.5 w-2.5" />
                Inherited
              </span>
            </TooltipTrigger>
            <TooltipContent>
              From: {mitigation.inheritedFromModel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {mitigation.isSharedControl && !mitigation.inheritedFromModel && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-100 text-teal-700">
          <Share2 className="h-2.5 w-2.5" />
          Shared
        </span>
      )}
      {mitigation.controlCategory && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
          {mitigation.controlCategory}
        </span>
      )}
      {mitigation.testResult && (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            mitigation.testResult === "PASS"
              ? "bg-green-100 text-green-700"
              : mitigation.testResult === "FAIL"
                ? "bg-red-100 text-red-700"
                : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {mitigation.testResult}
        </span>
      )}
      {mitigation.obligation === "REQUIRED" && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
          Required
        </span>
      )}
      {mitigation.status === "IMPLEMENTED" && mitigation.verified && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
          Verified
        </span>
      )}
    </div>
  );
}
