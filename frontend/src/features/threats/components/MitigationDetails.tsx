"use client";

import type { Mitigation } from "../types";

function EffectivenessBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.6
      ? "bg-green-500"
      : score >= 0.3
        ? "bg-yellow-500"
        : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

interface MitigationDetailsProps {
  mitigation: Mitigation;
}

export function MitigationDetails({ mitigation }: MitigationDetailsProps) {
  return (
    <>
      {mitigation.effectivenessScore != null && (
        <div className="mt-1.5">
          <EffectivenessBar score={mitigation.effectivenessScore} />
        </div>
      )}

      {mitigation.notes && (
        <p className="text-xs text-muted-foreground mt-1 italic">
          {mitigation.notes}
        </p>
      )}

      {mitigation.testCriteria && (
        <div className="mt-1.5 p-1.5 bg-muted/50 rounded text-[10px]">
          <span className="font-medium text-muted-foreground">Test: </span>
          <span className="text-foreground">{mitigation.testCriteria}</span>
        </div>
      )}

      {mitigation.evidenceLinks && mitigation.evidenceLinks.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {mitigation.evidenceLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {link.title || link.type}
            </a>
          ))}
        </div>
      )}

      {mitigation.requirements && mitigation.requirements.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {mitigation.requirements.map((req) => (
            <span
              key={req.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700"
              title={req.text}
            >
              {req.docId ? `${req.docId} ` : ""}
              {req.reqId}
            </span>
          ))}
        </div>
      )}

      {(!mitigation.requirements || mitigation.requirements.length === 0) &&
        mitigation.requirementRefs &&
        mitigation.requirementRefs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {mitigation.requirementRefs.map((ref, i) => (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700"
                title={ref.text}
              >
                {ref.docId} {ref.reqId}
              </span>
            ))}
          </div>
        )}
    </>
  );
}
