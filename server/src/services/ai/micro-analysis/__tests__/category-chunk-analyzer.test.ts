/**
 * chunked first pass: one call per fixed chunk of categories, with a
 * per-category fallback to the single-category path on any problem.
 */
import { describe, it, expect, vi } from "vitest";
import type { ComponentContext } from "../../../threat-generation/context-aware-pipeline.js";
import type { CategoryReferenceData } from "../types.js";
import {
  analyzeCategoryChunk,
  chunkCategories,
  CATEGORY_CHUNK_SIZE,
} from "../category-chunk-analyzer.js";

vi.mock("../../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const component: ComponentContext = {
  id: "web",
  name: "Web App",
  type: "WEB_APP",
  dataClassification: "INTERNAL",
  dataTypes: [],
  accessPattern: "INTERNAL_ONLY",
  complianceFrameworks: [],
  existingControls: [],
  inbound: [],
  outbound: [],
};

const refs: CategoryReferenceData = {
  threatTemplates: [],
  ruleBasedSeeds: [],
  cwes: [],
  owaspEntries: [],
  complianceReqs: [],
} as unknown as CategoryReferenceData;

const OPTIONS = {
  minConfidence: 0,
  maxLoops: 1,
  retrySleep: async () => undefined,
};

function threat(name: string, category = "ignored-by-attribution") {
  return {
    name,
    description: `${name} [component:web]`,
    category,
    severity: "HIGH",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    confidence: 0.8,
  };
}

const chunk = (...cats: string[]) =>
  cats.map((category) => ({ category, refs }));
const isChunkPrompt = (user: string) => user.includes("## Categories:");

function byCategory<T extends { category: string }>(
  results: T[],
  category: string,
): T {
  const r = results.find((x) => x.category === category);
  if (!r) throw new Error(`no result for ${category}`);
  return r;
}

describe("chunkCategories", () => {
  it("partitions STRIDE into two fixed chunks of three", () => {
    expect(CATEGORY_CHUNK_SIZE).toBe(3);
    expect(
      chunkCategories([
        "SPOOFING",
        "TAMPERING",
        "REPUDIATION",
        "INFORMATION_DISCLOSURE",
        "DENIAL_OF_SERVICE",
        "ELEVATION_OF_PRIVILEGE",
      ]),
    ).toEqual([
      ["SPOOFING", "TAMPERING", "REPUDIATION"],
      ["INFORMATION_DISCLOSURE", "DENIAL_OF_SERVICE", "ELEVATION_OF_PRIVILEGE"],
    ]);
  });
});

describe("analyzeCategoryChunk", () => {
  it("makes one call for the chunk and attributes threats to their key", async () => {
    const aiCall = vi.fn(
      async (_system: string, _user: string, _stage?: string) =>
        JSON.stringify({
          SPOOFING: { threats: [threat("S1")], gaps: [] },
          TAMPERING: { threats: [threat("T1"), threat("T2")], gaps: [] },
          REPUDIATION: { threats: [], gaps: [] },
        }),
    );
    const { results, llmCalls } = await analyzeCategoryChunk(
      aiCall,
      component,
      "stride",
      chunk("SPOOFING", "TAMPERING", "REPUDIATION"),
      OPTIONS,
    );
    expect(llmCalls).toBe(1);
    expect(aiCall).toHaveBeenCalledOnce();
    expect(aiCall.mock.calls[0][2]).toBe("category-chunk");
    expect(
      results.map((r) => [
        r.category,
        r.threats.map((t) => t.name),
        r.fellBack,
      ]),
    ).toEqual([
      ["SPOOFING", ["S1"], false],
      ["TAMPERING", ["T1", "T2"], false],
      ["REPUDIATION", [], false],
    ]);
    for (const r of results)
      for (const t of r.threats) expect(t.category).toBe(r.category);
  });

  it("falls back to its own call for a category missing from the reply", async () => {
    const aiCall = vi.fn(async (_s: string, user: string) =>
      isChunkPrompt(user)
        ? JSON.stringify({
            SPOOFING: { threats: [threat("S1")] },
            TAMPERING: { threats: [] },
          })
        : JSON.stringify([threat("R-single")]),
    );
    const { results, llmCalls } = await analyzeCategoryChunk(
      aiCall,
      component,
      "stride",
      chunk("SPOOFING", "TAMPERING", "REPUDIATION"),
      OPTIONS,
    );
    expect(llmCalls).toBe(2);
    const rep = byCategory(results, "REPUDIATION");
    expect(rep.fellBack).toBe(true);
    expect(rep.threats.map((t) => t.name)).toEqual(["R-single"]);
    expect(byCategory(results, "SPOOFING").fellBack).toBe(false);
  });

  it("falls back for every category when the reply has no JSON object", async () => {
    const aiCall = vi.fn(async (_s: string, user: string) =>
      isChunkPrompt(user) ? "I could not produce JSON" : "[]",
    );
    const { results, llmCalls } = await analyzeCategoryChunk(
      aiCall,
      component,
      "stride",
      chunk("SPOOFING", "TAMPERING", "REPUDIATION"),
      OPTIONS,
    );
    expect(llmCalls).toBe(4);
    expect(results.every((r) => r.fellBack)).toBe(true);
  });

  it("falls back for every category when the chunk call keeps failing", async () => {
    const aiCall = vi.fn(async (_s: string, user: string) => {
      if (isChunkPrompt(user)) throw new Error("provider down");
      return "[]";
    });
    const { results } = await analyzeCategoryChunk(
      aiCall,
      component,
      "stride",
      chunk("SPOOFING", "TAMPERING", "REPUDIATION"),
      OPTIONS,
    );
    expect(results.map((r) => r.fellBack)).toEqual([true, true, true]);
    expect(aiCall.mock.calls.filter(([, u]) => !isChunkPrompt(u))).toHaveLength(
      3,
    );
  });

  it("a single category (e.g. a retry) uses the unchanged single-category path", async () => {
    const aiCall = vi.fn(
      async (_system: string, _user: string, _stage?: string) =>
        JSON.stringify([threat("only")]),
    );
    const { results, llmCalls } = await analyzeCategoryChunk(
      aiCall,
      component,
      "stride",
      chunk("TAMPERING"),
      OPTIONS,
    );
    expect(llmCalls).toBe(1);
    expect(isChunkPrompt(aiCall.mock.calls[0][1])).toBe(false);
    expect(aiCall.mock.calls[0][2]).toBe("category");
    expect(results).toEqual([
      expect.objectContaining({ category: "TAMPERING", fellBack: false }),
    ]);
  });
});
