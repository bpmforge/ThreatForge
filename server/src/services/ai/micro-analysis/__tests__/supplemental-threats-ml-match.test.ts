/**
 * Word-boundary ML component matching.
 *
 * The old `generateMLThreats` matched bare substrings ("agent", "model",
 * "vector", ...) against a component's name, so "User Agent Service" got
 * 7 hardcoded ML threats (3 CRITICAL) despite having nothing to do with
 * ML. `hasMLNameSignal`/`isMLComponent` replace that with word-boundary
 * matching plus a two-signal rule for ambiguous tokens.
 */
import { describe, it, expect } from "vitest";
import { hasMLNameSignal, isMLComponent } from "../supplemental-threats.js";

describe("hasMLNameSignal — must NOT match (regression fixture)", () => {
  it("does not match 'User Agent Service' (bare 'agent')", () => {
    expect(hasMLNameSignal("User Agent Service")).toBe(false);
  });

  it("does not match 'Data Model API' (bare 'model')", () => {
    expect(hasMLNameSignal("Data Model API")).toBe(false);
  });

  it("does not match 'Vector Graphics' (bare 'vector')", () => {
    expect(hasMLNameSignal("Vector Graphics")).toBe(false);
  });
});

describe("hasMLNameSignal — must match", () => {
  it("matches 'ML Model Server' (two weak signals: ml + model)", () => {
    expect(hasMLNameSignal("ML Model Server")).toBe(true);
  });

  it("matches 'LLM Agent' (strong signal: llm)", () => {
    expect(hasMLNameSignal("LLM Agent")).toBe(true);
  });

  it("matches 'Embedding Service' (strong signal: embedding)", () => {
    expect(hasMLNameSignal("Embedding Service")).toBe(true);
  });
});

describe("isMLComponent — type allowlist is exact, not substring", () => {
  it("does not match a type that merely contains 'ml' as a substring", () => {
    expect(isMLComponent({ type: "html_template", name: "Static Page" })).toBe(
      false,
    );
  });

  it("matches an exact ML_TYPES entry", () => {
    expect(isMLComponent({ type: "ai_ml_model", name: "Anything" })).toBe(true);
  });

  it("matches via name signal even when type is unrelated", () => {
    expect(isMLComponent({ type: "microservice", name: "LLM Agent" })).toBe(
      true,
    );
  });

  it("does not match a generic service with a single ambiguous token", () => {
    expect(
      isMLComponent({ type: "microservice", name: "User Agent Service" }),
    ).toBe(false);
  });
});
