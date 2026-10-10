import { describe, it, expect, vi } from "vitest";
import {
  bestMatch,
  buildLinkResolver,
  nameMatchScore,
  normalize,
  type ComponentRef,
} from "../component-linker.js";

describe("normalize", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalize("API-Gateway!")).toBe("api gateway");
  });

  it("drops stopwords like 'service' and 'system'", () => {
    expect(normalize("Telemetry Ingestion Service")).toBe(
      "telemetry ingestion",
    );
    expect(normalize("Telemetry Ingestion Services")).toBe(
      "telemetry ingestion",
    );
  });

  it("collapses whitespace", () => {
    expect(normalize("  Order   API  ")).toBe("order api");
  });
});

describe("nameMatchScore", () => {
  it("exact normalized match scores 1.0", () => {
    expect(nameMatchScore("Order API", "order api")).toBe(1.0);
  });

  it("singular/plural service variants match exactly via stopword strip", () => {
    expect(
      nameMatchScore(
        "Telemetry Ingestion Service",
        "Telemetry Ingestion Services",
      ),
    ).toBe(1.0);
  });

  it("containment scores 0.85", () => {
    expect(nameMatchScore("PostgreSQL", "PostgreSQL Database")).toBe(0.85);
  });

  it("word-overlap of 50% (no containment) scores in 0.6-0.8 range", () => {
    // Two of four unique words overlap, neither contains the other.
    const score = nameMatchScore("Foo Bar Baz", "Foo Bar Qux");
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(0.85);
  });

  it("unrelated names score low", () => {
    expect(nameMatchScore("Stripe", "PostgreSQL")).toBeLessThan(0.4);
  });

  it("returns 0 for empty inputs", () => {
    expect(nameMatchScore("", "x")).toBe(0);
    expect(nameMatchScore("x", "")).toBe(0);
  });
});

describe("bestMatch", () => {
  const components: ComponentRef[] = [
    { nodeId: "node-api", name: "Order API", technology: "FastAPI" },
    { nodeId: "node-db", name: "Order DB", technology: "PostgreSQL 17" },
    {
      nodeId: "node-tel",
      name: "Telemetry Ingestion Services",
      technology: "Go",
    },
  ];

  it("returns the canvas nodeId on a strong match", () => {
    const r = bestMatch("Telemetry Ingestion Service", components);
    expect(r.nodeId).toBe("node-tel");
    expect(r.score).toBe(1.0);
  });

  it("returns null when no match clears the threshold", () => {
    const r = bestMatch("Stripe Payment Gateway", components);
    expect(r.nodeId).toBeNull();
    expect(r.score).toBeLessThan(0.7);
  });

  it("matches by component technology when name doesn't fit", () => {
    const r = bestMatch("PostgreSQL", components);
    expect(r.nodeId).toBe("node-db");
    expect(r.score).toBeGreaterThanOrEqual(0.7);
  });

  it("respects a custom threshold (lower → weak matches let through)", () => {
    // "Order Search Service" vs the candidates scores ~0.13 (one shared word
    // out of three unique). Default 0.7 → null. Drop threshold below the
    // computed score → returns the best partial match.
    expect(bestMatch("Order Search Service", components).nodeId).toBeNull();
    const r = bestMatch("Order Search Service", components, 0.1);
    expect(r.nodeId).toBe("node-api");
  });

  it("returns the highest-scoring match when several candidates partial-match", () => {
    const r = bestMatch("Order DB Backup", components);
    expect(r.nodeId).toBe("node-db");
  });
});

describe("buildLinkResolver", () => {
  it("loads components once and returns a closure that resolves labels", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { nodeId: "node-a", name: "Auth Service", technology: "Go" },
      { nodeId: "node-b", name: "Notification Dispatcher", technology: null },
    ]);
    const prisma = { component: { findMany } } as any;

    const resolve = await buildLinkResolver(prisma, "tm1");
    expect(findMany).toHaveBeenCalledOnce();

    const r1 = resolve("Auth Service");
    const r2 = resolve("Random Stuff");
    expect(r1.nodeId).toBe("node-a");
    expect(r2.nodeId).toBeNull();
    // Still only called once — no extra DB hits per resolution.
    expect(findMany).toHaveBeenCalledOnce();
  });
});
