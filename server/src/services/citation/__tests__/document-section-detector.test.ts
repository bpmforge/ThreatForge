import { describe, it, expect } from "vitest";
import {
  detectSections,
  findSection,
  getSectionText,
} from "../document-section-detector.js";

describe("detectSections", () => {
  it("detects numbered sections", () => {
    const text = [
      "1 Introduction",
      "Some intro text.",
      "",
      "2 Architecture",
      "Architecture description.",
      "",
      "2.1 Components",
      "Components live here.",
    ].join("\n");
    const sections = detectSections(text);
    expect(sections.map((s) => s.anchor)).toEqual(["1", "2", "2.1"]);
    expect(sections[0].header).toBe("1 Introduction");
  });

  it("detects lettered appendices", () => {
    const text = [
      "Appendix A: Glossary",
      "Definitions go here.",
      "",
      "Appendix B Bibliography",
      "Sources.",
    ].join("\n");
    const sections = detectSections(text);
    expect(sections.map((s) => s.anchor)).toEqual(["appendix-a", "appendix-b"]);
  });

  it("detects markdown headings", () => {
    const text = [
      "## Authentication",
      "Auth body.",
      "",
      "### OAuth Flow",
      "Flow body.",
    ].join("\n");
    const sections = detectSections(text);
    expect(sections.map((s) => s.anchor)).toEqual([
      "authentication",
      "oauth-flow",
    ]);
  });

  it("detects ALL-CAPS multi-word headings", () => {
    const text = [
      "SYSTEM OVERVIEW",
      "This system does X.",
      "",
      "DATA FLOW DIAGRAM",
      "Flow body.",
    ].join("\n");
    const sections = detectSections(text);
    expect(sections.map((s) => s.anchor)).toEqual([
      "system-overview",
      "data-flow-diagram",
    ]);
  });

  it("does NOT treat single ALL-CAPS acronyms inline as headings", () => {
    // Acronym-heavy security text should not produce false-positive sections.
    const text = [
      "The system uses TLS for transport.",
      "HTTPS is required on all endpoints.",
      "OWASP has guidance on this.",
    ].join("\n");
    const sections = detectSections(text);
    expect(sections).toEqual([]);
  });

  it("treats single ALL-CAPS heading as section ONLY when followed by blank + body", () => {
    const text = [
      "OVERVIEW",
      "",
      "This is the body that follows.",
      "More body.",
    ].join("\n");
    const sections = detectSections(text);
    expect(sections.map((s) => s.anchor)).toEqual(["overview"]);
  });

  it("dedups duplicate anchors with -N suffix", () => {
    const text = ["## Setup", "First.", "", "## Setup", "Second."].join("\n");
    const sections = detectSections(text);
    expect(sections.map((s) => s.anchor)).toEqual(["setup", "setup-2"]);
  });

  it("returns [] for text with no detectable headings", () => {
    expect(detectSections("just a paragraph of prose")).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(detectSections("")).toEqual([]);
  });
});

describe("getSectionText", () => {
  it("slices the section text correctly", () => {
    const text = [
      "1 Introduction",
      "Intro body.",
      "",
      "2 Body",
      "Body content.",
    ].join("\n");
    const sections = detectSections(text);
    const intro = findSection(sections, "1");
    expect(intro).toBeDefined();
    const sliced = getSectionText(text, intro!);
    expect(sliced).toContain("1 Introduction");
    expect(sliced).toContain("Intro body.");
    expect(sliced).not.toContain("Body content.");
  });
});
