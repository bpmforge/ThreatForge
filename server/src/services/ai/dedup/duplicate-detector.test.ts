import { describe, it, expect } from "vitest";
import {
  detectDuplicates,
  duplicateRate,
  MERGE_THRESHOLD,
  REVIEW_THRESHOLD,
  type DetectorThreat,
} from "./duplicate-detector.js";

function t(
  id: string,
  name: string,
  over: Partial<DetectorThreat> = {},
): DetectorThreat {
  return {
    id,
    name,
    targetId: "comp-a",
    categories: ["SPOOFING"],
    cweIds: [],
    mitigations: [],
    source: "ai",
    ...over,
  };
}

function pairOf(
  pairs: ReturnType<typeof detectDuplicates>,
  a: string,
  b: string,
) {
  return pairs.find(
    (p) => (p.a === a && p.b === b) || (p.a === b && p.b === a),
  );
}

describe("detectDuplicates", () => {
  it("puts a reworded same-target threat in the merge band", () => {
    const pairs = detectDuplicates([
      t("1", "JWT Signature Bypass via Algorithm Confusion", {
        categories: ["TAMPERING"],
        cweIds: ["CWE-347"],
      }),
      t("2", "JWT Signature Verification Bypass via Algorithm Confusion", {
        categories: ["SPOOFING"],
        cweIds: ["CWE-347"],
      }),
    ]);
    const p = pairOf(pairs, "1", "2");
    expect(p?.band).toBe("merge");
    expect(p?.score).toBeGreaterThanOrEqual(MERGE_THRESHOLD);
    expect(p?.reasons.join(" ")).toMatch(/name/);
  });

  it("never auto-merges across different targets, however similar", () => {
    const pairs = detectDuplicates([
      t("1", "Cleartext Transmission of Session Tokens", {
        targetId: "comp-a",
      }),
      t("2", "Cleartext Transmission of Session Tokens", {
        targetId: "comp-b",
      }),
    ]);
    const p = pairOf(pairs, "1", "2");
    expect(p?.band).toBe("review");
    expect(p?.reasons).toContain("different-target");
  });

  it("keeps opposite-direction actor threats distinct", () => {
    const pairs = detectDuplicates([
      t("1", "Spoofing of Billing Service by Order Service"),
      t("2", "Spoofing of Order Service by Billing Service"),
    ]);
    const p = pairOf(pairs, "1", "2");
    expect(p?.band ?? "distinct").toBe("distinct");
  });

  it("never auto-merges names that each carry a contrasting term (seen in seeds 03 and 16)", () => {
    const pairs = detectDuplicates([
      t("1", "Unencrypted data at rest in Redis cache"),
      t("2", "Unencrypted data in transit to Redis cache"),
      t("3", "Basic Auth Credential Spoofing to PostgreSQL"),
      t("4", "Basic Auth Credential Spoofing to RabbitMQ"),
    ]);
    for (const [a, b] of [
      ["1", "2"],
      ["3", "4"],
    ]) {
      const p = pairOf(pairs, a, b);
      expect(p?.band).not.toBe("merge");
      expect(p?.reasons).toContain("contrasting-terms");
    }
  });

  it("scores unrelated threats on one component as distinct", () => {
    const pairs = detectDuplicates([
      t("1", "SQL Injection in Invoice Reconciliation Queries", {
        categories: ["TAMPERING"],
        cweIds: ["CWE-89"],
      }),
      t("2", "Unbounded Queue Growth and Memory Exhaustion", {
        categories: ["DENIAL_OF_SERVICE"],
        cweIds: ["CWE-400"],
      }),
    ]);
    const p = pairOf(pairs, "1", "2");
    expect(p?.band ?? "distinct").toBe("distinct");
  });

  it("applies the class-grain rule: same CWE + same control → at least review", () => {
    const control =
      "Enable TLS with certificate validation on the Redis connection and rotate the static API key.";
    const pairs = detectDuplicates([
      t("1", "Redis Connection Spoofing via Unencrypted API Key", {
        categories: ["SPOOFING"],
        cweIds: ["CWE-319"],
        mitigations: [control],
      }),
      t("2", "Cleartext Transmission of Refresh Tokens to Redis", {
        categories: ["INFORMATION_DISCLOSURE"],
        cweIds: ["CWE-319"],
        mitigations: [control],
      }),
    ]);
    const p = pairOf(pairs, "1", "2");
    expect(p).toBeDefined();
    expect(["review", "merge"]).toContain(p?.band);
    expect(p?.reasons).toContain("class-grain:same-cwe+same-control");
    expect(p?.score).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });

  it("disjoint CWE sets pull a lexically close pair down", () => {
    const base = [
      t("1", "Missing Rate Limiting on Login Endpoint", {
        cweIds: ["CWE-307"],
      }),
      t("2", "Missing Rate Limiting on Login Endpoint Logs", {
        cweIds: ["CWE-778"],
      }),
    ];
    const withCwe = pairOf(detectDuplicates(base), "1", "2");
    const without = pairOf(
      detectDuplicates(base.map((x) => ({ ...x, cweIds: [] }))),
      "1",
      "2",
    );
    expect(withCwe?.score ?? 1).toBeLessThan(without?.score ?? 0);
    expect(withCwe?.reasons).toContain("disjoint-cwe");
  });

  it("is deterministic and orders a < b by input position", () => {
    const input = [
      t("x", "Session Cookie Tampering and Replay"),
      t("y", "Session Cookie Tampering and Replay Attack"),
    ];
    const one = detectDuplicates(input);
    const two = detectDuplicates(input);
    expect(one).toEqual(two);
    expect(one[0].a).toBe("x");
  });

  it("scores the whole model set, not per component (cross-target pairs are compared)", () => {
    const pairs = detectDuplicates([
      t("1", "Webhook Signature Spoofing for Charge Result Injection", {
        targetId: "comp-a",
        cweIds: ["CWE-345"],
      }),
      t("2", "Webhook Signature Spoofing for Charge Result Injection", {
        targetId: "comp-b",
        cweIds: ["CWE-345"],
      }),
    ]);
    expect(pairOf(pairs, "1", "2")).toBeDefined();
  });

  it("handles 500 threats quickly (blocking, not naive heavy O(n²))", () => {
    const words = [
      "token",
      "session",
      "replay",
      "injection",
      "exhaustion",
      "cache",
      "broker",
      "queue",
      "webhook",
      "cookie",
      "header",
      "certificate",
    ];
    const many: DetectorThreat[] = [];
    for (let i = 0; i < 500; i++) {
      const w = (k: number) => words[(i * 7 + k * 3) % words.length];
      many.push(
        t(`t${i}`, `${w(0)} ${w(1)} ${w(2)} threat ${i % 13}`, {
          targetId: `comp-${i % 25}`,
          cweIds: [`CWE-${100 + (i % 9)}`],
          description: `${w(3)} ${w(4)} described ${i}`,
          mitigations: [`apply ${w(5)} control`],
        }),
      );
    }
    const start = performance.now();
    detectDuplicates(many);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});

describe("duplicateRate", () => {
  it("counts each surplus member once, greedily, over the given bands", () => {
    const threats = [
      t("1", "JWT Signature Bypass via Algorithm Confusion"),
      t("2", "JWT Signature Verification Bypass via Algorithm Confusion"),
      t("3", "Unbounded Queue Growth and Memory Exhaustion", {
        categories: ["DENIAL_OF_SERVICE"],
      }),
    ];
    const pairs = detectDuplicates(threats);
    expect(duplicateRate(threats.length, pairs, ["merge"])).toBeCloseTo(1 / 3);
    expect(duplicateRate(0, [], ["merge"])).toBe(0);
  });
});
