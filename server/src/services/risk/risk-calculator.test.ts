/**
 * Unit tests for the Business Context Risk Calculator (A23)
 */
import { describe, it, expect } from "vitest";
import {
  calculateBusinessRisk,
  toRiskTier,
  type BusinessContext,
} from "./risk-calculator.js";

const fullContext: BusinessContext = {
  businessImpact: "HIGH",
  dataClassification: "CONFIDENTIAL",
  regulatoryScope: ["HIPAA"],
  userBase: "CUSTOMERS",
  revenueImpact: "DIRECT",
};

describe("calculateBusinessRisk", () => {
  it("returns null when context is null", () => {
    expect(calculateBusinessRisk("CRITICAL", 0.8, null)).toBeNull();
  });

  it("CRITICAL severity + CRITICAL impact + regulatory → HIGH/CRITICAL tier", () => {
    const result = calculateBusinessRisk("CRITICAL", 0.8, {
      ...fullContext,
      businessImpact: "CRITICAL",
      dataClassification: "RESTRICTED",
      regulatoryScope: ["HIPAA", "PCI_DSS"],
    });
    expect(result).not.toBeNull();
    expect(result!.businessRisk).toBeGreaterThan(15);
    expect(["HIGH", "CRITICAL"]).toContain(result!.businessRiskTier);
  });

  it("CRITICAL severity + LOW impact → LOW business risk (acceptance criterion 2)", () => {
    const result = calculateBusinessRisk("CRITICAL", 0.5, {
      businessImpact: "LOW",
      dataClassification: "PUBLIC",
      regulatoryScope: [],
      userBase: "INTERNAL",
      revenueImpact: "NONE",
    });
    expect(result).not.toBeNull();
    // technicalRisk = 10×0.6 + 0.5×0.4 = 6.2; multiplier = 0.7×0.75×1.0 = 0.525; risk = 3.255
    expect(result!.businessRisk).toBeLessThan(8);
    expect(result!.businessRiskTier).toBe("LOW");
  });

  it("CRITICAL severity + CRITICAL impact → score > 15 (acceptance criterion 1)", () => {
    const result = calculateBusinessRisk("CRITICAL", null, {
      businessImpact: "CRITICAL",
      dataClassification: "CONFIDENTIAL",
      regulatoryScope: [],
      userBase: "CUSTOMERS",
      revenueImpact: "PRIMARY",
    });
    expect(result).not.toBeNull();
    expect(result!.businessRisk).toBeGreaterThan(15);
  });

  it("caps business risk at 30", () => {
    const result = calculateBusinessRisk("CRITICAL", 1.0, {
      businessImpact: "CRITICAL",
      dataClassification: "RESTRICTED",
      regulatoryScope: ["HIPAA"],
      userBase: "PUBLIC",
      revenueImpact: "PRIMARY",
    });
    expect(result).not.toBeNull();
    expect(result!.businessRisk).toBeLessThanOrEqual(30);
  });

  it("INFO severity + no context multipliers → LOW tier", () => {
    const result = calculateBusinessRisk("INFO", null, {
      businessImpact: "LOW",
      dataClassification: "PUBLIC",
      regulatoryScope: [],
      userBase: "INTERNAL",
      revenueImpact: "NONE",
    });
    expect(result).not.toBeNull();
    expect(result!.businessRiskTier).toBe("LOW");
  });

  it("null likelihood defaults to 0.5", () => {
    const withNull = calculateBusinessRisk("MEDIUM", null, fullContext);
    const with05 = calculateBusinessRisk("MEDIUM", 0.5, fullContext);
    expect(withNull!.businessRisk).toBeCloseTo(with05!.businessRisk, 5);
  });

  it("null businessImpact defaults to multiplier 1.0", () => {
    const result = calculateBusinessRisk("HIGH", 0.5, {
      businessImpact: null,
      dataClassification: null,
      regulatoryScope: [],
      userBase: null,
      revenueImpact: null,
    });
    // technicalRisk = 7.5×0.6 + 0.5×0.4 = 4.7; multiplier = 1.0×1.0×1.0 = 1.0; risk = 4.7
    expect(result!.businessMultiplier).toBeCloseTo(1.0, 5);
    expect(result!.businessRisk).toBeCloseTo(4.7, 5);
  });

  it("regulatory scope containing only 'NONE' does not add regulatory weight", () => {
    const withNone = calculateBusinessRisk("HIGH", 0.5, {
      ...fullContext,
      regulatoryScope: ["NONE"],
    });
    const withEmpty = calculateBusinessRisk("HIGH", 0.5, {
      ...fullContext,
      regulatoryScope: [],
    });
    expect(withNone!.businessMultiplier).toBeCloseTo(
      withEmpty!.businessMultiplier,
      5,
    );
  });

  it("decomposition: technicalRisk + multiplier compose correctly", () => {
    const result = calculateBusinessRisk("HIGH", 0.6, {
      businessImpact: "HIGH",
      dataClassification: "INTERNAL",
      regulatoryScope: [],
      userBase: "CUSTOMERS",
      revenueImpact: "DIRECT",
    });
    // technicalRisk = 7.5×0.6 + 0.6×0.4 = 4.5 + 0.24 = 4.74
    // multiplier = 1.5×1.0×1.0 = 1.5
    // businessRisk = 4.74 × 1.5 = 7.11
    expect(result!.technicalRisk).toBeCloseTo(4.74, 4);
    expect(result!.businessMultiplier).toBeCloseTo(1.5, 4);
    expect(result!.businessRisk).toBeCloseTo(7.11, 2);
    expect(result!.businessRiskTier).toBe("MEDIUM");
  });
});

describe("toRiskTier", () => {
  it("0 → LOW", () => expect(toRiskTier(0)).toBe("LOW"));
  it("6.99 → LOW", () => expect(toRiskTier(6.99)).toBe("LOW"));
  it("7 → MEDIUM", () => expect(toRiskTier(7)).toBe("MEDIUM"));
  it("13.99 → MEDIUM", () => expect(toRiskTier(13.99)).toBe("MEDIUM"));
  it("14 → HIGH", () => expect(toRiskTier(14)).toBe("HIGH"));
  it("20.99 → HIGH", () => expect(toRiskTier(20.99)).toBe("HIGH"));
  it("21 → CRITICAL", () => expect(toRiskTier(21)).toBe("CRITICAL"));
  it("30 → CRITICAL", () => expect(toRiskTier(30)).toBe("CRITICAL"));
});
