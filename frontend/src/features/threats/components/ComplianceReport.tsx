"use client";

import { useState } from "react";
import { ComplianceDetailDialog } from "./ComplianceDetailDialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shield } from "lucide-react";
import { useThreats } from "../hooks/useThreats";
import { COMPLIANCE_FRAMEWORKS } from "@/features/threat-library/constants";
import type { FrameworkInfo } from "@/features/threat-library/constants";
import { useComplianceFrameworkCoverage } from "./useComplianceFrameworkCoverage";
import { FrameworkCard } from "./FrameworkCard";

interface ComplianceReportProps {
  modelId: string;
}

export function ComplianceReport({ modelId }: ComplianceReportProps) {
  const { data } = useThreats(modelId);
  const threats = Array.isArray(data) ? data : [];
  const [selectedFramework, setSelectedFramework] =
    useState<FrameworkInfo | null>(null);

  const frameworkCoverage = useComplianceFrameworkCoverage(threats);

  const totalThreats = threats.length;
  const openThreats = threats.filter(
    (t) => t.status === "OPEN" || t.status === "IDENTIFIED",
  ).length;
  const mitigatedThreats = totalThreats - openThreats;

  if (threats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          No threats identified yet. Add threats to see compliance coverage.
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-3 space-y-3">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Compliance Overview
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-lg p-2">
                <div className="text-lg font-bold">{totalThreats}</div>
                <div className="text-xs text-muted-foreground">
                  Total Threats
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-2">
                <div className="text-lg font-bold text-amber-600">
                  {openThreats}
                </div>
                <div className="text-xs text-muted-foreground">Open</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2">
                <div className="text-lg font-bold text-green-600">
                  {mitigatedThreats}
                </div>
                <div className="text-xs text-muted-foreground">Mitigated</div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Framework Coverage
            </h4>
            {frameworkCoverage.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No compliance mappings found. Threats will be mapped to
                frameworks based on their STRIDE categories.
              </p>
            ) : (
              <div className="space-y-3">
                {frameworkCoverage.map((fc) => (
                  <FrameworkCard
                    key={fc.framework.id}
                    coverage={fc}
                    onClick={() => setSelectedFramework(fc.framework)}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Supported Frameworks
            </h4>
            <div className="flex flex-wrap gap-1">
              {COMPLIANCE_FRAMEWORKS.map((fw) => (
                <TooltipProvider key={fw.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-xs cursor-help"
                        style={{ borderColor: fw.color.replace("bg-", "") }}
                      >
                        {fw.shortName}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-medium">{fw.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fw.description}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {selectedFramework && (
        <ComplianceDetailDialog
          open={!!selectedFramework}
          onOpenChange={(open) => !open && setSelectedFramework(null)}
          framework={selectedFramework}
          threats={threats}
        />
      )}
    </>
  );
}
