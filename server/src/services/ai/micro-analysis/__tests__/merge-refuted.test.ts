/**
 * Human rejections must reach the prompt's "do not re-propose" block.
 *
 * The defect this guards against is not a crash; it is silence. The reviewed
 * set was loaded, counted, and dropped, and everything downstream looked
 * healthy. So these tests assert the two things that made it invisible: that
 * merged entries actually survive, and that a key collision loses neither
 * source.
 */
import { describe, it, expect } from "vitest";
import { mergeRefuted } from "../pipeline.js";
import type { MicroAnalysisOptions } from "../types.js";

const base = { methodologies: ["stride"] } as unknown as MicroAnalysisOptions;

describe("mergeRefuted", () => {
  it("returns the same options object when there is nothing to merge", () => {
    expect(mergeRefuted(base, {})).toBe(base);
  });

  it("adds human rejections when the round has none", () => {
    const out = mergeRefuted(base, {
      "comp-1::SPOOFING": [
        { name: "Rejected thing", reason: "not applicable" },
      ],
    });
    expect(out.refutedThreats?.["comp-1::SPOOFING"]).toEqual([
      { name: "Rejected thing", reason: "not applicable" },
    ]);
  });

  it("concatenates on key collision — neither source is lost", () => {
    const withRound = {
      ...base,
      refutedThreats: {
        "comp-1::SPOOFING": [{ name: "Refuted this round" }],
      },
    } as MicroAnalysisOptions;

    const out = mergeRefuted(withRound, {
      "comp-1::SPOOFING": [{ name: "Rejected by a human" }],
    });

    const names = out.refutedThreats?.["comp-1::SPOOFING"]?.map((t) => t.name);
    expect(names).toContain("Refuted this round");
    expect(names).toContain("Rejected by a human");
  });

  it("does not mutate the caller's options", () => {
    const withRound = {
      ...base,
      refutedThreats: { "comp-1::SPOOFING": [{ name: "Original" }] },
    } as MicroAnalysisOptions;

    mergeRefuted(withRound, {
      "comp-1::SPOOFING": [{ name: "Added" }],
    });

    expect(withRound.refutedThreats?.["comp-1::SPOOFING"]).toHaveLength(1);
  });

  it("keeps components and categories separate", () => {
    const out = mergeRefuted(base, {
      "comp-1::SPOOFING": [{ name: "A" }],
      "comp-1::TAMPERING": [{ name: "B" }],
      "comp-2::SPOOFING": [{ name: "C" }],
    });
    expect(Object.keys(out.refutedThreats ?? {})).toHaveLength(3);
  });
});
