/**
 * findings digest for reviewer / verification passes.
 */
import { describe, it, expect } from "vitest";
import {
  buildFindingsDigest,
  capNarrative,
  estimateTokens,
  formatDigestLine,
  type DigestFinding,
} from "../findings-digest.js";

function finding(i: number, extra: Partial<DigestFinding> = {}): DigestFinding {
  return {
    title: `Threat number ${i}`,
    component: "API Gateway",
    category: "SPOOFING",
    severity: "HIGH",
    description: `Description ${i} `.repeat(40),
    ...extra,
  };
}

describe("formatDigestLine", () => {
  it("keeps the exact title, component, category and severity", () => {
    const line = formatDigestLine(
      finding(1, { title: "JWT Replay via Missing Nonce" }),
      0,
    );
    expect(line).toMatch(
      /^1\. "JWT Replay via Missing Nonce" \| API Gateway \| SPOOFING \| HIGH — /,
    );
  });

  it("trims the description to one short line", () => {
    const line = formatDigestLine(finding(1), 0);
    expect(line).not.toContain("\n");
    expect(line.length).toBeLessThan(260);
  });

  it("keeps citation tags from the description and the citation source", () => {
    const line = formatDigestLine(
      finding(1, {
        description:
          "Per [doc:architecture.md §3.2] the gateway trusts headers.",
        citationSource: "evidence [req:SEC-12]",
      }),
      0,
    );
    expect(line).toContain("[doc:architecture.md §3.2]");
    expect(line).toContain("[req:SEC-12]");
  });
});

describe("buildFindingsDigest", () => {
  it("includes every finding when under budget", () => {
    const digest = buildFindingsDigest([finding(1), finding(2)], 3000);
    expect(digest.split("\n")).toHaveLength(2);
    expect(digest).not.toContain("omitted");
  });

  it("stays under the token budget and says how many were omitted", () => {
    const findings = Array.from({ length: 200 }, (_, i) => finding(i));
    const digest = buildFindingsDigest(findings, 3000);
    expect(estimateTokens(digest)).toBeLessThanOrEqual(3000);
    const lines = digest.split("\n");
    const marker = lines[lines.length - 1];
    const included = lines.length - 1;
    expect(marker).toBe(
      `[… ${200 - included} more findings omitted to stay under 3000 tokens]`,
    );
  });
});

describe("capNarrative", () => {
  it("returns short text unchanged", () => {
    expect(capNarrative("short", 600)).toBe("short");
  });

  it("truncates long text under the cap with an explicit marker", () => {
    const text = Array.from(
      { length: 400 },
      (_, i) => `line ${i} of the flow analysis`,
    ).join("\n");
    const capped = capNarrative(text, 600);
    expect(estimateTokens(capped)).toBeLessThanOrEqual(640);
    expect(capped).toMatch(
      /\[… truncated to 600 tokens; the architecture context above is complete\]$/,
    );
  });
});
