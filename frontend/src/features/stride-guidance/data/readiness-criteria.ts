import type { ReadinessCheck, ReadinessResult } from "../types";

export interface ModelContext {
  componentCount: number;
  threatCount: number;
  mitigatedThreatCount: number;
  boundaryCount: number;
  dataFlowCount: number;
  strideCoverage: Record<string, number>;
  componentsWithoutThreats: string[];
  criticalThreatsUnmitigated: number;
  hasDescription: boolean;
}

const READINESS_CRITERIA: Array<{
  id: string;
  name: string;
  description: string;
  severity: "blocker" | "warning" | "suggestion";
  check: (ctx: ModelContext) => { passed: boolean; message: string };
  fixAction?: ReadinessCheck["fixAction"];
}> = [
  {
    id: "has-components",
    name: "Components Added",
    description: "Model should have at least 2 components",
    severity: "blocker",
    check: (ctx) => ({
      passed: ctx.componentCount >= 2,
      message:
        ctx.componentCount >= 2
          ? `${ctx.componentCount} components defined`
          : `Only ${ctx.componentCount} component(s). Add more components to your model.`,
    }),
    fixAction: {
      label: "Add Component",
      action: "navigate",
      target: "palette",
    },
  },
  {
    id: "has-threats",
    name: "Threats Identified",
    description: "Model should have at least one threat",
    severity: "blocker",
    check: (ctx) => ({
      passed: ctx.threatCount > 0,
      message:
        ctx.threatCount > 0
          ? `${ctx.threatCount} threats identified`
          : "No threats identified. Add threats to your components.",
    }),
    fixAction: { label: "Add Threat", action: "navigate", target: "threats" },
  },
  {
    id: "components-have-threats",
    name: "Component Coverage",
    description: "All components should have at least one threat",
    severity: "warning",
    check: (ctx) => {
      if (ctx.componentCount === 0) {
        return {
          passed: false,
          message: "Add components before checking threat coverage",
        };
      }
      return {
        passed: ctx.componentsWithoutThreats.length === 0,
        message:
          ctx.componentsWithoutThreats.length === 0
            ? "All components have threats"
            : `${ctx.componentsWithoutThreats.length} component(s) have no threats`,
      };
    },
    fixAction: {
      label: "View Gaps",
      action: "navigate",
      target: "completeness",
    },
  },
  {
    id: "critical-mitigated",
    name: "Critical Threats Addressed",
    description: "Critical threats should have mitigations",
    severity: "warning",
    check: (ctx) => {
      if (ctx.threatCount === 0) {
        return {
          passed: false,
          message: "Add threats before checking mitigations",
        };
      }
      return {
        passed: ctx.criticalThreatsUnmitigated === 0,
        message:
          ctx.criticalThreatsUnmitigated === 0
            ? "All critical threats have mitigations"
            : `${ctx.criticalThreatsUnmitigated} critical threat(s) need mitigations`,
      };
    },
    fixAction: {
      label: "Add Mitigations",
      action: "navigate",
      target: "threats",
    },
  },
  {
    id: "has-boundaries",
    name: "Trust Boundaries",
    description: "Consider adding trust boundaries",
    severity: "suggestion",
    check: (ctx) => ({
      passed: ctx.boundaryCount > 0,
      message:
        ctx.boundaryCount > 0
          ? `${ctx.boundaryCount} trust boundary(ies) defined`
          : "No trust boundaries. Consider adding them to show security zones.",
    }),
    fixAction: { label: "Add Boundary", action: "navigate", target: "palette" },
  },
  {
    id: "has-data-flows",
    name: "Data Flows",
    description: "Components should be connected with data flows",
    severity: "suggestion",
    check: (ctx) => {
      if (ctx.componentCount < 2) {
        return {
          passed: false,
          message: "Add at least 2 components to define data flows",
        };
      }
      return {
        passed: ctx.dataFlowCount >= ctx.componentCount - 1,
        message:
          ctx.dataFlowCount >= ctx.componentCount - 1
            ? `${ctx.dataFlowCount} data flow(s) defined`
            : "Few data flows. Connect components to show how data moves.",
      };
    },
  },
  {
    id: "stride-coverage",
    name: "STRIDE Coverage",
    description: "Consider all STRIDE categories",
    severity: "suggestion",
    check: (ctx) => {
      const coveredCategories = Object.values(ctx.strideCoverage).filter(
        (c) => c > 0,
      ).length;
      return {
        passed: coveredCategories >= 4,
        message:
          coveredCategories >= 4
            ? `${coveredCategories}/6 STRIDE categories covered`
            : `Only ${coveredCategories}/6 STRIDE categories. Review the checklist.`,
      };
    },
    fixAction: {
      label: "View Checklist",
      action: "navigate",
      target: "checklist",
    },
  },
];

export function calculateReadiness(context: ModelContext): ReadinessResult {
  const checks: ReadinessCheck[] = READINESS_CRITERIA.map((criterion) => {
    const result = criterion.check(context);
    return {
      id: criterion.id,
      name: criterion.name,
      description: criterion.description,
      severity: criterion.severity,
      passed: result.passed,
      message: result.message,
      fixAction: criterion.fixAction,
    };
  });

  const blockers = checks.filter((c) => c.severity === "blocker" && !c.passed);
  const warnings = checks.filter((c) => c.severity === "warning" && !c.passed);
  const suggestions = checks.filter(
    (c) => c.severity === "suggestion" && !c.passed,
  );

  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const percentage = Math.round((passedCount / totalCount) * 100);

  let status: ReadinessResult["status"];
  if (blockers.length > 0) {
    status = "not-ready";
  } else if (warnings.length > 0) {
    status = "needs-work";
  } else if (suggestions.length > 0) {
    status = "almost-ready";
  } else {
    status = "ready";
  }

  return {
    score: passedCount,
    maxScore: totalCount,
    percentage,
    status,
    blockers,
    warnings,
    suggestions,
  };
}
