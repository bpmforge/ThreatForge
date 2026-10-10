"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle } from "lucide-react";
import type { CatalogThreat } from "../types";

interface ParseResult {
  threats: CatalogThreat[];
  errors: string[];
  warnings: string[];
}

interface ParseResultsPanelProps {
  result: ParseResult;
}

export function ParseResultsPanel({ result }: ParseResultsPanelProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-[200px] border rounded-lg p-3">
        {result.errors.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-destructive text-sm font-medium mb-1">
              <AlertCircle className="h-4 w-4" />
              Errors ({result.errors.length})
            </div>
            {result.errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive pl-5">
                {err}
              </p>
            ))}
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-yellow-600 text-sm font-medium mb-1">
              <AlertCircle className="h-4 w-4" />
              Warnings ({result.warnings.length})
            </div>
            {result.warnings.map((warn, i) => (
              <p key={i} className="text-xs text-yellow-600 pl-5">
                {warn}
              </p>
            ))}
          </div>
        )}

        {result.threats.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium mb-1">
              <CheckCircle className="h-4 w-4" />
              Valid Threats ({result.threats.length})
            </div>
            {result.threats.slice(0, 5).map((threat) => (
              <div
                key={threat.id}
                className="text-xs pl-5 py-1 border-b last:border-0"
              >
                <span className="font-medium">{threat.name}</span>
                <div className="flex gap-1 mt-0.5">
                  {threat.strideCategories.map((cat) => (
                    <Badge
                      key={cat}
                      variant="outline"
                      className="text-[9px] px-1"
                    >
                      {cat.slice(0, 3)}
                    </Badge>
                  ))}
                  <Badge className="text-[9px] px-1">{threat.severity}</Badge>
                </div>
              </div>
            ))}
            {result.threats.length > 5 && (
              <p className="text-xs text-muted-foreground pl-5 mt-1">
                +{result.threats.length - 5} more...
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
