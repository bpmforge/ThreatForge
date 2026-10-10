/**
 * Recompute a threat's business risk from its severity and likelihood and the
 * model's business context. Models without business context are left alone.
 */
import type { RiskTier } from "@prisma/client";
import { getPrisma } from "../../db.js";
import {
  calculateBusinessRisk,
  type BusinessContext,
} from "./risk-calculator.js";

export async function refreshThreatBusinessRisk(
  threatId: string,
  modelId: string,
): Promise<void> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    select: {
      businessImpact: true,
      dataClassification: true,
      regulatoryScope: true,
      userBase: true,
      revenueImpact: true,
    },
  });
  if (
    !model ||
    !(
      model.businessImpact ||
      model.dataClassification ||
      model.userBase ||
      model.revenueImpact
    )
  ) {
    return;
  }

  const context: BusinessContext = {
    businessImpact: model.businessImpact as BusinessContext["businessImpact"],
    dataClassification:
      model.dataClassification as BusinessContext["dataClassification"],
    regulatoryScope: JSON.parse(model.regulatoryScope) as string[],
    userBase: model.userBase as BusinessContext["userBase"],
    revenueImpact: model.revenueImpact as BusinessContext["revenueImpact"],
  };
  const threat = await prisma.threat.findUnique({
    where: { id: threatId },
    select: { severity: true, likelihood: true },
  });
  if (!threat) return;

  const result = calculateBusinessRisk(
    threat.severity,
    threat.likelihood,
    context,
  );
  if (!result) return;
  await prisma.threat.update({
    where: { id: threatId },
    data: {
      businessRiskScore: result.businessRisk,
      businessRiskTier: result.businessRiskTier as RiskTier,
    },
  });
}
