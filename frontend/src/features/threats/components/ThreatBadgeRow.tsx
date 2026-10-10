"use client";

import { severityBadge, toSeverity } from "@/lib/severity";
import { STRIDE_CATEGORIES, SEVERITY_OPTIONS } from "../constants";
import { RiskScoreBadge } from "./risk-scoring/RiskScoreBadge";
import { VerificationBadge } from "./VerificationBadge";
import { ChallengeBadge } from "./ChallengeBadge";
import type { Threat } from "../types";
import type { StrideCategory, Severity } from "@/types/canvas";

function getStrideShorts(categories: StrideCategory[]): string {
  return categories
    .map((cat) => STRIDE_CATEGORIES.find((c) => c.value === cat)?.short || "?")
    .join("");
}

function getSeverityColor(severity: Severity): string {
  return (
    SEVERITY_OPTIONS.find((o) => o.value === severity)?.color || "bg-muted"
  );
}

interface ThreatBadgeRowProps {
  threat: Threat;
  modelId: string | null;
  completedMitigations: number;
  citationPanelOpen: boolean;
  onCitationPanelChange: (open: boolean) => void;
}

export function ThreatBadgeRow({
  threat,
  modelId,
  completedMitigations,
  citationPanelOpen,
  onCitationPanelChange,
}: ThreatBadgeRowProps) {
  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="list"
      aria-label="Threat attributes"
    >
      <span
        role="listitem"
        aria-label={`STRIDE categories: ${threat.strideCategories.join(", ")}`}
        className="inline-flex items-center justify-center px-2 h-6 rounded text-xs font-bold bg-muted text-foreground tracking-wider"
      >
        {getStrideShorts(threat.strideCategories)}
      </span>
      <span
        role="listitem"
        aria-label={`Severity: ${threat.severity}`}
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getSeverityColor(threat.severity)}`}
      >
        {threat.severity}
      </span>
      {threat.category && (
        <span
          role="listitem"
          aria-label={`Category: ${threat.category}`}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700"
        >
          {threat.category}
        </span>
      )}
      {threat.mitigations.length > 0 && (
        <span
          role="listitem"
          aria-label={`${completedMitigations} of ${threat.mitigations.length} mitigations complete`}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700"
        >
          {completedMitigations}/{threat.mitigations.length} mitigated
        </span>
      )}
      {threat.riskScores && <RiskScoreBadge scores={threat.riskScores} />}
      {threat.cvssScore31 != null && (
        <a
          href={
            threat.cvssVector31
              ? `https://www.first.org/cvss/calculator/3.1#${threat.cvssVector31}`
              : undefined
          }
          target="_blank"
          rel="noopener noreferrer"
          role="listitem"
          aria-label={`CVSS 3.1: ${threat.cvssScore31}`}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
        >
          CVSS {threat.cvssScore31}
        </a>
      )}
      {threat.businessRiskTier && (
        <span
          role="listitem"
          aria-label={`Business risk: ${threat.businessRiskTier}`}
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${severityBadge({ severity: toSeverity(threat.businessRiskTier), variant: "soft" })}`}
        >
          {threat.businessRiskTier} business risk
        </span>
      )}
      {threat.source && threat.source !== "MANUAL" && (
        <span
          role="listitem"
          aria-label={`Source: ${threat.source}`}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-violet-100 text-violet-700"
        >
          AI
        </span>
      )}
      {threat.manuallyEdited && (
        <span
          role="listitem"
          aria-label="Human edited"
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
        >
          Human edited
        </span>
      )}
      {threat.reviewStatus && threat.reviewStatus !== "PENDING" && (
        <span
          role="listitem"
          aria-label={`Review: ${threat.reviewStatus}`}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            threat.reviewStatus === "ACCEPTED"
              ? "bg-green-100 text-green-700"
              : threat.reviewStatus === "REJECTED"
                ? "bg-red-100 text-red-700"
                : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {threat.reviewStatus === "ACCEPTED"
            ? "Accepted"
            : threat.reviewStatus === "REJECTED"
              ? "Rejected"
              : "Modified"}
        </span>
      )}
      <VerificationBadge
        status={threat.verificationStatus}
        onClick={
          modelId && threat.verificationStatus
            ? () => onCitationPanelChange(!citationPanelOpen)
            : undefined
        }
      />
      <ChallengeBadge
        status={threat.challengeStatus}
        note={threat.verificationNote}
      />
      {threat.assignee && (
        <span
          role="listitem"
          aria-label={`Assigned to: ${threat.assignee.name}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200"
        >
          {threat.assignee.name}
        </span>
      )}
    </div>
  );
}
