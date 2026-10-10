import { describe, it, expect } from "vitest";
import { detectProseSequences, isSequenceHeading } from "../prose-detector.js";

describe("isSequenceHeading", () => {
  it.each([
    "Software Process Workflow",
    "Workflow",
    "Sequence of Operations",
    "Login Sequence",
    "Sequence Diagram",
    "Data Flow",
    "Dataflow",
    "Interaction Flow",
    "Service Workflow",
  ])("matches positive heading: %s", (h) => {
    expect(isSequenceHeading(h)).toBe(true);
  });

  it.each([
    "Algorithm to Group Sensor Data Points",
    "TIGR Calculation Steps",
    "Computation Pipeline",
    "Rounding Heuristic",
    "Display Rounding",
    "Test Procedure",
    "Testing Protocol",
  ])("rejects negative heading: %s", (h) => {
    expect(isSequenceHeading(h)).toBe(false);
  });

  it.each([
    "Introduction",
    "Scope",
    "Requirements",
    "References",
    "Definitions",
  ])("rejects unrelated heading: %s", (h) => {
    expect(isSequenceHeading(h)).toBe(false);
  });

  it("a positive keyword inside an algorithm heading is vetoed", () => {
    expect(
      isSequenceHeading("Algorithm Workflow for Pattern Recognition"),
    ).toBe(false);
  });
});

describe("detectProseSequences", () => {
  it("detects a basic workflow with numbered steps", () => {
    const doc = [
      "## Software Process Workflow",
      "1. First step.",
      "2. Second step.",
      "3. Third step.",
    ].join("\n");
    const found = detectProseSequences(doc);
    expect(found).toHaveLength(1);
    expect(found[0].heading).toBe("Software Process Workflow");
    expect(found[0].headingLevel).toBe(2);
    expect(found[0].steps).toHaveLength(3);
    expect(found[0].steps[0]).toMatchObject({
      number: 1,
      text: "First step.",
      sourceQuote: "1. First step.",
    });
  });

  it("strips a leading section number from the heading title", () => {
    const doc = [
      "### 3.2 Software Process Workflow",
      "1. step one",
      "2. step two",
    ].join("\n");
    const r = detectProseSequences(doc);
    expect(r[0].heading).toBe("Software Process Workflow");
  });

  it("requires at least 2 numbered items (single-step sections are noise)", () => {
    const doc = ["## Workflow", "1. lonely step"].join("\n");
    expect(detectProseSequences(doc)).toEqual([]);
  });

  it("ignores sections without a positive heading match", () => {
    const doc = ["## Introduction", "1. Background context", "2. Goals"].join(
      "\n",
    );
    expect(detectProseSequences(doc)).toEqual([]);
  });

  it("ignores algorithm sections even with numbered steps", () => {
    const doc = [
      "### 6.5.2 Algorithm to Group Sensor Data Points",
      "1. Retrieve all valid SDPs.",
      "2. Iterate the array.",
      "3. Evaluate each value.",
    ].join("\n");
    expect(detectProseSequences(doc)).toEqual([]);
  });

  it("stops collecting steps at the next heading of same or lower level", () => {
    const doc = [
      "## Workflow",
      "1. step in workflow",
      "2. another in workflow",
      "## Other Section",
      "1. step OUTSIDE workflow",
      "2. should not be captured",
    ].join("\n");
    const r = detectProseSequences(doc);
    expect(r).toHaveLength(1);
    expect(r[0].steps).toHaveLength(2);
    expect(r[0].steps[1].text).toBe("another in workflow");
  });

  it("crosses through deeper headings inside the workflow section", () => {
    // A subheading (h3) inside an h2 workflow does NOT close the workflow.
    const doc = [
      "## Process Workflow",
      "1. step one",
      "### Subnote",
      "2. step two",
    ].join("\n");
    const r = detectProseSequences(doc);
    expect(r).toHaveLength(1);
    expect(r[0].steps).toHaveLength(2);
  });

  it("rejects steps that aren't a contiguous list (gap > 2 is noise)", () => {
    const doc = [
      "## Workflow",
      "1. a",
      "9. unrelated numbered line later",
    ].join("\n");
    expect(detectProseSequences(doc)).toEqual([]);
  });

  it("rejects step lists that don't start at 1 or 2", () => {
    const doc = ["## Workflow", "5. starts late", "6. then this"].join("\n");
    expect(detectProseSequences(doc)).toEqual([]);
  });

  it("captures the full source block as sourceQuote for the diagram", () => {
    const doc = ["## Workflow", "1. first", "2. second", "## After"].join("\n");
    const r = detectProseSequences(doc);
    expect(r[0].sourceQuote).toBe("## Workflow\n1. first\n2. second");
  });

  it("finds multiple sequences in the same document", () => {
    const doc = [
      "## Login Workflow",
      "1. user logs in",
      "2. server validates",
      "## Some Other Stuff",
      "Plain prose.",
      "## Logout Workflow",
      "1. user logs out",
      "2. server invalidates",
    ].join("\n");
    const r = detectProseSequences(doc);
    expect(r.map((d) => d.heading)).toEqual([
      "Login Workflow",
      "Logout Workflow",
    ]);
  });

  it("works on the actual SAD demo doc — finds the §3.2 workflow", () => {
    // Mirror the exact lines from demodocs/SAD-8845213-Rev001-GreenSpot-Services.md §3.2
    const doc = [
      "### 3.2 Software Process Workflow",
      "1. Sensor device transmits payload.",
      "2. API Gateway authenticates sensor certificate.",
      "3. Ingestion service validates JSON schema.",
      "4. Payload placed on 'raw-telemetry' topic.",
      "5. TIGR Calculator service processes payload; updates Redis cache.",
      "6. Anomaly Detection service scores payload; if anomaly detected, places event on 'alerts' topic.",
      "7. Notification service consumes 'alerts' topic and dispatches SMS/Webhooks.",
    ].join("\n");
    const r = detectProseSequences(doc);
    expect(r).toHaveLength(1);
    expect(r[0].heading).toBe("Software Process Workflow");
    expect(r[0].steps).toHaveLength(7);
    expect(r[0].steps[6].text).toMatch(/Notification service consumes/);
  });

  it("works on the SDS demo — algorithm sections are NOT detected", () => {
    // SDS §6.6 has algorithm steps. the prose detector must skip these.
    const doc = [
      "### 6.6.2 Step 1: Separate the Sensor Data into Low/High Moisture/Temp Groups",
      "Discussion text.",
      "### 6.5.2 Algorithm to Group Sensor Data Points",
      "1. Retrieve all valid SDPs.",
      "2. Iterate through the array of SDPs.",
      "3. For each SDP, evaluate its value.",
      "4. Increment a counter.",
      "5. Calculate the percentage.",
    ].join("\n");
    expect(detectProseSequences(doc)).toEqual([]);
  });
});
