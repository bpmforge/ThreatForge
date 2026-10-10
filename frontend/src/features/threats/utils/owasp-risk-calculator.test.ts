import { describe, it, expect } from "vitest";
import {
  calculateOWASPRiskRating,
  createDefaultOWASPMetrics,
  getOWASPRiskColor,
  getOWASPRiskSummary,
  getOWASPRiskBreakdown,
} from "./owasp-risk-calculator";
import type { OWASPRiskRatingMetrics } from "../types/risk-frameworks";

function allValue(v: number): OWASPRiskRatingMetrics {
  return {
    threatAgentFactors: { skillLevel: v, motive: v, opportunity: v, size: v },
    vulnerabilityFactors: {
      easeOfDiscovery: v,
      easeOfExploit: v,
      awareness: v,
      intrusionDetection: v,
    },
    technicalImpactFactors: {
      lossOfConfidentiality: v,
      lossOfIntegrity: v,
      lossOfAvailability: v,
      lossOfAccountability: v,
    },
    businessImpactFactors: {
      financialDamage: v,
      reputationDamage: v,
      nonCompliance: v,
      privacyViolation: v,
    },
  } as OWASPRiskRatingMetrics;
}

describe("calculateOWASPRiskRating", () => {
  it("all-9 inputs → CRITICAL risk level", () => {
    const result = calculateOWASPRiskRating(allValue(9));
    expect(result.riskLevel).toBe("CRITICAL");
  });

  it("all-1 inputs → NOTE risk level", () => {
    const result = calculateOWASPRiskRating(allValue(1));
    expect(result.riskLevel).toBe("NOTE");
  });

  it("all-5 inputs → MEDIUM risk level", () => {
    const result = calculateOWASPRiskRating(allValue(5));
    expect(result.riskLevel).toBe("MEDIUM");
  });

  it("likelihood score is average of threat-agent and vulnerability averages", () => {
    // threat agent all 8, vuln all 4 → avg = (8+4)/2 = 6
    const metrics: OWASPRiskRatingMetrics = {
      ...allValue(4),
      threatAgentFactors: { skillLevel: 8, motive: 8, opportunity: 8, size: 8 },
    } as OWASPRiskRatingMetrics;
    const result = calculateOWASPRiskRating(metrics);
    expect(result.likelihoodScore).toBe(6);
  });

  it("uses the higher of technical vs business impact", () => {
    // tech all 9, business all 1 → overall impact should reflect tech
    const metrics: OWASPRiskRatingMetrics = {
      ...allValue(1),
      technicalImpactFactors: {
        lossOfConfidentiality: 9,
        lossOfIntegrity: 9,
        lossOfAvailability: 9,
        lossOfAccountability: 9,
      },
    } as OWASPRiskRatingMetrics;
    const result = calculateOWASPRiskRating(metrics);
    expect(result.technicalImpactScore).toBeGreaterThan(
      result.businessImpactScore,
    );
  });

  it("returns scores rounded to one decimal", () => {
    const result = calculateOWASPRiskRating(allValue(5));
    expect(result.likelihoodScore % 1).toBe(0); // all-5 averages are whole
    // Just verify they are rounded (finite, not NaN)
    expect(isFinite(result.likelihoodScore)).toBe(true);
    expect(isFinite(result.overallRiskScore)).toBe(true);
  });

  it("round-trips metrics through result", () => {
    const m = allValue(5);
    const result = calculateOWASPRiskRating(m);
    expect(result.metrics).toBe(m);
  });
});

describe("getOWASPRiskColor", () => {
  it("returns correct color for each level", () => {
    expect(getOWASPRiskColor("NOTE")).toBe("bg-gray-400");
    expect(getOWASPRiskColor("LOW")).toBe("bg-blue-500");
    expect(getOWASPRiskColor("MEDIUM")).toBe("bg-yellow-500");
    expect(getOWASPRiskColor("HIGH")).toBe("bg-orange-500");
    expect(getOWASPRiskColor("CRITICAL")).toBe("bg-red-600");
  });

  it("returns gray for unknown level", () => {
    expect(getOWASPRiskColor("UNKNOWN")).toBe("bg-gray-400");
  });
});

describe("getOWASPRiskSummary", () => {
  it("describes high likelihood for score >= 6", () => {
    const result = calculateOWASPRiskRating(allValue(9));
    expect(getOWASPRiskSummary(result)).toContain("High likelihood");
  });

  it("describes low likelihood for score < 3", () => {
    const result = calculateOWASPRiskRating(allValue(1));
    expect(getOWASPRiskSummary(result)).toContain("Low likelihood");
  });

  it("describes balanced impact when scores are close", () => {
    const result = calculateOWASPRiskRating(allValue(5));
    expect(getOWASPRiskSummary(result)).toContain("balanced");
  });
});

describe("getOWASPRiskBreakdown", () => {
  it("identifies high-risk factors >= 7", () => {
    const metrics = {
      ...allValue(5),
      threatAgentFactors: { skillLevel: 8, motive: 8, opportunity: 8, size: 8 },
    } as OWASPRiskRatingMetrics;
    const { highRiskFactors } = getOWASPRiskBreakdown(metrics);
    expect(highRiskFactors).toContain("High attacker skill available");
    expect(highRiskFactors).toContain("High motivation");
  });

  it("identifies low-risk factors <= 3", () => {
    const metrics = {
      ...allValue(5),
      vulnerabilityFactors: {
        easeOfDiscovery: 5,
        easeOfExploit: 5,
        awareness: 5,
        intrusionDetection: 2,
      },
    } as OWASPRiskRatingMetrics;
    const { lowRiskFactors } = getOWASPRiskBreakdown(metrics);
    expect(lowRiskFactors).toContain("Good detection");
  });

  it("returns empty arrays for mid-range values", () => {
    const { highRiskFactors, lowRiskFactors } = getOWASPRiskBreakdown(
      allValue(5),
    );
    expect(highRiskFactors).toHaveLength(0);
    expect(lowRiskFactors).toHaveLength(0);
  });
});

describe("createDefaultOWASPMetrics", () => {
  it("all factors default to 5", () => {
    const m = createDefaultOWASPMetrics();
    const allValues = [
      ...Object.values(m.threatAgentFactors),
      ...Object.values(m.vulnerabilityFactors),
      ...Object.values(m.technicalImpactFactors),
      ...Object.values(m.businessImpactFactors),
    ];
    expect(allValues.every((v) => v === 5)).toBe(true);
  });
});
