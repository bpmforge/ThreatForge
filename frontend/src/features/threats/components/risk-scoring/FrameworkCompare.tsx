"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ThreatRiskScores, CIALevel } from "../../types/risk-frameworks";

interface FrameworkCompareProps {
  scores: ThreatRiskScores;
}

interface FrameworkScore {
  framework: string;
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const CIA_LEVEL_VALUES: Record<CIALevel, number> = {
  NONE: 0,
  LOW: 2.5,
  MEDIUM: 5,
  HIGH: 7.5,
  CRITICAL: 10,
};

const getSeverityFromScore = (
  score: number,
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" => {
  if (score >= 0 && score <= 3.9) return "LOW";
  if (score >= 4 && score <= 6.9) return "MEDIUM";
  if (score >= 7 && score <= 8.9) return "HIGH";
  return "CRITICAL";
};

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case "LOW":
      return "bg-blue-500";
    case "MEDIUM":
      return "bg-yellow-500";
    case "HIGH":
      return "bg-orange-500";
    case "CRITICAL":
      return "bg-red-500";
    default:
      return "bg-muted";
  }
};

export function FrameworkCompare({ scores }: FrameworkCompareProps) {
  const frameworkScores: FrameworkScore[] = useMemo(() => {
    const results: FrameworkScore[] = [];

    if (scores.ciaTriad) {
      const ciaValues = [
        CIA_LEVEL_VALUES[scores.ciaTriad.confidentiality],
        CIA_LEVEL_VALUES[scores.ciaTriad.integrity],
        CIA_LEVEL_VALUES[scores.ciaTriad.availability],
      ];
      const impact = ciaValues.reduce((a, b) => a + b, 0) / 3;
      results.push({
        framework: "CIA",
        score: Math.round(impact * 10) / 10,
        severity: getSeverityFromScore(impact),
      });
    }

    if (scores.cvss31?.baseScore) {
      results.push({
        framework: "CVSS 3.1",
        score: scores.cvss31.baseScore,
        severity: getSeverityFromScore(scores.cvss31.baseScore),
      });
    }

    if (scores.cvss40?.baseScore) {
      results.push({
        framework: "CVSS 4.0",
        score: scores.cvss40.baseScore,
        severity: getSeverityFromScore(scores.cvss40.baseScore),
      });
    }

    if (scores.dread?.averageScore) {
      results.push({
        framework: "DREAD",
        score: scores.dread.averageScore,
        severity: getSeverityFromScore(scores.dread.averageScore),
      });
    }

    if (scores.owaspRiskRating?.overallRiskScore) {
      results.push({
        framework: "OWASP",
        score: scores.owaspRiskRating.overallRiskScore,
        severity: getSeverityFromScore(scores.owaspRiskRating.overallRiskScore),
      });
    }

    return results;
  }, [scores]);

  if (frameworkScores.length < 2) return null;

  const maxScore = Math.max(...frameworkScores.map((f) => f.score), 10);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Risk Score Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {frameworkScores.map((item) => (
            <div key={item.framework} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{item.framework}</span>
                <Badge
                  variant="secondary"
                  className={getSeverityColor(item.severity)}
                >
                  {item.severity}
                </Badge>
              </div>
              <div className="h-6 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(item.score / maxScore) * 100}%` }}
                />
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {item.score.toFixed(1)}/10
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            Scores normalized to 0-10 scale for comparison
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
