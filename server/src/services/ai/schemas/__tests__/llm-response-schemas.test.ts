/**
 * Wave E — LLM Response Schema Tests
 */
import { describe, it, expect } from "vitest";
import {
  ThreatZ,
  MitigationZ,
  ThreatArrayZ,
  safeParseArray,
} from "../llm-response-schemas.js";

describe("ThreatZ", () => {
  it("accepts a valid threat with name", () => {
    const result = ThreatZ.safeParse({
      name: "SQL Injection",
      description: "User input reaches a query unsanitised",
      severity: "HIGH",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid threat with title instead of name", () => {
    const result = ThreatZ.safeParse({
      title: "SSRF Attack",
      description: "Server-side request forgery via url param",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a threat with neither name nor title", () => {
    const result = ThreatZ.safeParse({
      description: "Something bad happens",
      severity: "MEDIUM",
    });
    expect(result.success).toBe(false);
  });

  it("defaults severity to MEDIUM when field is absent", () => {
    const result = ThreatZ.safeParse({
      name: "Missing severity",
      description: "No severity field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe("MEDIUM");
    }
  });

  it("rejects an invalid severity value", () => {
    const result = ThreatZ.safeParse({
      name: "Bad severity",
      description: "Has invalid severity",
      severity: "EXTREMELY_BAD",
    });
    expect(result.success).toBe(false);
  });
});

describe("MitigationZ", () => {
  it("clamps effectiveness above 0.85", () => {
    const result = MitigationZ.safeParse({
      description: "Use parameterised queries",
      effectiveness: 0.99,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.effectiveness).toBe(0.85);
    }
  });

  it("accepts string effectiveness and converts it", () => {
    const result = MitigationZ.safeParse({
      description: "Apply WAF rules",
      effectiveness: "0.7",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.effectiveness).toBe(0.7);
    }
  });
});

describe("safeParseArray", () => {
  it("returns all valid items when input is clean", () => {
    const input = [
      { name: "A", description: "desc A" },
      { name: "B", description: "desc B" },
    ];
    const outcome = safeParseArray(ThreatArrayZ, input);
    expect(outcome.valid).toHaveLength(2);
    expect(outcome.failed).toHaveLength(0);
  });

  it("reports per-item failures while keeping valid items", () => {
    const input = [
      { name: "Good", description: "valid threat" },
      { description: "missing name and title" },
    ];
    const outcome = safeParseArray(ThreatArrayZ, input);
    expect(outcome.valid).toHaveLength(1);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0].index).toBe(1);
  });

  it("returns a failure when input is not an array", () => {
    const outcome = safeParseArray(ThreatArrayZ, { name: "not an array" });
    expect(outcome.valid).toHaveLength(0);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0].error).toBe("Not an array");
  });
});
