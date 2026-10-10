"use client";

/**
 * RiskScoreBadge - Compact inline display of risk scores.
 * Shows the most relevant scores in a condensed format.
 */
import { severityDot } from "@/lib/severity";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThreatRiskScores } from "../../types/risk-frameworks";

interface RiskScoreBadgeProps {
  scores?: ThreatRiskScores;
  showAll?: boolean;
}

type SeverityLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "NOTE";

export function RiskScoreBadge({
  scores,
  showAll = false,
}: RiskScoreBadgeProps) {
  if (!scores || scores.enabledFrameworks.length === 0) {
    return null;
  }

  const scoreBadges: Array<{
    label: string;
    score: string | number;
    severity: SeverityLevel;
    tooltip: string;
  }> = [];

  // CVSS 3.1
  if (scores.cvss31 && scores.enabledFrameworks.includes("CVSS_3_1")) {
    scoreBadges.push({
      label: "CVSS",
      score: scores.cvss31.baseScore.toFixed(1),
      severity: scores.cvss31.severity as SeverityLevel,
      tooltip: `CVSS 3.1: ${scores.cvss31.baseScore.toFixed(1)} (${scores.cvss31.severity})`,
    });
  }

  // CVSS 4.0
  if (scores.cvss40 && scores.enabledFrameworks.includes("CVSS_4_0")) {
    scoreBadges.push({
      label: "CVSS4",
      score: scores.cvss40.baseScore.toFixed(1),
      severity: scores.cvss40.severity as SeverityLevel,
      tooltip: `CVSS 4.0: ${scores.cvss40.baseScore.toFixed(1)} (${scores.cvss40.severity})`,
    });
  }

  // DREAD
  if (scores.dread && scores.enabledFrameworks.includes("DREAD")) {
    scoreBadges.push({
      label: "DREAD",
      score: scores.dread.averageScore.toFixed(1),
      severity: scores.dread.severity as SeverityLevel,
      tooltip: `DREAD: ${scores.dread.averageScore.toFixed(1)} (${scores.dread.severity})`,
    });
  }

  // CIA Triad
  if (scores.ciaTriad && scores.enabledFrameworks.includes("CIA_TRIAD")) {
    const ciaLevels = [
      scores.ciaTriad.confidentiality,
      scores.ciaTriad.integrity,
      scores.ciaTriad.availability,
    ];
    const highestImpact = getHighestCIA(ciaLevels);
    scoreBadges.push({
      label: "CIA",
      score: `${scores.ciaTriad.confidentiality[0]}/${scores.ciaTriad.integrity[0]}/${scores.ciaTriad.availability[0]}`,
      severity: highestImpact as SeverityLevel,
      tooltip: `CIA: C=${scores.ciaTriad.confidentiality}, I=${scores.ciaTriad.integrity}, A=${scores.ciaTriad.availability}`,
    });
  }

  // OWASP
  if (
    scores.owaspRiskRating &&
    scores.enabledFrameworks.includes("OWASP_RISK_RATING")
  ) {
    scoreBadges.push({
      label: "OWASP",
      score: scores.owaspRiskRating.overallRiskScore.toFixed(1),
      severity: scores.owaspRiskRating.riskLevel as SeverityLevel,
      tooltip: `OWASP Risk: ${scores.owaspRiskRating.overallRiskScore.toFixed(1)} (${scores.owaspRiskRating.riskLevel})`,
    });
  }

  if (scoreBadges.length === 0) {
    return null;
  }

  // In non-showAll mode, only show the first/most important score
  const displayBadges = showAll ? scoreBadges : scoreBadges.slice(0, 1);
  const remainingCount = scoreBadges.length - displayBadges.length;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {displayBadges.map((badge, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={`text-xs text-white ${severityDot(badge.severity)} hover:opacity-90`}
              >
                {badge.label}: {badge.score}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{badge.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                +{remainingCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {scoreBadges.slice(displayBadges.length).map((badge, index) => (
                  <p key={index}>{badge.tooltip}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function getHighestCIA(levels: string[]): string {
  const order = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
  let highest = 0;
  for (const level of levels) {
    const idx = order.indexOf(level);
    if (idx > highest) highest = idx;
  }
  return order[highest];
}
