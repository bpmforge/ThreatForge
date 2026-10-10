"use client";

/**
 * DocumentTypeCardDetails Component
 *
 * Expanded detail body for a document type card: detection rules,
 * threshold, supported formats, and linked prompt.
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import type { DocumentTypeConfig } from "../types";
import { parseDetectionRules, parseSupportedFormats } from "../types";

interface DocumentTypeCardDetailsProps {
  docType: DocumentTypeConfig;
}

export function DocumentTypeCardDetails({
  docType,
}: DocumentTypeCardDetailsProps): React.ReactElement {
  const rules = parseDetectionRules(docType);
  const formats = parseSupportedFormats(docType);

  return (
    <CardContent className="pt-0 pb-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium text-muted-foreground mb-1">
            Detection Rules ({rules.length})
          </p>
          <div className="space-y-1">
            {rules.slice(0, 5).map((rule, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {rule.type}
                </Badge>
                <code className="text-xs bg-muted px-1 rounded truncate max-w-[150px]">
                  {rule.value}
                </code>
                <span className="text-xs text-muted-foreground">
                  ({rule.weight})
                </span>
              </div>
            ))}
            {rules.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{rules.length - 5} more rules
              </p>
            )}
          </div>
        </div>
        <div>
          <p className="font-medium text-muted-foreground mb-1">
            Threshold: {docType.detectionThreshold}
          </p>
          <p className="font-medium text-muted-foreground mb-1 mt-2">
            Supported Formats
          </p>
          <div className="flex flex-wrap gap-1">
            {formats.map((format) => (
              <Badge key={format} variant="secondary" className="text-xs">
                {format}
              </Badge>
            ))}
          </div>
          {docType.promptTemplate && (
            <>
              <p className="font-medium text-muted-foreground mb-1 mt-2">
                Linked Prompt
              </p>
              <Badge>{docType.promptTemplate.name}</Badge>
            </>
          )}
        </div>
      </div>
    </CardContent>
  );
}
