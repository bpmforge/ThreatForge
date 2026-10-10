"use client";

/**
 * ThreatCatalogItem - Individual threat item in the catalog list.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { severityBadge, toSeverity } from "@/lib/severity";
import type { CatalogThreat } from "../types";

interface ThreatCatalogItemProps {
  threat: CatalogThreat;
  onAdd: (threat: CatalogThreat) => void;
  isAdded?: boolean;
}

const STRIDE_COLORS: Record<string, string> = {
  SPOOFING: "bg-red-100 text-red-700",
  TAMPERING: "bg-orange-100 text-orange-700",
  REPUDIATION: "bg-yellow-100 text-yellow-700",
  INFORMATION_DISCLOSURE: "bg-blue-100 text-blue-700",
  DENIAL_OF_SERVICE: "bg-purple-100 text-purple-700",
  ELEVATION_OF_PRIVILEGE: "bg-pink-100 text-pink-700",
};

// Severity colour now comes from lib/severity (see its header). This map was
// one of 27 divergent copies: it coloured LOW green while 9 other files used
// blue, and `bg-yellow-500 text-white` on MEDIUM failed WCAG AA contrast.

const SOURCE_LABELS: Record<string, string> = {
  BUILT_IN: "Built-in",
  MITRE_ATTACK: "MITRE",
  CWE: "CWE",
  CAPEC: "CAPEC",
  OWASP: "OWASP",
  CUSTOM: "Custom",
};

export function ThreatCatalogItem({
  threat,
  onAdd,
  isAdded,
}: ThreatCatalogItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={`transition-colors ${isAdded ? "border-green-500 bg-green-50/50" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {threat.strideCategories.map((cat) => (
                <Badge
                  key={cat}
                  variant="outline"
                  className={`${STRIDE_COLORS[cat]} text-xs font-bold`}
                  title={cat.replace(/_/g, " ")}
                >
                  {cat.charAt(0)}
                </Badge>
              ))}
              <Badge
                className={`${severityBadge({ severity: toSeverity(threat.severity) })} text-xs`}
              >
                {threat.severity}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {SOURCE_LABELS[threat.source] || threat.source}
              </Badge>
            </div>
            <h4 className="font-medium mt-1 text-sm">{threat.name}</h4>
          </div>
          <Button
            size="sm"
            variant={isAdded ? "secondary" : "default"}
            onClick={() => onAdd(threat)}
            disabled={isAdded}
            className="shrink-0"
          >
            {isAdded ? (
              "Added"
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" /> Add
              </>
            )}
          </Button>
        </div>

        {/* Description preview */}
        <p
          className={`text-xs text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}
        >
          {threat.description}
        </p>

        {/* Expanded content */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t">
            {/* Attack scenarios */}
            {threat.attackScenarios && threat.attackScenarios.length > 0 && (
              <div>
                <h5 className="text-xs font-medium mb-1">Attack Scenarios</h5>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  {threat.attackScenarios.map((scenario, i) => (
                    <li key={i}>{scenario}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mitigations */}
            {threat.mitigations && threat.mitigations.length > 0 && (
              <div>
                <h5 className="text-xs font-medium mb-1">Mitigations</h5>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  {threat.mitigations.map((mitigation, i) => (
                    <li key={i}>{mitigation}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* References */}
            {threat.references && threat.references.length > 0 && (
              <div>
                <h5 className="text-xs font-medium mb-1">References</h5>
                <div className="flex flex-wrap gap-1">
                  {threat.references.map((ref, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted"
                      onClick={() => ref.url && window.open(ref.url, "_blank")}
                    >
                      {ref.id}
                      {ref.url && <ExternalLink className="h-2.5 w-2.5 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {threat.tags && threat.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {threat.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* External URL */}
            {threat.externalUrl && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => window.open(threat.externalUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View full documentation
              </Button>
            )}
          </div>
        )}

        {/* Expand toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-6 text-xs text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" /> Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" /> More
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
