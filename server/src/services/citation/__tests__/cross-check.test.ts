import { describe, it, expect } from "vitest";
import {
  buildCrossCheckPrompt,
  parseCrossCheckResult,
  validateQuote,
} from "../prompts/cross-check.js";

describe("buildCrossCheckPrompt", () => {
  it("includes source label, source text, and claim", () => {
    const prompt = buildCrossCheckPrompt({
      sourceLabel: "srs.pdf §3.2",
      sourceText: "The system stores user PII in the customers table.",
      claim: "System stores PII.",
    });
    expect(prompt).toContain("srs.pdf §3.2");
    expect(prompt).toContain("user PII in the customers table");
    expect(prompt).toContain("System stores PII.");
    expect(prompt).toContain('"supports"');
  });

  it("requires a verbatim quote and warns about fabrication", () => {
    const prompt = buildCrossCheckPrompt({
      sourceLabel: "x",
      sourceText: "y",
      claim: "z",
    });
    expect(prompt).toMatch(/verbatim sentence from the source/);
    expect(prompt).toMatch(/fabricated quote will downgrade/);
    expect(prompt).toContain('"quote"');
  });

  it("truncates very long source text", () => {
    const long = "x".repeat(20_000);
    const prompt = buildCrossCheckPrompt({
      sourceLabel: "doc.pdf §1",
      sourceText: long,
      claim: "claim",
    });
    expect(prompt).toContain("[... truncated ...]");
    expect(prompt.length).toBeLessThan(20_000);
  });
});

describe("parseCrossCheckResult", () => {
  it("parses well-formed JSON with quote field", () => {
    const r = parseCrossCheckResult(
      '{"supports": true, "confidence": 0.9, "quote": "Direct quote.", "rationale": "matches"}',
    );
    expect(r).toEqual({
      supports: true,
      confidence: 0.9,
      rationale: "matches",
      quote: "Direct quote.",
    });
  });

  it("clamps confidence to [0, 1]", () => {
    expect(
      parseCrossCheckResult(
        '{"supports": true, "confidence": 1.5, "quote": "x", "rationale": ""}',
      ).confidence,
    ).toBe(1);
    expect(
      parseCrossCheckResult(
        '{"supports": false, "confidence": -0.2, "quote": "", "rationale": ""}',
      ).confidence,
    ).toBe(0);
  });

  it("tolerates surrounding prose", () => {
    const r = parseCrossCheckResult(
      'Sure! Here is the result: {"supports": false, "confidence": 0.4, "quote": "", "rationale": "no match"} OK?',
    );
    expect(r.supports).toBe(false);
    expect(r.confidence).toBe(0.4);
  });

  it("returns UNVERIFIED defaults on no JSON", () => {
    const r = parseCrossCheckResult("the model wandered off");
    expect(r).toEqual({
      supports: false,
      confidence: 0,
      rationale: "verifier returned no parseable JSON",
      quote: "",
    });
  });

  it("returns UNVERIFIED defaults on malformed JSON", () => {
    const r = parseCrossCheckResult(
      '{"supports": tru, "confidence": 0.5, "quote": ""}',
    );
    expect(r.supports).toBe(false);
    expect(r.rationale).toMatch(/malformed/i);
  });

  it("treats missing fields as falsy / zero / empty", () => {
    const r = parseCrossCheckResult("{}");
    expect(r).toEqual({
      supports: false,
      confidence: 0,
      rationale: "",
      quote: "",
    });
  });

  it("validates quote against source when supplied", () => {
    const source = "The system stores user PII in the customers table.";
    const r = parseCrossCheckResult(
      `{"supports": true, "confidence": 0.9, "quote": "The system stores user PII in the customers table.", "rationale": "direct match"}`,
      source,
    );
    expect(r.supports).toBe(true);
  });

  it("downgrades supports=true when quote is fabricated", () => {
    const source = "The system stores user PII in the customers table.";
    const r = parseCrossCheckResult(
      `{"supports": true, "confidence": 0.9, "quote": "The system encrypts all PII at rest using AES-256.", "rationale": "claims encryption"}`,
      source,
    );
    expect(r.supports).toBe(false);
    expect(r.confidence).toBe(0);
    expect(r.rationale).toMatch(/quote not found in source/);
  });

  it("handles whitespace differences between quote and source", () => {
    const source = "The    system\nstores user PII\n\nin the customers table.";
    const r = parseCrossCheckResult(
      `{"supports": true, "confidence": 0.85, "quote": "The system stores user PII in the customers table.", "rationale": ""}`,
      source,
    );
    expect(r.supports).toBe(true);
  });

  it("downgrades supports=true when quote is too short to be meaningful", () => {
    const source = "The system stores user PII.";
    const r = parseCrossCheckResult(
      `{"supports": true, "confidence": 0.9, "quote": "PII", "rationale": ""}`,
      source,
    );
    expect(r.supports).toBe(false);
    expect(r.rationale).toMatch(/too short/);
  });

  it("leaves supports=false results unchanged by validation", () => {
    const source = "unrelated";
    const r = parseCrossCheckResult(
      `{"supports": false, "confidence": 0.3, "quote": "anything", "rationale": "not a match"}`,
      source,
    );
    expect(r.supports).toBe(false);
    expect(r.rationale).toBe("not a match");
  });
});

describe("validateQuote", () => {
  it("accepts verbatim quote appearing in source", () => {
    const r = validateQuote(
      {
        supports: true,
        confidence: 0.9,
        rationale: "",
        quote: "AES-256 encryption.",
      },
      "We use AES-256 encryption. All traffic is TLS 1.3.",
    );
    expect(r.supports).toBe(true);
  });

  it("downgrades quote that paraphrases source", () => {
    const r = validateQuote(
      {
        supports: true,
        confidence: 0.9,
        rationale: "paraphrase",
        quote: "All data is encrypted using strong ciphers.",
      },
      "We use AES-256 encryption. All traffic is TLS 1.3.",
    );
    expect(r.supports).toBe(false);
    expect(r.rationale).toMatch(/fabricated or paraphrased/);
  });
});
