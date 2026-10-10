"use client";

/**
 * ComplianceDetailDialog — Full-screen dialog showing detailed control mappings
 * for a specific compliance framework. Shows every control, which threats cover it,
 * and which mitigations address it.
 */
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import {
  STRIDE_TO_COMPLIANCE,
  STRIDE_FULL_NAMES,
  type FrameworkInfo,
} from "@/features/threat-library/constants";
import type { ComplianceFramework } from "@/features/threat-library/types";
import type { StrideCategory } from "@/types/canvas";
import type { Threat } from "../types";

interface ComplianceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  framework: FrameworkInfo;
  threats: Threat[];
}

interface ControlDetail {
  controlId: string;
  strideCategories: StrideCategory[];
  threats: Array<{
    id: string;
    name: string;
    status: string;
    severity: string;
  }>;
  mitigations: Array<{ id: string; description: string; status: string }>;
  isCovered: boolean;
}

export function ComplianceDetailDialog({
  open,
  onOpenChange,
  framework,
  threats,
}: ComplianceDetailDialogProps) {
  const controls = useMemo(() => {
    const fwId = framework.id as ComplianceFramework;

    const allControls = new Set<string>();
    const controlToStride = new Map<string, Set<StrideCategory>>();

    Object.entries(STRIDE_TO_COMPLIANCE).forEach(([stride, mapping]) => {
      const fwControls = mapping[fwId];
      if (fwControls) {
        fwControls.forEach((c) => {
          allControls.add(c);
          if (!controlToStride.has(c)) controlToStride.set(c, new Set());
          controlToStride.get(c)!.add(stride as StrideCategory);
        });
      }
    });

    const controlDetails: ControlDetail[] = Array.from(allControls)
      .sort()
      .map((controlId) => {
        const strideCategories = Array.from(
          controlToStride.get(controlId) ?? [],
        );

        const matchingThreats: ControlDetail["threats"] = [];
        const matchingMitigations: ControlDetail["mitigations"] = [];

        threats.forEach((threat) => {
          const categories = (
            typeof threat.strideCategories === "string"
              ? JSON.parse(threat.strideCategories)
              : threat.strideCategories
          ) as StrideCategory[];

          const overlaps = categories.some((c) => strideCategories.includes(c));
          if (overlaps) {
            matchingThreats.push({
              id: threat.id,
              name: threat.name,
              status: threat.status,
              severity: threat.severity,
            });
            if (threat.mitigations) {
              threat.mitigations.forEach((m) => {
                matchingMitigations.push({
                  id: m.id,
                  description: m.description,
                  status: m.status,
                });
              });
            }
          }
        });

        return {
          controlId,
          strideCategories,
          threats: matchingThreats,
          mitigations: matchingMitigations,
          isCovered: matchingThreats.length > 0,
        };
      });

    return controlDetails;
  }, [framework, threats]);

  const covered = controls.filter((c) => c.isCovered).length;
  const total = controls.length;
  const coveragePct = total > 0 ? Math.round((covered / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] p-0 overflow-hidden"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="p-4 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {framework.shortName} Compliance Mapping
          </DialogTitle>
          <DialogDescription>{framework.description}</DialogDescription>
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {covered}/{total} controls addressed
              </span>
              <span
                className={
                  coveragePct >= 75
                    ? "text-emerald-600 font-medium"
                    : coveragePct >= 40
                      ? "text-yellow-600 font-medium"
                      : "text-red-500 font-medium"
                }
              >
                {coveragePct}%
              </span>
            </div>
            <Progress value={coveragePct} className="h-2" />
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="divide-y">
            {controls.map((control) => (
              <div
                key={control.controlId}
                className="px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* Control ID + status */}
                <div className="flex items-start gap-2 mb-1.5">
                  <div className="mt-0.5 shrink-0">
                    {control.isCovered ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-medium">
                        {control.controlId}
                      </span>
                      <div className="flex gap-1">
                        {control.strideCategories.map((cat) => (
                          <Badge
                            key={cat}
                            variant="outline"
                            className="text-[10px] h-4 px-1"
                          >
                            {STRIDE_FULL_NAMES[cat]}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Threats mapping */}
                    {control.threats.length > 0 ? (
                      <div className="mt-1.5 space-y-1">
                        {control.threats.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Badge
                              variant="secondary"
                              className={`text-[10px] h-4 px-1 ${
                                t.severity === "CRITICAL"
                                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  : t.severity === "HIGH"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                    : "bg-muted"
                              }`}
                            >
                              {t.severity}
                            </Badge>
                            <span className="text-muted-foreground truncate">
                              {t.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1 ml-auto shrink-0"
                            >
                              {t.status}
                            </Badge>
                          </div>
                        ))}

                        {/* Mitigations */}
                        {control.mitigations.length > 0 && (
                          <div className="mt-1 pl-2 border-l-2 border-emerald-200 dark:border-emerald-800 space-y-0.5">
                            {control.mitigations.slice(0, 3).map((m) => (
                              <p
                                key={m.id}
                                className="text-[11px] text-muted-foreground line-clamp-1"
                              >
                                {m.status === "IMPLEMENTED" ? "✓" : "○"}{" "}
                                {m.description}
                              </p>
                            ))}
                            {control.mitigations.length > 3 && (
                              <p className="text-[10px] text-muted-foreground">
                                +{control.mitigations.length - 3} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-red-500/80 mt-1">
                        No threats mapped — this control has no coverage in the
                        current model.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>
            {total} controls · {covered} covered · {total - covered} gaps
          </span>
          {framework.url && (
            <a
              href={framework.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              Framework docs
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
