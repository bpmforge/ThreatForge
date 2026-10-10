/**
 * The legacy parsers record a ParseFailure and warn when they drop
 * malformed items from a non-empty array.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseThreatsFromResponse,
  parseMitigationsFromResponse,
  resolveComponentNames,
} from "../response-parsers.js";
import type { ParseFailure } from "../micro-analysis/types.js";
import logger from "../../../utils/logger.js";

vi.mock("../../../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe("parseThreatsFromResponse drops", () => {
  const content = JSON.stringify([
    { name: "SQLi", description: "d" },
    { description: "no name" },
    "junk",
  ]);

  it("records a ParseFailure per dropped item and warns", () => {
    const failures: ParseFailure[] = [];
    const out = parseThreatsFromResponse(content, failures);
    expect(out.map((t) => (t as unknown as { name: string }).name)).toEqual([
      "SQLi",
    ]);
    expect(failures.map((f) => [f.stage, f.index])).toEqual([
      ["threat-generation", 1],
      ["threat-generation", 2],
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("still warns without a failures array (existing callers)", () => {
    expect(parseThreatsFromResponse(content)).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("does not warn when nothing is dropped", () => {
    const failures: ParseFailure[] = [];
    parseThreatsFromResponse(JSON.stringify([{ name: "a" }]), failures);
    expect(failures).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("parseMitigationsFromResponse drops", () => {
  it("records a ParseFailure for entries without a description", () => {
    const failures: ParseFailure[] = [];
    const out = parseMitigationsFromResponse(
      JSON.stringify([
        { description: "Use TLS" },
        { text: "orphan", category: "x" },
        { description: "   " },
      ]),
      failures,
    );
    expect(out).toHaveLength(1);
    expect(failures.map((f) => [f.stage, f.index])).toEqual([
      ["mitigation-generation", 1],
      ["mitigation-generation", 2],
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe("resolveComponentNames", () => {
  const comps = [
    { id: "c1", name: "API Gateway" },
    { id: "c2", name: "Database" },
    { id: "c3", name: "Cache" },
    { id: "c4", name: "cache" },
  ];

  it("resolves case-insensitive, trimmed names to ids", () => {
    const [t] = resolveComponentNames(
      [{ targetComponent: "  api gateway " }],
      comps,
    );
    expect(t.targetComponentId).toBe("c1");
  });

  it("unknown name yields no target", () => {
    const [t] = resolveComponentNames(
      [{ targetComponent: "Nope", targetComponentId: "bogus" }],
      comps,
    );
    expect(t.targetComponentId).toBeUndefined();
  });

  it("ambiguous name takes first match and warns", () => {
    const [t] = resolveComponentNames([{ targetComponent: "CACHE" }], comps);
    expect(t.targetComponentId).toBe("c3");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("keeps a supplied targetComponentId when no name is given", () => {
    const [t] = resolveComponentNames([{ targetComponentId: "c2" }], comps);
    expect(t.targetComponentId).toBe("c2");
  });

  it("rewrites [component:Name] tags to ids, leaving ids/unknowns alone", () => {
    const [t] = resolveComponentNames(
      [
        {
          description:
            "[component:database] a [component:c1] b [component:Ghost] c",
        },
      ],
      comps,
    );
    expect(t.description).toBe(
      "[component:c2] a [component:c1] b [component:Ghost] c",
    );
  });
});
