import { describe, it, expect } from "vitest";
import { checkReference } from "../reference-resolver.js";

describe("checkReference — CWE", () => {
  it("verifies a curated CWE with high signal", () => {
    const r = checkReference("CWE", "CWE-89");
    expect(r.resolved).toBe(true);
    expect(r.inCuratedSet).toBe(true);
  });

  it("verifies a non-curated but format-valid CWE with format-only rationale", () => {
    const r = checkReference("CWE", "CWE-99999");
    expect(r.resolved).toBe(true);
    expect(r.inCuratedSet).toBe(false);
    expect(r.rationale).toMatch(/format-only/i);
  });

  it("rejects a malformed CWE id", () => {
    expect(checkReference("CWE", "CWE-NOT_A_NUMBER").resolved).toBe(false);
    expect(checkReference("CWE", "CW-89").resolved).toBe(false);
    expect(checkReference("CWE", "89").resolved).toBe(false);
  });
});

describe("checkReference — OWASP", () => {
  it("verifies a Top-10 2021 entry", () => {
    const r = checkReference("OWASP", "A03:2021");
    expect(r.resolved).toBe(true);
    expect(r.inCuratedSet).toBe(true);
  });

  it("verifies format-valid OWASP id from a different year", () => {
    const r = checkReference("OWASP", "A03:2017");
    expect(r.resolved).toBe(true);
    expect(r.inCuratedSet).toBe(false);
  });

  it("rejects malformed OWASP ids", () => {
    expect(checkReference("OWASP", "A3:2021").resolved).toBe(false);
    expect(checkReference("OWASP", "A03").resolved).toBe(false);
    expect(checkReference("OWASP", "OWASP-A03").resolved).toBe(false);
  });
});

describe("checkReference — NIST 800-53", () => {
  it("verifies AC-3 form", () => {
    expect(checkReference("NIST", "AC-3").resolved).toBe(true);
  });

  it("verifies SC-7 form", () => {
    expect(checkReference("NIST_800_53", "SC-7").resolved).toBe(true);
  });

  it("verifies enhancement form AC-3(4)", () => {
    expect(checkReference("NIST", "AC-3(4)").resolved).toBe(true);
  });

  it("rejects malformed NIST ids", () => {
    expect(checkReference("NIST", "ac-3").resolved).toBe(false);
    expect(checkReference("NIST", "SCAN-7").resolved).toBe(false);
  });
});

describe("checkReference — HIPAA", () => {
  it("verifies a HIPAA section like 164.312", () => {
    expect(checkReference("HIPAA", "164.312").resolved).toBe(true);
  });

  it("verifies multi-level subsections", () => {
    expect(checkReference("HIPAA", "164.312.a.2").resolved).toBe(true);
  });

  it("rejects ids without a dot", () => {
    expect(checkReference("HIPAA", "164").resolved).toBe(false);
  });
});

describe("checkReference — fallback / inference", () => {
  it("infers CWE kind when caller passes only the id", () => {
    expect(checkReference(undefined, "CWE-89").resolved).toBe(true);
  });

  it("infers OWASP kind from id format", () => {
    expect(checkReference(undefined, "A03:2021").resolved).toBe(true);
  });

  it("returns unresolved for unknown kind", () => {
    expect(checkReference("CUSTOM", "XYZ-1").resolved).toBe(false);
  });

  it("returns unresolved when id is missing entirely", () => {
    expect(checkReference("CWE", undefined).resolved).toBe(false);
  });
});
