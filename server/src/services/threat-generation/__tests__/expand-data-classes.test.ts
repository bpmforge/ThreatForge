/**
 * expandDataClasses — free-text component dataTypes onto the four canonical
 * classes COMPLIANCE_REQUIREMENTS keys on.
 *
 * The risk being tested is asymmetric: a missed mapping loses a clause, a
 * wrong one asserts a compliance obligation that does not apply. So the
 * negative cases matter more than the positive ones.
 */
import { describe, it, expect } from "vitest";
import { expandDataClasses } from "../threat-research.js";

describe("expandDataClasses", () => {
  it("keeps the originals so already-canonical values still match", () => {
    expect(expandDataClasses(["PII"])).toContain("PII");
    expect(expandDataClasses(["Financial"])).toContain("Financial");
  });

  it("maps the go-forward Billing Service — a case the old mapping missed", () => {
    const classes = expandDataClasses(["payment tokens", "invoice records"]);
    expect(classes).toContain("Financial");
    // "payment tokens" also implies a credential; both are legitimate.
    expect(classes).toContain("Credentials");
  });

  it("maps credential-bearing types", () => {
    expect(expandDataClasses(["password hashes"])).toContain("Credentials");
    expect(expandDataClasses(["MFA secrets"])).toContain("Credentials");
    expect(expandDataClasses(["refresh tokens"])).toContain("Credentials");
    expect(expandDataClasses(["session cookies"])).toContain("Credentials");
  });

  it("maps personal data", () => {
    expect(expandDataClasses(["shipping addresses"])).toContain("PII");
    expect(expandDataClasses(["email addresses"])).toContain("PII");
  });

  it("maps health data", () => {
    expect(expandDataClasses(["patient records"])).toContain("PHI");
    expect(expandDataClasses(["medical history"])).toContain("PHI");
  });

  it("does NOT invent classes for unrelated data", () => {
    const classes = expandDataClasses([
      "cached catalog data",
      "order events",
      "API requests",
    ]);
    expect(classes).not.toContain("PHI");
    expect(classes).not.toContain("Financial");
    expect(classes).not.toContain("PII");
    expect(classes).not.toContain("Credentials");
  });

  it("does not treat a bare 'order' as financial — PCI scope is card data", () => {
    expect(expandDataClasses(["order records"])).not.toContain("Financial");
  });

  it("is empty-safe", () => {
    expect(expandDataClasses([])).toEqual([]);
  });
});
