import { describe, it, expect } from "vitest";
import {
  calculateCVSS31Score,
  generateCVSS31VectorString,
  parseCVSS31VectorString,
  getCVSS31Summary,
} from "./cvss31-calculator";
import type { CVSS31BaseMetrics } from "../types/risk-frameworks";

// CVSSv3.1 spec example: AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H → 10.0 CRITICAL
const criticalMetrics: CVSS31BaseMetrics = {
  attackVector: "NETWORK",
  attackComplexity: "LOW",
  privilegesRequired: "NONE",
  userInteraction: "NONE",
  scope: "CHANGED",
  confidentialityImpact: "HIGH",
  integrityImpact: "HIGH",
  availabilityImpact: "HIGH",
};

// CVSSv3.1 spec example: AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N → LOW
const lowMetrics: CVSS31BaseMetrics = {
  attackVector: "LOCAL",
  attackComplexity: "HIGH",
  privilegesRequired: "HIGH",
  userInteraction: "REQUIRED",
  scope: "UNCHANGED",
  confidentialityImpact: "LOW",
  integrityImpact: "NONE",
  availabilityImpact: "NONE",
};

describe("calculateCVSS31Score", () => {
  it("scores max-severity vector as CRITICAL near 10", () => {
    const result = calculateCVSS31Score(criticalMetrics);
    expect(result.baseScore).toBe(10.0);
    expect(result.severity).toBe("CRITICAL");
  });

  it("scores low-severity vector correctly", () => {
    const result = calculateCVSS31Score(lowMetrics);
    expect(result.baseScore).toBeLessThan(4.0);
    expect(result.severity).toBe("LOW");
  });

  it("returns 0 / NONE when all impacts are NONE", () => {
    const result = calculateCVSS31Score({
      ...criticalMetrics,
      confidentialityImpact: "NONE",
      integrityImpact: "NONE",
      availabilityImpact: "NONE",
    });
    expect(result.baseScore).toBe(0);
    expect(result.severity).toBe("NONE");
  });

  it("includes vector string in result", () => {
    const result = calculateCVSS31Score(criticalMetrics);
    expect(result.vectorString).toMatch(/^CVSS:3\.1\//);
  });

  it("reflects baseMetrics in result", () => {
    const result = calculateCVSS31Score(lowMetrics);
    expect(result.baseMetrics).toBe(lowMetrics);
  });

  it("MEDIUM severity: 4.0 ≤ score < 7.0", () => {
    // AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N → 5.4 MEDIUM (spec-verified)
    const result = calculateCVSS31Score({
      attackVector: "NETWORK",
      attackComplexity: "LOW",
      privilegesRequired: "LOW",
      userInteraction: "NONE",
      scope: "UNCHANGED",
      confidentialityImpact: "LOW",
      integrityImpact: "LOW",
      availabilityImpact: "NONE",
    });
    expect(result.baseScore).toBeGreaterThanOrEqual(4.0);
    expect(result.baseScore).toBeLessThan(7.0);
    expect(result.severity).toBe("MEDIUM");
  });
});

describe("generateCVSS31VectorString", () => {
  it("produces correctly formatted vector string", () => {
    const v = generateCVSS31VectorString(criticalMetrics);
    expect(v).toBe("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H");
  });

  it("encodes local/high/required metrics correctly", () => {
    const v = generateCVSS31VectorString(lowMetrics);
    expect(v).toContain("AV:L");
    expect(v).toContain("AC:H");
    expect(v).toContain("PR:H");
    expect(v).toContain("UI:R");
    expect(v).toContain("S:U");
  });
});

describe("parseCVSS31VectorString", () => {
  it("round-trips the critical vector", () => {
    const vector = generateCVSS31VectorString(criticalMetrics);
    const parsed = parseCVSS31VectorString(vector);
    expect(parsed).toEqual(criticalMetrics);
  });

  it("returns null for invalid prefix", () => {
    expect(parseCVSS31VectorString("CVSS:2.0/AV:N/AC:L")).toBeNull();
  });

  it("returns null for missing fields", () => {
    expect(parseCVSS31VectorString("CVSS:3.1/AV:N")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCVSS31VectorString("")).toBeNull();
  });
});

describe("getCVSS31Summary", () => {
  it("mentions network-exploitable for NETWORK attack vector", () => {
    const score = calculateCVSS31Score(criticalMetrics);
    expect(getCVSS31Summary(score)).toContain("network-exploitable");
  });

  it("mentions physical access for PHYSICAL attack vector", () => {
    const score = calculateCVSS31Score({
      ...lowMetrics,
      attackVector: "PHYSICAL",
    });
    expect(getCVSS31Summary(score)).toContain("requires physical access");
  });

  it("mentions no authentication for NONE privileges", () => {
    const score = calculateCVSS31Score(criticalMetrics);
    expect(getCVSS31Summary(score)).toContain("no authentication needed");
  });
});
