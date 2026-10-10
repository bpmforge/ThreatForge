/**
 * per-stage generation settings table.
 */
import { describe, it, expect } from "vitest";
import {
  GENERATION_SETTINGS,
  generationSettingsFor,
  DEFAULT_TEMPERATURE,
  type GenerationStage,
} from "../generation-settings.js";

describe("GENERATION_SETTINGS", () => {
  it("only the reviewer thinks", () => {
    const thinking = (Object.keys(GENERATION_SETTINGS) as GenerationStage[])
      .filter((s) => GENERATION_SETTINGS[s].thinking)
      .sort();
    expect(thinking).toEqual(["reviewer"]);
  });

  it("micro extraction stages stay under the 300 s transport ceiling (≤ 5,000 tokens)", () => {
    for (const [stage, s] of Object.entries(GENERATION_SETTINGS)) {
      if (stage === "reviewer" || stage === "analysis") continue;
      expect(s.maxTokens, stage).toBeGreaterThanOrEqual(1500);
      expect(s.maxTokens, stage).toBeLessThanOrEqual(5000);
    }
  });

  it("expert/agentic analysis passes run with thinking off", () => {
    expect(GENERATION_SETTINGS.analysis.thinking).toBe(false);
  });

  it("category analysis is capped at 1,500 tokens (design target)", () => {
    expect(GENERATION_SETTINGS.category.maxTokens).toBe(1500);
  });
});

describe("generationSettingsFor", () => {
  it("returns the row for a named stage", () => {
    expect(generationSettingsFor("mitigation")).toEqual({
      thinking: false,
      maxTokens: 3000,
      temperature: 0.3,
    });
  });

  it("keeps the default temperature (0.3) for every stage", () => {
    for (const s of Object.values(GENERATION_SETTINGS)) {
      expect(s.temperature).toBe(DEFAULT_TEMPERATURE);
    }
  });

  it("returns undefined for an unstaged call (caller keeps its defaults)", () => {
    expect(generationSettingsFor(undefined)).toBeUndefined();
  });
});
