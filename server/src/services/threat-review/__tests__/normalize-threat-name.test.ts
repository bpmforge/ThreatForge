import { describe, it, expect } from "vitest";
import {
  normalizeThreatName,
  buildThreatDedupKey,
} from "../normalize-threat-name.js";

describe("normalizeThreatName — paraphrase clustering", () => {
  it("collapses 'missing X' / 'lack of X' / 'no X' / 'absent X' / 'insufficient X'", () => {
    const canonical = normalizeThreatName(
      "Missing authentication on endpoints",
    );
    expect(normalizeThreatName("Lack of authentication on endpoints")).toBe(
      canonical,
    );
    expect(normalizeThreatName("No authentication on endpoints")).toBe(
      canonical,
    );
    expect(normalizeThreatName("Absent authentication on endpoints")).toBe(
      canonical,
    );
    expect(
      normalizeThreatName("Insufficient authentication on endpoints"),
    ).toBe(canonical);
    expect(normalizeThreatName("Endpoints lack authentication")).toBe(
      canonical,
    );
  });

  it("collapses 'unauthenticated' / 'missing authentication' / 'lacks authentication'", () => {
    const canonical = normalizeThreatName(
      "Missing authentication on gRPC endpoint",
    );
    expect(normalizeThreatName("Unauthenticated gRPC endpoint")).toBe(
      canonical,
    );
    expect(normalizeThreatName("gRPC endpoint lacks authentication")).toBe(
      canonical,
    );
  });

  it("collapses 'unencrypted' / 'missing encryption' / 'not encrypted'", () => {
    const canonical = normalizeThreatName("Missing encryption on channel");
    expect(normalizeThreatName("Unencrypted channel")).toBe(canonical);
    expect(normalizeThreatName("Channel not encrypted")).toBe(canonical);
  });

  it("folds consequence verbs — 'X enables Y' equivalent to 'X Y'", () => {
    const canonical = normalizeThreatName("Missing auth endpoint spoofing");
    expect(
      normalizeThreatName("Missing auth on endpoint enables spoofing"),
    ).toBe(canonical);
    expect(normalizeThreatName("Missing auth endpoint allows spoofing")).toBe(
      canonical,
    );
    expect(normalizeThreatName("Missing auth endpoint risks spoofing")).toBe(
      canonical,
    );
  });

  it("is word-order invariant", () => {
    const a = normalizeThreatName("SQL injection via user input");
    const b = normalizeThreatName("User input SQL injection");
    const c = normalizeThreatName("Via user input: SQL injection");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("normalizes common security terminology (auth/authn/authz/mtls)", () => {
    expect(normalizeThreatName("Missing authentication")).toBe(
      normalizeThreatName("Missing authn"),
    );
    expect(normalizeThreatName("Missing authorization")).toBe(
      normalizeThreatName("Missing authz"),
    );
    expect(normalizeThreatName("Missing mutual TLS")).toBe(
      normalizeThreatName("Missing mTLS"),
    );
    expect(normalizeThreatName("Role-based access control bypass")).toBe(
      normalizeThreatName("RBAC bypass"),
    );
  });

  it("stems common plurals", () => {
    expect(normalizeThreatName("Missing auth on endpoints")).toBe(
      normalizeThreatName("Missing auth on endpoint"),
    );
    expect(normalizeThreatName("Unvalidated user requests")).toBe(
      normalizeThreatName("Unvalidated user request"),
    );
  });

  it("distinguishes genuinely different threats", () => {
    expect(normalizeThreatName("Missing authentication")).not.toBe(
      normalizeThreatName("Missing authorization"),
    );
    expect(normalizeThreatName("Missing encryption")).not.toBe(
      normalizeThreatName("Missing auth"),
    );
    expect(normalizeThreatName("SQL injection")).not.toBe(
      normalizeThreatName("Command injection"),
    );
  });

  it("handles empty / whitespace / punctuation-only input", () => {
    expect(normalizeThreatName("")).toBe("");
    expect(normalizeThreatName("   ")).toBe("");
    expect(normalizeThreatName("---!!!")).toBe("");
  });

  it("real-world exact-paraphrase pairs from GreenSpot prod duplicates", () => {
    // These pairs were observed as duplicate rows in prod across multiple
    // pipeline runs. the normalizer should fold them to a single key; anything more
    // semantically-divergent is left to the LLM dedup step.
    const pairs: Array<[string, string]> = [
      [
        "Missing authentication on HTTPS endpoint",
        "Unauthenticated HTTPS endpoint",
      ],
      ["gRPC endpoints lack mutual TLS", "Missing mTLS on gRPC endpoints"],
      ["Unencrypted TCP channel", "TCP channel not encrypted"],
      [
        "Missing audit logging for role assignments",
        "Role assignments lack audit logging",
      ],
    ];
    for (const [a, b] of pairs) {
      expect(normalizeThreatName(a)).toBe(normalizeThreatName(b));
    }
  });
});

describe("buildThreatDedupKey — composite key shape", () => {
  it("uses componentNodeId when present", () => {
    const key = buildThreatDedupKey("tm1", "comp1", null, "Missing auth");
    expect(key).toContain("::comp1::");
  });

  it("falls back to connectionEdgeId when componentNodeId missing", () => {
    const key = buildThreatDedupKey("tm1", null, "edge1", "Missing auth");
    expect(key).toContain("::edge1::");
  });

  it("uses __compound__ sentinel when both are missing", () => {
    const key = buildThreatDedupKey("tm1", null, null, "Missing auth");
    expect(key).toContain("::__compound__::");
  });

  it("different threat models produce different keys", () => {
    const k1 = buildThreatDedupKey("tm1", "comp1", null, "Missing auth");
    const k2 = buildThreatDedupKey("tm2", "comp1", null, "Missing auth");
    expect(k1).not.toBe(k2);
  });
});

describe("normalizeThreatName — actor/subject order", () => {
  it("keeps 'A by B' distinct from 'B by A'", () => {
    expect(
      normalizeThreatName("Spoofing of API Gateway by Mobile Client"),
    ).not.toBe(normalizeThreatName("Spoofing of Mobile Client by API Gateway"));
  });

  it("still ignores word order within each side", () => {
    expect(normalizeThreatName("Spoofing of Gateway by Client")).toBe(
      normalizeThreatName("Gateway spoofing by Client"),
    );
  });

  it("leaves names without 'by' on the old sorted key", () => {
    expect(normalizeThreatName("Endpoints lack authentication")).toBe(
      "auth endpoint missing",
    );
  });
});
