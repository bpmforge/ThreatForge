/**
 * Integration tests against the actual demo docs in /demodocs/.
 *
 * These tests pin the prose-detector behavior to the real source material.
 * If the detection heuristic regresses (e.g., starts treating algorithms as
 * sequences), these tests catch it before it ships.
 *
 * Tests rely on file-system reads — kept deliberately simple and fast.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectProseSequences } from "../prose-detector.js";
import { parseDeterministicSequences } from "../deterministic-parser.js";

const DEMO_DIR = join(import.meta.dirname, "../../../../../../demodocs");

function loadDemo(filename: string): string {
  return readFileSync(join(DEMO_DIR, filename), "utf-8");
}

describe("demo docs — actual source material", () => {
  it("SAD §3.2 'Software Process Workflow' → detected with all 7 steps", () => {
    const sad = loadDemo("SAD-8845213-Rev001-GreenSpot-Services.md");
    const detected = detectProseSequences(sad);

    const workflow = detected.find((d) =>
      /software\s+process\s+workflow/i.test(d.heading),
    );
    expect(workflow).toBeDefined();
    expect(workflow!.steps).toHaveLength(7);

    // Spot-check actor language survives extraction
    expect(workflow!.steps[0].text).toMatch(/Sensor device transmits payload/);
    expect(workflow!.steps[1].text).toMatch(/API Gateway authenticates/);
    expect(workflow!.steps[6].text).toMatch(/Notification service consumes/);
  });

  it("SAD overall — finds the workflow but no spurious extras", () => {
    const sad = loadDemo("SAD-8845213-Rev001-GreenSpot-Services.md");
    const detected = detectProseSequences(sad);
    expect(detected).toHaveLength(1);
    expect(detected[0].heading).toMatch(/workflow/i);
  });

  it("SDS — algorithm sections are NOT detected as sequences", () => {
    const sds = loadDemo("SDS-4491028-Rev001-GreenSpot-Services.md");
    const detected = detectProseSequences(sds);

    // SDS §6.6 has 9 numbered "Step N:" subheadings (algorithm) and §6.5.2
    // has a 5-step algorithm-to-group list. None should be flagged as
    // inter-component sequences.
    expect(detected).toEqual([]);

    // Belt-and-suspenders: if a future heading-pattern change ever lets one
    // of these slip through, the assertion above would catch it. The loop
    // is the diagnostic — narrows down which heading regressed.
    for (const d of detected) {
      expect(d.heading).not.toMatch(/algorithm/i);
      expect(d.heading).not.toMatch(/calculation/i);
      expect(d.heading).not.toMatch(/rounding/i);
    }
  });

  it("SRS — pure requirements doc, no sequences expected", () => {
    const srs = loadDemo("SRS-9876543-Rev001-GreenSpot-Services.md");
    const detected = detectProseSequences(srs);
    expect(detected).toEqual([]);
  });

  it("none of the demo docs contain Mermaid/PlantUML blocks (fenced-diagram detection finds none)", () => {
    // This is the headline finding that motivated prose extraction. Pinning it as a
    // test so a future doc-format change is visible in CI.
    for (const file of [
      "SAD-8845213-Rev001-GreenSpot-Services.md",
      "SDS-4491028-Rev001-GreenSpot-Services.md",
      "SRS-9876543-Rev001-GreenSpot-Services.md",
    ]) {
      const content = loadDemo(file);
      expect(parseDeterministicSequences(content)).toEqual([]);
    }
  });
});
