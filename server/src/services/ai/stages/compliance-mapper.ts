/**
 * ComplianceMapper stage handler — non-LLM. Wraps the existing
 * compliance-control catalog used by the frameworks features
 * (services/compliance/frameworks, 12 frameworks / 669 controls) with the
 * same matching semantics as compliance-service's assessControl: a control
 * matches a threat when a control keyword appears in the threat text or the
 * control covers the threat's STRIDE category.
 *
 * NON-MUTATING by design: the legacy pipeline performs
 * no compliance mapping, so this stage must not change the threat set —
 * `complianceMappedThreats` is the input pass-through (same references) and
 * the mapping itself is surfaced separately as `controlMatches`.
 *
 * Frameworks come from the components' declared complianceFrameworks
 * (normalized "PCI-DSS" → "PCI_DSS"); unknown frameworks resolve to zero
 * controls via getFrameworkControls and are skipped.
 */
import {
  getFrameworkControls,
  type ComplianceFramework,
} from "../../compliance/index.js";
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import type { StageContext, StageResult } from "./registry.js";

interface ComplianceMapperInputs {
  threats: MicroThreat[];
  componentContexts?: ComponentContext[];
  /** Explicit framework override (else derived from componentContexts). */
  frameworks?: string[];
}

export interface ControlMatch {
  threatName: string;
  componentId: string;
  framework: ComplianceFramework;
  controlIds: string[];
}

/** "PCI-DSS" / "pci dss" → "PCI_DSS" (ComplianceFramework id shape). */
export function normalizeFrameworkId(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

export async function complianceMapperStage(
  ctx: StageContext,
): Promise<StageResult> {
  const { threats, componentContexts, frameworks } =
    ctx.inputs as unknown as ComplianceMapperInputs;
  if (!Array.isArray(threats)) {
    throw new Error("ComplianceMapper requires inputs.threats");
  }

  const frameworkIds = [
    ...new Set(
      (
        frameworks ??
        (componentContexts ?? []).flatMap((c) => c.complianceFrameworks ?? [])
      ).map(normalizeFrameworkId),
    ),
  ] as ComplianceFramework[];

  const controlMatches: ControlMatch[] = [];
  for (const framework of frameworkIds) {
    const controls = getFrameworkControls(framework); // [] for unknown ids
    if (controls.length === 0) continue;
    for (const threat of threats) {
      const text = `${threat.name} ${threat.description ?? ""}`.toLowerCase();
      const controlIds = controls
        .filter(
          (control) =>
            control.keywords.some((keyword) =>
              text.includes(keyword.toLowerCase()),
            ) || control.strideCategories.includes(threat.category),
        )
        .map((control) => control.id);
      if (controlIds.length > 0) {
        controlMatches.push({
          threatName: threat.name,
          componentId: threat.componentId,
          framework,
          controlIds,
        });
      }
    }
  }

  await ctx.progress(
    100,
    `Compliance mapping: ${controlMatches.length} threat↔control matches ` +
      `across ${frameworkIds.length} framework(s)`,
  );

  return {
    // Pass-through by design — the legacy pipeline has no compliance stage.
    outputs: {
      complianceMappedThreats: threats,
      controlMatches,
      parseFailures: [],
    },
    tokensUsed: 0,
    parseFailures: [],
  };
}
