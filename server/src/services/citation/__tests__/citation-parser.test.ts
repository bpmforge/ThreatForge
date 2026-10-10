import { describe, it, expect } from "vitest";
import { parseClaim, parseClaimField } from "../citation-parser.js";

describe("parseClaim", () => {
  it("recognises DERIVED with 'Per [doc:...]:' prefix", () => {
    const r = parseClaim("Per [doc:srs.pdf §3.2]: System stores PII.");
    expect(r.kind).toBe("DERIVED");
    expect(r.claim).toBe("System stores PII.");
    expect(r.citations).toEqual([
      {
        type: "DOCUMENT",
        documentName: "srs.pdf",
        sectionAnchor: "3.2",
        pageNumber: undefined,
      },
    ]);
  });

  it("recognises INFERRED with 'Inferred from' prefix", () => {
    const r = parseClaim("Inferred from [doc:sad.pdf §5.1]: Likely SQLi risk.");
    expect(r.kind).toBe("INFERRED");
    expect(r.claim).toBe("Likely SQLi risk.");
    expect(r.citations[0].documentName).toBe("sad.pdf");
    expect(r.citations[0].sectionAnchor).toBe("5.1");
  });

  it("recognises [req:REQ-ID] as a REQUIREMENT citation", () => {
    const r = parseClaim(
      "[req:FR-12] Mitigation enforces TLS 1.3 per functional requirement.",
    );
    expect(r.kind).toBe("DERIVED");
    expect(r.citations).toEqual([
      { type: "REQUIREMENT", requirementId: "FR-12" },
    ]);
    expect(r.claim).toBe(
      "Mitigation enforces TLS 1.3 per functional requirement.",
    );
  });

  it("parses multiple [req:...] tags on one claim", () => {
    const r = parseClaim(
      "[req:SEC-3] [req:HIPAA-164.312(a)(1)] Audit logging covers both.",
    );
    expect(r.citations).toHaveLength(2);
    expect(r.citations.map((c) => c.requirementId)).toEqual([
      "SEC-3",
      "HIPAA-164.312(a)(1)",
    ]);
  });

  it("recognises NOT_FOUND with explicit prefix", () => {
    const r = parseClaim("Not found: encryption-at-rest details.");
    expect(r.kind).toBe("NOT_FOUND");
    expect(r.citations).toEqual([]);
    expect(r.claim).toBe("encryption-at-rest details.");
  });

  it("recognises page-number citation form", () => {
    const r = parseClaim("Per [doc:srs.pdf p.12]: paginated source.");
    expect(r.citations[0]).toEqual({
      type: "DOCUMENT",
      documentName: "srs.pdf",
      sectionAnchor: undefined,
      pageNumber: 12,
    });
  });

  it("recognises [ref:CWE-89]", () => {
    const r = parseClaim("[ref:CWE-89] applies to user search.");
    expect(r.kind).toBe("DERIVED");
    expect(r.citations[0]).toMatchObject({
      type: "REFERENCE",
      referenceKind: "CWE",
      referenceId: "CWE-89",
    });
  });

  it("recognises [component:nodeId]", () => {
    const r = parseClaim("[component:web-frontend] is internet-exposed.");
    expect(r.citations[0]).toEqual({
      type: "COMPONENT",
      componentNodeId: "web-frontend",
    });
  });

  it("returns NONE kind + no citations for plain text", () => {
    const r = parseClaim("This is just an unsourced sentence.");
    expect(r.kind).toBe("NONE");
    expect(r.citations).toEqual([]);
    expect(r.claim).toBe("This is just an unsourced sentence.");
  });

  it("supports multiple citations in one claim", () => {
    const r = parseClaim(
      "Per [doc:srs.pdf §3.2]: [ref:CWE-89] applies to [component:db].",
    );
    expect(r.citations).toHaveLength(3);
    expect(r.citations.map((c) => c.type).sort()).toEqual([
      "COMPONENT",
      "DOCUMENT",
      "REFERENCE",
    ]);
  });

  it("preserves raw input for audit", () => {
    const input = "Per [doc:srs.pdf §3.2]: System stores PII.";
    expect(parseClaim(input).raw).toBe(input);
  });

  it("handles empty / undefined input safely", () => {
    expect(parseClaim("")).toEqual({
      claim: "",
      kind: "NONE",
      citations: [],
      raw: "",
    });
  });
});

describe("parseClaimField", () => {
  it("rewrites the targeted field with the bare claim and exposes _parsed", () => {
    const obj = {
      name: "Per [doc:srs.pdf §3.2]: SQL injection in user search",
      severity: "HIGH",
    };
    const result = parseClaimField(obj, "name");
    expect(result.name).toBe("SQL injection in user search");
    expect(result.severity).toBe("HIGH");
    expect(result._parsed.kind).toBe("DERIVED");
    expect(result._parsed.citations).toHaveLength(1);
  });

  it("no-ops cleanly when field is not a string", () => {
    const obj = { count: 5 } as Record<string, unknown>;
    const result = parseClaimField(obj, "count");
    expect(result._parsed.kind).toBe("NONE");
  });
});
