"use client";

import { useMemo } from "react";
import {
  COMPLIANCE_FRAMEWORKS,
  STRIDE_TO_COMPLIANCE,
  type FrameworkInfo,
} from "@/features/threat-library/constants";
import type {
  ComplianceFramework,
  ComplianceControls,
} from "@/features/threat-library/types";
import type { StrideCategory } from "@/types/canvas";

interface ThreatItem {
  strideCategories: StrideCategory[] | string;
  complianceControls?: ComplianceControls | string;
  status?: string;
}

export interface FrameworkCoverage {
  framework: FrameworkInfo;
  totalControls: number;
  coveredControls: string[];
  openThreats: number;
  mitigatedThreats: number;
  coverage: number;
}

export function useComplianceFrameworkCoverage(
  threats: ThreatItem[],
): FrameworkCoverage[] {
  return useMemo(() => {
    const coverage = {} as Record<
      ComplianceFramework,
      { controls: Set<string>; openThreats: number; mitigatedThreats: number }
    >;
    COMPLIANCE_FRAMEWORKS.forEach((fw) => {
      coverage[fw.id] = {
        controls: new Set(),
        openThreats: 0,
        mitigatedThreats: 0,
      };
    });

    threats.forEach((threat) => {
      const strideCategories = (
        typeof threat.strideCategories === "string"
          ? JSON.parse(threat.strideCategories)
          : threat.strideCategories
      ) as StrideCategory[];

      const threatControls: ComplianceControls = threat.complianceControls
        ? typeof threat.complianceControls === "string"
          ? JSON.parse(threat.complianceControls)
          : (threat.complianceControls as ComplianceControls)
        : {};

      if (Object.keys(threatControls).length === 0) {
        strideCategories.forEach((cat) => {
          const defaults = STRIDE_TO_COMPLIANCE[cat];
          if (defaults) {
            Object.entries(defaults).forEach(([fw, controls]) => {
              controls?.forEach((c) =>
                coverage[fw as ComplianceFramework].controls.add(c),
              );
            });
          }
        });
      } else {
        Object.entries(threatControls).forEach(([fw, controls]) => {
          controls?.forEach((c) =>
            coverage[fw as ComplianceFramework].controls.add(c),
          );
        });
      }

      Object.keys(coverage).forEach((fw) => {
        if (threat.status === "OPEN" || threat.status === "IDENTIFIED") {
          coverage[fw as ComplianceFramework].openThreats++;
        } else {
          coverage[fw as ComplianceFramework].mitigatedThreats++;
        }
      });
    });

    return COMPLIANCE_FRAMEWORKS.map((fw) => {
      const fwCoverage = coverage[fw.id];
      const totalControls = Object.values(STRIDE_TO_COMPLIANCE)
        .flatMap((c) => c[fw.id] || [])
        .filter((v, i, a) => a.indexOf(v) === i).length;
      return {
        framework: fw,
        totalControls,
        coveredControls: Array.from(fwCoverage.controls),
        openThreats: fwCoverage.openThreats,
        mitigatedThreats: fwCoverage.mitigatedThreats,
        coverage:
          totalControls > 0
            ? Math.round((fwCoverage.controls.size / totalControls) * 100)
            : 0,
      };
    }).filter((c) => c.coveredControls.length > 0);
  }, [threats]);
}
