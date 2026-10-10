"use client";

import { useState } from "react";
import type { ScannerFinding, FindingStatus } from "../types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode,
  MoreVertical,
  Package,
} from "lucide-react";

interface FindingCardProps {
  finding: ScannerFinding;
  onStatusChange?: (findingId: string, status: FindingStatus) => void;
  onMapToComponent?: (findingId: string) => void;
}

export function FindingCard({
  finding,
  onStatusChange,
  onMapToComponent,
}: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500 text-white";
      case "HIGH":
        return "bg-orange-500 text-white";
      case "MEDIUM":
        return "bg-yellow-500 text-black";
      case "LOW":
        return "bg-blue-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-red-100 text-red-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "FIXED":
        return "bg-green-100 text-green-800";
      case "DISMISSED":
      case "FALSE_POSITIVE":
        return "bg-gray-100 text-gray-800";
      default:
        return "";
    }
  };

  const statusOptions: FindingStatus[] = [
    "OPEN",
    "IN_PROGRESS",
    "FIXED",
    "DISMISSED",
    "FALSE_POSITIVE",
  ];

  return (
    <Card className="overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 mt-0.5"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={cn("text-xs", getSeverityColor(finding.severity))}
                >
                  {finding.severity}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {finding.scannerType}
                </Badge>
                <Badge
                  className={cn("text-xs", getStatusColor(finding.status))}
                >
                  {finding.status.replace("_", " ")}
                </Badge>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Actions"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {statusOptions.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onStatusChange?.(finding.id, status)}
                      disabled={finding.status === status}
                    >
                      Mark as {status.replace("_", " ")}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={() => onMapToComponent?.(finding.id)}
                  >
                    Map to Component
                  </DropdownMenuItem>
                  {finding.externalUrl && (
                    <DropdownMenuItem asChild>
                      <a
                        href={finding.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View in Scanner{" "}
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <h4 className="font-medium text-sm mt-1">{finding.title}</h4>

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {finding.componentName && (
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {finding.componentName}
                  {finding.componentVersion && `@${finding.componentVersion}`}
                </span>
              )}
              {finding.filePath && (
                <span className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {finding.filePath}
                  {finding.lineNumber && `:${finding.lineNumber}`}
                </span>
              )}
            </div>

            {(finding.cweIds.length > 0 || finding.cveIds.length > 0) && (
              <div className="flex items-center gap-2 mt-2">
                {finding.cweIds.map((cwe) => (
                  <Badge key={cwe} variant="secondary" className="text-xs">
                    {cwe}
                  </Badge>
                ))}
                {finding.cveIds.map((cve) => (
                  <Badge key={cve} variant="secondary" className="text-xs">
                    {cve}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pl-8 space-y-3 text-sm">
            <div>
              <h5 className="font-medium text-muted-foreground mb-1">
                Description
              </h5>
              <p className="text-foreground">{finding.description}</p>
            </div>

            {finding.remediation && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-1">
                  Remediation
                </h5>
                <p className="text-foreground">{finding.remediation}</p>
              </div>
            )}

            {finding.fixAvailable && finding.fixVersion && (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">
                  Fix Available
                </Badge>
                <span className="text-muted-foreground">
                  Upgrade to {finding.fixVersion}
                </span>
              </div>
            )}

            {finding.codeSnippet && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-1">Code</h5>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                  {finding.codeSnippet}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
