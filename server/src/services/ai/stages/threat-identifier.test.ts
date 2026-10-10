/**
 * ThreatIdentifier stage handler unit tests.
 *
 * DB-free: no `inputs.persist`, so the handler never touches Prisma (same
 * gating as the legacy pipeline). Equivalence with the legacy loop is
 * covered separately by src/test/parity-stage-wrapped.test.ts (replay AI);
 * these tests cover the stage contract: registration via stages/index.ts,
 * raw-context inputs, per-component ctx.progress, abort, and output shape.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ThreatModelContext } from "../../../types/ai.js";
import { STRIDE_CATEGORIES } from "../micro-analysis/types.js";
import type { MicroThreat } from "../micro-analysis/types.js";
import { registerStageHandlers } from "./index.js";
import { getStage, resetStageRegistry, type StageContext } from "./registry.js";
import {
  sequentialThreatOrder,
  threatIdentifierStage,
} from "./threat-identifier.js";

/** One well-formed threat per LLM call — confidence 0.9 avoids the loop. */
const STUB_RESPONSE = JSON.stringify([
  {
    name: "Stub threat",
    description: "A deterministic stub threat for contract tests.",
    severity: "HIGH",
    confidence: 0.9,
    mitigation: {
      description: "Apply the stub control",
      effort: "MEDIUM",
      effectiveness: "0.5",
    },
  },
]);

const context: ThreatModelContext = {
  name: "Unit fixture",
  components: [
    { id: "web", name: "Web App", type: "WEB_APP", trustZone: "INTERNAL" },
    { id: "db", name: "Primary DB", type: "DATABASE", trustZone: "INTERNAL" },
  ],
  connections: [
    {
      id: "c1",
      source: "web",
      target: "db",
      protocol: "POSTGRESQL",
      encrypted: true,
    },
  ],
  boundaries: [],
};

function makeCtx(overrides: Partial<StageContext> = {}): StageContext {
  return {
    executionId: "exec-1",
    threatModelId: "tm-1",
    organizationId: "org-1",
    sessionId: "session-1",
    inputs: { context, options: { methodologies: ["stride"] } },
    aiCall: async () => STUB_RESPONSE,
    progress: async () => undefined,
    checkpoint: async () => undefined,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("ThreatIdentifier stage handler", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("registers via stages/index.ts side-effect registration", () => {
    expect(() => getStage("ThreatIdentifier")).toThrowError(/not registered/);
    registerStageHandlers();
    expect(getStage("ThreatIdentifier")).toBe(threatIdentifierStage);
  });

  it("runs every (component, category) pair and aggregates threats + compound", async () => {
    const result = await threatIdentifierStage(makeCtx());

    const threats = result.outputs.threats as Array<{
      componentId: string;
      category: string;
      name: string;
      sourceMethodology: string;
    }>;
    const loop = threats.filter((t) => t.componentId !== "compound");
    const compound = threats.filter((t) => t.componentId === "compound");

    // 2 components × 6 STRIDE categories, one stub threat each
    expect(loop).toHaveLength(2 * STRIDE_CATEGORIES.length);
    for (const componentId of ["web", "db"]) {
      const categories = loop
        .filter((t) => t.componentId === componentId)
        .map((t) => t.category)
        .sort();
      expect(categories).toEqual([...STRIDE_CATEGORIES].sort());
    }
    // ≥3 loop threats → compound sub-step ran (stub parses to 1 compound)
    expect(compound).toHaveLength(1);
    expect(compound[0].sourceMethodology).toBe("compound");

    expect(result.parseFailures).toEqual([]);
    expect(result.outputs.parseFailures).toBe(result.parseFailures);
    expect(result.tokensUsed).toBe(0);
    expect(result.outputs.attackChains).toBeDefined();
    expect(result.outputs.llmCalls as number).toBeGreaterThan(0);
  }, 60_000);

  it("reports ctx.progress once per component with a 0-100 pct", async () => {
    const calls: Array<{ pct: number; msg: string }> = [];
    await threatIdentifierStage(
      makeCtx({
        progress: async (pct, msg) => {
          calls.push({ pct, msg });
        },
      }),
    );
    expect(calls).toHaveLength(2);
    expect(calls[0].pct).toBe(50);
    expect(calls[0].msg).toContain("Web App");
    expect(calls[1].pct).toBe(100);
    expect(calls[1].msg).toContain("Primary DB");
  }, 60_000);

  it("throws CANCELLED when ctx.signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      threatIdentifierStage(makeCtx({ signal: controller.signal })),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("requires inputs.context in wave A1", async () => {
    await expect(
      threatIdentifierStage(makeCtx({ inputs: {} })),
    ).rejects.toThrowError(/requires inputs\.context/);
  });

  it("honors the legacy mitigationsOnly skip guard (generates nothing)", async () => {
    let aiCalls = 0;
    const result = await threatIdentifierStage(
      makeCtx({
        inputs: {
          context,
          options: { methodologies: ["stride"], mitigationsOnly: true },
        },
        aiCall: async () => {
          aiCalls++;
          return STUB_RESPONSE;
        },
      }),
    );
    // No per-category calls; <3 threats also skips the compound LLM call
    expect(aiCalls).toBe(0);
    expect(result.outputs.threats).toEqual([]);
  });
});

describe("sequentialThreatOrder", () => {
  const t = (componentId: string, category: string, name: string) =>
    ({ componentId, category, name }) as MicroThreat;

  it("restores component → category order regardless of child completion order", () => {
    const shuffled = [
      t("db", "SPOOFING", "db-S"),
      t("web", "INFORMATION_DISCLOSURE", "web-I"),
      t("web", "SPOOFING", "web-S1"),
      t("db", "TAMPERING", "db-T"),
      t("web", "SPOOFING", "web-S2"),
    ];
    expect(
      sequentialThreatOrder(shuffled, ["web", "db"], ["stride"]).map(
        (x) => x.name,
      ),
    ).toEqual(["web-S1", "web-S2", "web-I", "db-S", "db-T"]);
  });

  it("puts unknown components and categories last, keeping their order", () => {
    const threats = [
      t("ghost", "SPOOFING", "ghost"),
      t("web", "NOT_A_CATEGORY", "odd"),
      t("web", "TAMPERING", "web-T"),
    ];
    expect(
      sequentialThreatOrder(threats, ["web"], ["stride"]).map((x) => x.name),
    ).toEqual(["web-T", "odd", "ghost"]);
  });
});
